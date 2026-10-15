const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { calculateDailyPoints } = require('./points');
const { todayIST, getMondayIST, getDaysOfWeek } = require('../dateUtils');

// GET /api/weekly-summary?weekStart=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const weekStart = req.query.weekStart || getMondayIST(todayIST());
  const days = getDaysOfWeek(weekStart);

  const goal = db.prepare('SELECT weekly_point_threshold FROM goal WHERE id = 1').get();
  const threshold = goal?.weekly_point_threshold || 315;

  let summary = db.prepare('SELECT * FROM weekly_summary WHERE week_start = ?').get(weekStart);
  if (!summary) {
    db.prepare('INSERT OR IGNORE INTO weekly_summary (week_start, threshold) VALUES (?, ?)').run(weekStart, threshold);
    summary = db.prepare('SELECT * FROM weekly_summary WHERE week_start = ?').get(weekStart);
  }

  const byDay = days.map(d => calculateDailyPoints(db, d));
  const total_points = byDay.reduce((s, d) => s + d.total, 0);

  // Keep weekly_summary.total_points in sync with live computation
  db.prepare('UPDATE weekly_summary SET total_points = ?, threshold = ? WHERE week_start = ?')
    .run(total_points, threshold, weekStart);

  res.json({
    week_start: weekStart,
    total_points,
    threshold,
    treat_earned: total_points >= threshold,
    by_day: byDay,
  });
});

module.exports = router;
