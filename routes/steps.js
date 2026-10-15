const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// GET /api/steps?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const log = db.prepare('SELECT * FROM step_logs WHERE date = ?').get(date);
  const goal = db.prepare('SELECT step_target_weekday, step_target_weekend FROM goal WHERE id = 1').get();
  const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const target = isWeekend
    ? (goal?.step_target_weekend || 10000)
    : (goal?.step_target_weekday || 12000);

  res.json({
    date,
    steps: log?.steps || 0,
    target,
    logged: !!log,
  });
});

// POST /api/steps
router.post('/', (req, res) => {
  const db = getDB();
  const { date, steps } = req.body;
  const d = date || todayIST();
  const s = parseInt(steps) || 0;

  db.prepare(`
    INSERT INTO step_logs (date, steps) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET steps = excluded.steps
  `).run(d, s);

  res.json({ date: d, steps: s });
});

// DELETE /api/steps?date=YYYY-MM-DD
router.delete('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  db.prepare('DELETE FROM step_logs WHERE date = ?').run(date);
  res.json({ deleted: true });
});

// GET /api/steps/weekly-avg
router.get('/weekly-avg', (req, res) => {
  const db = getDB();
  const weeks = parseInt(req.query.weeks) || 8;

  const cutoff = new Date(todayIST() + 'T12:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const data = db.prepare(`
    SELECT date, steps FROM step_logs WHERE date >= ? ORDER BY date ASC
  `).all(cutoffStr);

  // Group by ISO week
  const weekMap = {};
  for (const row of data) {
    const d = new Date(row.date + 'T12:00:00Z');
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diff);
    const weekKey = monday.toISOString().split('T')[0];
    if (!weekMap[weekKey]) weekMap[weekKey] = [];
    weekMap[weekKey].push(row.steps);
  }

  const weeklyAvgs = Object.entries(weekMap).map(([week, steps]) => ({
    week,
    avg: Math.round(steps.reduce((s, v) => s + v, 0) / steps.length),
    days_logged: steps.length,
  })).sort((a, b) => a.week.localeCompare(b.week));

  res.json(weeklyAvgs);
});

module.exports = router;
