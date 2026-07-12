const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { calculateDailyPoints } = require('./points');
const { todayIST, getMondayIST, daysAgoIST } = require('../dateUtils');

// GET /api/trends/weight?days=60
router.get('/weight', (req, res) => {
  const db = getDB();
  const days = parseInt(req.query.days) || 60;

  const allWeights = db.prepare('SELECT * FROM weight_logs ORDER BY date ASC, logged_at ASC').all();
  const withAvg = allWeights.map((log, i) => {
    const window = allWeights.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((s, w) => s + w.weight_kg, 0) / window.length;
    return { ...log, rolling_avg: Math.round(avg * 100) / 100 };
  });

  const recent = withAvg.slice(-days);

  // Goal trajectory line
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  let trajectory = null;
  if (goal?.start_date && goal?.target_date && goal?.start_weight_kg && goal?.goal_weight_kg) {
    const start = new Date(goal.start_date + 'T12:00:00Z');
    const end = new Date(goal.target_date + 'T12:00:00Z');
    const totalDays = (end - start) / (1000 * 60 * 60 * 24);
    const weightDiff = goal.goal_weight_kg - goal.start_weight_kg;

    trajectory = [
      { date: goal.start_date, weight: goal.start_weight_kg },
      { date: goal.target_date, weight: goal.goal_weight_kg },
    ];
  }

  // Milestone data
  const milestones = db.prepare('SELECT * FROM milestones ORDER BY weight_kg_threshold DESC').all();

  res.json({ weights: recent, trajectory, milestones, goal });
});

// GET /api/trends/macros?days=60
router.get('/macros', (req, res) => {
  const db = getDB();
  const days = parseInt(req.query.days) || 60;

  const cutoffStr = daysAgoIST(days);

  const logs = db.prepare(`
    SELECT date,
      SUM(calories) as total_cal,
      SUM(protein_g) as total_pro,
      SUM(carbs_g) as total_carb,
      SUM(fat_g) as total_fat
    FROM food_logs
    WHERE date >= ?
    GROUP BY date
    ORDER BY date ASC
  `).all(cutoffStr);

  res.json(logs);
});

// GET /api/trends/points?weeks=12
router.get('/points', (req, res) => {
  const db = getDB();
  const weeks = parseInt(req.query.weeks) || 12;
  const goal = db.prepare('SELECT weekly_point_threshold FROM goal WHERE id = 1').get();
  const threshold = goal?.weekly_point_threshold || 350;

  const results = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const dateStr = daysAgoIST(w * 7);
    const weekStart = getMondayIST(dateStr);

    const days = [];
    const startDate = new Date(weekStart + 'T12:00:00Z');
    for (let i = 0; i < 7; i++) {
      days.push(startDate.toISOString().split('T')[0]);
      startDate.setUTCDate(startDate.getUTCDate() + 1);
    }

    const total = days.reduce((s, day) => s + calculateDailyPoints(db, day).total, 0);
    const summary = db.prepare('SELECT treat_redeemed FROM weekly_summary WHERE week_start = ?').get(weekStart);

    results.push({
      week_start: weekStart,
      total_points: total,
      threshold,
      treat_earned: total >= threshold,
      treat_redeemed: summary?.treat_redeemed === 1,
    });
  }

  res.json(results);
});

// GET /api/trends/history/:date — full day summary
router.get('/history/:date', (req, res) => {
  const db = getDB();
  const { date } = req.params;

  const foodLogs = db.prepare('SELECT * FROM food_logs WHERE date = ? ORDER BY logged_at').all(date);
  const exerciseLogs = db.prepare('SELECT * FROM exercise_logs WHERE date = ? ORDER BY logged_at').all(date);
  const sleepLog = db.prepare('SELECT * FROM sleep_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(date);
  const weightLog = db.prepare('SELECT * FROM weight_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(date);
  const points = calculateDailyPoints(db, date);

  const foodTotals = foodLogs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein_g: acc.protein_g + l.protein_g,
    carbs_g: acc.carbs_g + l.carbs_g,
    fat_g: acc.fat_g + l.fat_g,
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  res.json({ date, foodLogs, exerciseLogs, sleepLog, weightLog, points, foodTotals });
});

module.exports = router;
