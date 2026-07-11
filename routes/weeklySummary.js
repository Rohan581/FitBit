const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { calculateDailyPoints, getMonday } = require('./points');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getDaysOfWeek(mondayStr) {
  const days = [];
  const d = new Date(mondayStr + 'T12:00:00Z');
  for (let i = 0; i < 7; i++) {
    days.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

// GET /api/weekly-summary?weekStart=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const weekStart = req.query.weekStart || getMonday(todayStr());
  const days = getDaysOfWeek(weekStart);

  const goal = db.prepare('SELECT weekly_point_threshold FROM goal WHERE id = 1').get();
  const threshold = goal?.weekly_point_threshold || 350;

  let summary = db.prepare('SELECT * FROM weekly_summary WHERE week_start = ?').get(weekStart);
  if (!summary) {
    db.prepare('INSERT OR IGNORE INTO weekly_summary (week_start, threshold) VALUES (?, ?)').run(weekStart, threshold);
    summary = db.prepare('SELECT * FROM weekly_summary WHERE week_start = ?').get(weekStart);
  }

  const byDay = days.map(d => calculateDailyPoints(db, d));
  const total_points = byDay.reduce((s, d) => s + d.total, 0);
  const treat_earned = total_points >= threshold;

  // Calculate weekly calorie budget
  const foodLogs = db.prepare(`SELECT calories FROM food_logs WHERE date >= ? AND date <= ?`).all(weekStart, days[6]);
  const totalWeekCals = foodLogs.reduce((s, f) => s + f.calories, 0);
  const goalData = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const weeklyCalTarget = (goalData?.current_calorie_target || 2240) * 7;
  const weeklyCalBudget = weeklyCalTarget - totalWeekCals;

  res.json({
    week_start: weekStart,
    total_points,
    threshold,
    treat_earned,
    treat_redeemed: summary.treat_redeemed === 1,
    treat_redeemed_date: summary.treat_redeemed_date,
    by_day: byDay,
    weekly_cal_budget: Math.max(0, Math.round(weeklyCalBudget)),
  });
});

// POST /api/weekly-summary/redeem
router.post('/redeem', (req, res) => {
  const db = getDB();
  const weekStart = req.body.weekStart || getMonday(todayStr());

  db.prepare(`
    INSERT INTO weekly_summary (week_start, treat_redeemed, treat_redeemed_date, threshold)
    VALUES (?, 1, ?, ?)
    ON CONFLICT(week_start) DO UPDATE SET treat_redeemed=1, treat_redeemed_date=?
  `).run(weekStart, todayStr(), 350, todayStr());

  res.json({ ok: true, week_start: weekStart });
});

module.exports = router;
