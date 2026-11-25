const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { safeEqual } = require('../auth');

// Apple Health ingest, called by an iOS Shortcut running on a daily automation.
//
// There is no cloud API for Apple Health — HealthKit is on-device only and
// Apple provides no server-side access by design, so no amount of backend work
// can reach it. A Shortcut running on the phone is the only route that does not
// require shipping a native iOS app. It reads HealthKit locally and POSTs here.
//
// Authenticated by its own key rather than the app password, matching
// /api/money/ingest: the Shortcut holds a credential that can only write health
// samples, and it is stored in a Shortcuts text field rather than a keychain.
//
// Every write is idempotent. The automation will fire on days it already
// covered, re-run after a failure, and overlap itself; none of that may produce
// duplicates.

const MAX_DAYS = 90;
const MAX_WORKOUTS = 200;

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

router.post('/health', (req, res) => {
  const key = process.env.HEALTH_INGEST_KEY || '';
  if (!key) return res.status(503).json({ error: 'Set HEALTH_INGEST_KEY on the server.' });
  if (!safeEqual(req.get('x-ingest-key') || '', key)) {
    return res.status(401).json({ error: 'Bad ingest key' });
  }

  const db = getDB();
  const body = req.body || {};
  const counts = { steps_written: 0, steps_skipped: 0, workouts_added: 0, workouts_already: 0, workouts_skipped: 0 };

  // ── Steps ──
  // Accepts [{date, count}], or a bare {date, count} for the common
  // one-day-at-a-time Shortcut.
  const stepRows = Array.isArray(body.steps)
    ? body.steps.slice(0, MAX_DAYS)
    : body.steps && typeof body.steps === 'object'
      ? [body.steps]
      : [];

  const upsertSteps = db.prepare(`
    INSERT INTO step_logs (date, steps) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET steps = excluded.steps
  `);

  db.transaction(() => {
    for (const row of stepRows) {
      const date = row?.date;
      const count = Math.round(num(row?.count ?? row?.steps) ?? -1);
      // A zero-step day is almost always the Shortcut firing before HealthKit
      // had anything, or the phone left at home — not a real zero. Overwriting
      // a real count with it would quietly destroy data, so it is skipped.
      if (!isDate(date) || count <= 0) { counts.steps_skipped++; continue; }
      upsertSteps.run(date, count);
      counts.steps_written++;
    }
  })();

  // ── Workouts ──
  const workouts = Array.isArray(body.workouts) ? body.workouts.slice(0, MAX_WORKOUTS) : [];
  const insWorkout = db.prepare(`
    INSERT OR IGNORE INTO health_workouts
      (apple_id, date, type, started_at, duration_min, active_kcal, distance_km)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const w of workouts) {
      const date = w?.date || (typeof w?.start === 'string' ? w.start.slice(0, 10) : null);
      if (!isDate(date)) { counts.workouts_skipped++; continue; }
      // Without a HealthKit UUID there is nothing to deduplicate on, so fall
      // back to a composite that is stable across re-runs of the same day.
      const appleId = String(w.id || w.uuid || `${date}|${w.type || ''}|${w.start || ''}|${w.duration_min || ''}`);
      const r = insWorkout.run(
        appleId, date, w.type ? String(w.type).slice(0, 60) : null,
        w.start ? String(w.start).slice(0, 40) : null,
        num(w.duration_min), num(w.active_kcal), num(w.distance_km)
      );
      if (r.changes) counts.workouts_added++; else counts.workouts_already++;
    }
  })();

  res.json({ ok: true, ...counts });
});

// GET /api/ingest/health/status — lets the Shortcut be tested without writing.
router.get('/health/status', (req, res) => {
  const key = process.env.HEALTH_INGEST_KEY || '';
  if (!key) return res.status(503).json({ error: 'Set HEALTH_INGEST_KEY on the server.' });
  if (!safeEqual(req.get('x-ingest-key') || '', key)) {
    return res.status(401).json({ error: 'Bad ingest key' });
  }
  const db = getDB();
  const steps = db.prepare('SELECT date, steps FROM step_logs ORDER BY date DESC LIMIT 7').all();
  const workouts = db.prepare('SELECT date, type, duration_min, active_kcal FROM health_workouts ORDER BY date DESC, id DESC LIMIT 10').all();
  res.json({ ok: true, recent_steps: steps, recent_workouts: workouts });
});

module.exports = router;
