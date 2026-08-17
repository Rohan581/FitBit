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

// GET /api/push/vapid-key — public key for client subscription
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// POST /api/push/subscribe — save a push subscription
router.post('/subscribe', (req, res) => {
  const db = getDB();
  const { subscription, measurement_reminder, stale_workout } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing subscription' });
  }

  db.prepare(`
    INSERT INTO push_subscriptions (endpoint, keys_json, measurement_reminder, stale_workout)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      keys_json = excluded.keys_json,
      measurement_reminder = excluded.measurement_reminder,
      stale_workout = excluded.stale_workout
  `).run(
    subscription.endpoint,
    JSON.stringify(subscription),
    measurement_reminder ? 1 : 0,
    stale_workout ? 1 : 0
  );

  res.json({ ok: true });
});

// POST /api/push/unsubscribe — remove a push subscription
router.post('/unsubscribe', (req, res) => {
  const db = getDB();
  const { endpoint } = req.body;
  if (endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }
  res.json({ ok: true });
});

// GET /api/push/status — get subscription preferences for a given endpoint
router.get('/status', (req, res) => {
  const db = getDB();
  const endpoint = req.query.endpoint || '';
  const sub = db.prepare('SELECT measurement_reminder, stale_workout FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  res.json({
    subscribed: !!sub,
    measurement_reminder: !!sub?.measurement_reminder,
    stale_workout: !!sub?.stale_workout,
  });
});

// Internal: send notification to all opted-in subscribers for a given type
async function sendNotification(type, payload) {
  const db = getDB();
  const column = type === 'measurement_reminder' ? 'measurement_reminder' : 'stale_workout';
  const subs = db.prepare(`SELECT * FROM push_subscriptions WHERE ${column} = 1`).all();

  for (const sub of subs) {
    try {
      const subscription = JSON.parse(sub.keys_json);
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired/invalid — prune it
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
      // All other errors: fail silently
    }
  }
}

// POST /api/push/check — called periodically (e.g., on server start or cron)
// Checks and fires due notifications
router.post('/check', async (req, res) => {
  const db = getDB();
  const today = todayIST();

  // 1. Weekly measurement reminder
  const sevenDaysAgo = new Date(Date.now() + 330 * 60000);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];
  const recentMeasurement = db.prepare('SELECT id FROM measurement_logs WHERE date >= ? LIMIT 1').get(sevenDaysStr);

  if (!recentMeasurement) {
    // Check if we already sent this week
    const lastSent = db.prepare(
      "SELECT sent_at FROM push_log WHERE type = 'measurement_reminder' ORDER BY sent_at DESC LIMIT 1"
    ).get();
    const shouldSend = !lastSent || lastSent.sent_at < sevenDaysStr;

    if (shouldSend) {
      await sendNotification('measurement_reminder', {
        title: 'Measurement reminder',
        body: "It's been a week — a quick waist measurement helps track fat loss even when the scale is flat.",
        url: '/',
      });
      db.prepare("INSERT INTO push_log (type, sent_at) VALUES ('measurement_reminder', ?)").run(today);
    }
  }

  // 2. Stale workout (open session from yesterday or earlier)
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
      await sendNotification('stale_workout', {
        title: 'Open workout',
        body: 'You have a workout left open from yesterday. Finish or discard it?',
        url: '/training',
      });
      db.prepare("INSERT INTO push_log (type, sent_at, ref_id) VALUES ('stale_workout', ?, ?)").run(today, String(session.id));
    }
  }

  res.json({ ok: true });
});

module.exports = router;
