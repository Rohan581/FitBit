const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// Configure VAPID keys from environment
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:noreply@earned.app', VAPID_PUBLIC, VAPID_PRIVATE);
}

// GET /api/push/vapid-key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// POST /api/push/subscribe
router.post('/subscribe', (req, res) => {
  const db = getDB();
  const { subscription, measurement_reminder, stale_workout, food_reminder, food_reminder_time } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing subscription' });
  }

  db.prepare(`
    INSERT INTO push_subscriptions (endpoint, keys_json, measurement_reminder, stale_workout, food_reminder, food_reminder_time)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      keys_json = excluded.keys_json,
      measurement_reminder = excluded.measurement_reminder,
      stale_workout = excluded.stale_workout,
      food_reminder = excluded.food_reminder,
      food_reminder_time = excluded.food_reminder_time
  `).run(
    subscription.endpoint,
    JSON.stringify(subscription),
    measurement_reminder ? 1 : 0,
    stale_workout ? 1 : 0,
    food_reminder ? 1 : 0,
    food_reminder_time || '21:00'
  );

  res.json({ ok: true });
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', (req, res) => {
  const db = getDB();
  const { endpoint } = req.body;
  if (endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }
  res.json({ ok: true });
});

// GET /api/push/status
router.get('/status', (req, res) => {
  const db = getDB();
  const endpoint = req.query.endpoint || '';
  const sub = db.prepare('SELECT measurement_reminder, stale_workout, food_reminder, food_reminder_time FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  res.json({
    subscribed: !!sub,
    measurement_reminder: !!sub?.measurement_reminder,
    stale_workout: !!sub?.stale_workout,
    food_reminder: !!sub?.food_reminder,
    food_reminder_time: sub?.food_reminder_time || '21:00',
    vapid_configured: !!(VAPID_PUBLIC && VAPID_PRIVATE),
  });
});

// Internal: send notification to matching subscribers
async function sendToSubscribers(column, payload) {
  const db = getDB();
  const subs = db.prepare(`SELECT * FROM push_subscriptions WHERE ${column} = 1`).all();

  for (const sub of subs) {
    try {
      const subscription = JSON.parse(sub.keys_json);
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    }
  }
}

// POST /api/push/test — send a test notification to a specific endpoint
router.post('/test', async (req, res) => {
  const db = getDB();
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(500).json({ error: 'VAPID keys not configured on server' });

  const sub = db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });

  try {
    const subscription = JSON.parse(sub.keys_json);
    await webpush.sendNotification(subscription, JSON.stringify({
      title: 'Test notification',
      body: 'Push notifications are working.',
      url: '/settings',
    }));
    res.json({ ok: true });
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      return res.status(410).json({ error: 'Subscription expired — re-enable notifications' });
    }
    res.status(500).json({ error: err.message || 'Push send failed' });
  }
});

// POST /api/push/check — check and fire due notifications (called by server scheduler)
router.post('/check', async (req, res) => {
  const db = getDB();
  const today = todayIST();

  // 1. Weekly measurement reminder
  const sevenDaysAgo = new Date(Date.now() + 330 * 60000);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];
  const recentMeasurement = db.prepare('SELECT id FROM measurement_logs WHERE date >= ? LIMIT 1').get(sevenDaysStr);

  if (!recentMeasurement) {
    const lastSent = db.prepare(
      "SELECT sent_at FROM push_log WHERE type = 'measurement_reminder' ORDER BY sent_at DESC LIMIT 1"
    ).get();
    if (!lastSent || lastSent.sent_at < sevenDaysStr) {
      await sendToSubscribers('measurement_reminder', {
        title: 'Measurement reminder',
        body: "It's been a week — a quick waist measurement helps track fat loss even when the scale is flat.",
        url: '/',
      });
      db.prepare("INSERT INTO push_log (type, sent_at) VALUES ('measurement_reminder', ?)").run(today);
    }
  }

  // 2. Stale workout
  const yesterday = new Date(Date.now() + 330 * 60000);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const staleSessions = db.prepare(
    'SELECT id, date FROM workout_sessions WHERE completed = 0 AND date <= ?'
  ).all(yesterdayStr);

  for (const session of staleSessions) {
    const alreadySent = db.prepare(
      "SELECT id FROM push_log WHERE type = 'stale_workout' AND ref_id = ?"
    ).get(String(session.id));
    if (!alreadySent) {
      await sendToSubscribers('stale_workout', {
        title: 'Open workout',
        body: 'You have a workout left open from yesterday. Finish or discard it?',
        url: '/training',
      });
      db.prepare("INSERT INTO push_log (type, sent_at, ref_id) VALUES ('stale_workout', ?, ?)").run(today, String(session.id));
    }
  }

  // 3. Food-logging reminder
  const nowIST = new Date(Date.now() + 330 * 60000);
  const currentHourMin = `${String(nowIST.getUTCHours()).padStart(2, '0')}:${String(nowIST.getUTCMinutes()).padStart(2, '0')}`;

  // Get all food-reminder subscribers whose reminder time has passed
  const foodSubs = db.prepare(
    'SELECT * FROM push_subscriptions WHERE food_reminder = 1 AND food_reminder_time <= ?'
  ).all(currentHourMin);

  if (foodSubs.length > 0) {
    // Check if any food was logged today
    const foodLogged = db.prepare('SELECT id FROM food_logs WHERE date = ? LIMIT 1').get(today);
    if (!foodLogged) {
      // Check if we already sent today
      const alreadySentFood = db.prepare(
        "SELECT id FROM push_log WHERE type = 'food_reminder' AND sent_at = ?"
      ).get(today);
      if (!alreadySentFood) {
        for (const sub of foodSubs) {
          try {
            const subscription = JSON.parse(sub.keys_json);
            await webpush.sendNotification(subscription, JSON.stringify({
              title: 'Nothing logged today',
              body: '30 seconds before bed keeps the streak honest.',
              url: '/food',
            }));
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
            }
          }
        }
        db.prepare("INSERT INTO push_log (type, sent_at) VALUES ('food_reminder', ?)").run(today);
      }
    }
  }

  res.json({ ok: true });
});

// Start a periodic check (every 15 minutes) when this module loads on the server
let _checkInterval = null;
function startScheduler() {
  if (_checkInterval) return;
  _checkInterval = setInterval(async () => {
    try {
      const db = getDB();
      // Reuse the check logic directly
      const today = todayIST();

      // Measurement reminder
      const sevenDaysAgo = new Date(Date.now() + 330 * 60000);
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];
      const recentMeasurement = db.prepare('SELECT id FROM measurement_logs WHERE date >= ? LIMIT 1').get(sevenDaysStr);
      if (!recentMeasurement) {
        const lastSent = db.prepare("SELECT sent_at FROM push_log WHERE type = 'measurement_reminder' ORDER BY sent_at DESC LIMIT 1").get();
        if (!lastSent || lastSent.sent_at < sevenDaysStr) {
          await sendToSubscribers('measurement_reminder', {
            title: 'Measurement reminder',
            body: "It's been a week — a quick waist measurement helps track fat loss even when the scale is flat.",
            url: '/',
          });
          db.prepare("INSERT INTO push_log (type, sent_at) VALUES ('measurement_reminder', ?)").run(today);
        }
      }

      // Stale workout
      const yesterday = new Date(Date.now() + 330 * 60000);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const staleSessions = db.prepare('SELECT id, date FROM workout_sessions WHERE completed = 0 AND date <= ?').all(yesterdayStr);
      for (const session of staleSessions) {
        const alreadySent = db.prepare("SELECT id FROM push_log WHERE type = 'stale_workout' AND ref_id = ?").get(String(session.id));
        if (!alreadySent) {
          await sendToSubscribers('stale_workout', {
            title: 'Open workout',
            body: 'You have a workout left open from yesterday. Finish or discard it?',
            url: '/training',
          });
          db.prepare("INSERT INTO push_log (type, sent_at, ref_id) VALUES ('stale_workout', ?, ?)").run(today, String(session.id));
        }
      }

      // Food reminder
      const nowIST = new Date(Date.now() + 330 * 60000);
      const currentHourMin = `${String(nowIST.getUTCHours()).padStart(2, '0')}:${String(nowIST.getUTCMinutes()).padStart(2, '0')}`;
      const foodSubs = db.prepare('SELECT * FROM push_subscriptions WHERE food_reminder = 1 AND food_reminder_time <= ?').all(currentHourMin);
      if (foodSubs.length > 0) {
        const foodLogged = db.prepare('SELECT id FROM food_logs WHERE date = ? LIMIT 1').get(today);
        if (!foodLogged) {
          const alreadySentFood = db.prepare("SELECT id FROM push_log WHERE type = 'food_reminder' AND sent_at = ?").get(today);
          if (!alreadySentFood) {
            for (const sub of foodSubs) {
              try {
                const subscription = JSON.parse(sub.keys_json);
                await webpush.sendNotification(subscription, JSON.stringify({
                  title: 'Nothing logged today',
                  body: '30 seconds before bed keeps the streak honest.',
                  url: '/food',
                }));
              } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                  db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
                }
              }
            }
            db.prepare("INSERT INTO push_log (type, sent_at) VALUES ('food_reminder', ?)").run(today);
          }
        }
      }
    } catch (e) {
      console.error('Push scheduler error:', e.message);
    }
  }, 15 * 60 * 1000); // every 15 minutes
}

// Start the scheduler when the module loads
startScheduler();

module.exports = router;
