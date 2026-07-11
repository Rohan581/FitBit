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

// GET /api/dashboard
router.get('/', (req, res) => {
  const db = getDB();
  const today = todayStr();
  const weekStart = getMonday(today);
  const weekDays = getDaysOfWeek(weekStart);

  // Today's logs
  const foodLogs = db.prepare('SELECT * FROM food_logs WHERE date = ? ORDER BY logged_at').all(today);
  const exerciseLogs = db.prepare('SELECT * FROM exercise_logs WHERE date = ? ORDER BY logged_at').all(today);
  const sleepLog = db.prepare('SELECT * FROM sleep_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(today);
  const weightLog = db.prepare('SELECT * FROM weight_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(today);

  // Goal & targets
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();

  // Food totals
  const foodTotals = foodLogs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein_g: acc.protein_g + l.protein_g,
    carbs_g: acc.carbs_g + l.carbs_g,
    fat_g: acc.fat_g + l.fat_g,
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  // Daily points
  const dailyPoints = calculateDailyPoints(db, today);

  // Weekly points
  const weeklyPoints = weekDays.reduce((s, d) => s + calculateDailyPoints(db, d).total, 0);
  const threshold = goal?.weekly_point_threshold || 350;
  const treat_earned = weeklyPoints >= threshold;

  const weeklySummary = db.prepare('SELECT * FROM weekly_summary WHERE week_start = ?').get(weekStart);
  const treat_redeemed = weeklySummary?.treat_redeemed === 1;

  // Rolling average weight (last 7 entries)
  const recentWeights = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date DESC, logged_at DESC LIMIT 7').all().reverse();
  const rolling_avg_weight = recentWeights.length > 0
    ? Math.round(recentWeights.reduce((s, w) => s + w.weight_kg, 0) / recentWeights.length * 100) / 100
    : null;

  // Notifications
  const notifications = [];

  // Stall detection: rolling avg hasn't moved >0.2kg in 14 days
  if (rolling_avg_weight) {
    const twoWeeksAgo = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date DESC, logged_at DESC LIMIT 14').all();
    if (twoWeeksAgo.length >= 10) {
      const oldAvg = twoWeeksAgo.slice(-7).reduce((s, w) => s + w.weight_kg, 0) / Math.min(7, twoWeeksAgo.slice(-7).length);
      const diff = Math.abs(rolling_avg_weight - oldAvg);
      if (diff < 0.3) {
        notifications.push({ type: 'stall', message: 'Your weight average has been stable for 2+ weeks. Consider checking portion sizes or logging accuracy — not a failure, just a data check.' });
      }
    }

    // Too-fast-loss: >1% bodyweight/week
    const twoWeeksWeights = db.prepare('SELECT weight_kg, date FROM weight_logs ORDER BY date ASC LIMIT 14').all();
    if (twoWeeksWeights.length >= 7) {
      const firstAvg = twoWeeksWeights.slice(0, 7).reduce((s, w) => s + w.weight_kg, 0) / 7;
      const weeklyLossRate = (firstAvg - rolling_avg_weight) / firstAvg;
      if (weeklyLossRate > 0.01 * 2) { // >1%/week over 2 weeks
        notifications.push({ type: 'fast_loss', message: 'You\'re losing weight quickly — great progress, but make sure you\'re hitting your protein target. Fast loss without enough protein can mean muscle loss.' });
      }
    }
  }

  // Milestone check
  if (rolling_avg_weight) {
    const unachievedMilestones = db.prepare('SELECT * FROM milestones WHERE achieved_date IS NULL AND weight_kg_threshold >= ?').all(rolling_avg_weight);
    for (const ms of unachievedMilestones) {
      if (rolling_avg_weight <= ms.weight_kg_threshold) {
        db.prepare('UPDATE milestones SET achieved_date = ? WHERE id = ?').run(today, ms.id);
        const startWeight = goal?.start_weight_kg || 90;
        const lost = Math.round((startWeight - ms.weight_kg_threshold) * 10) / 10;
        notifications.push({ type: 'milestone', message: `Milestone reached: ${ms.weight_kg_threshold}kg! That's ${lost}kg lost from your starting weight.` });
      }
    }
  }

  res.json({
    today,
    week_start: weekStart,
    food_logs: foodLogs,
    food_totals: foodTotals,
    exercise_logs: exerciseLogs,
    sleep_log: sleepLog,
    weight_log: weightLog,
    daily_points: dailyPoints,
    weekly_points: weeklyPoints,
    threshold,
    treat_earned,
    treat_redeemed,
    goal,
    rolling_avg_weight,
    notifications,
  });
});

module.exports = router;
