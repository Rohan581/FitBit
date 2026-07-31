const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { calculateDailyPoints, getRestDayTargets } = require('./points');
const { todayIST, getMondayIST, getDaysOfWeek } = require('../dateUtils');

// GET /api/dashboard
router.get('/', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const weekStart = getMondayIST(today);
  const weekDays = getDaysOfWeek(weekStart);

  // Today's logs
  const foodLogs = db.prepare('SELECT * FROM food_logs WHERE date = ? ORDER BY logged_at').all(today);
  const exerciseLogs = db.prepare('SELECT * FROM exercise_logs WHERE date = ? ORDER BY logged_at').all(today);
  const sleepLog = db.prepare('SELECT * FROM sleep_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(today);
  const weightLog = db.prepare('SELECT * FROM weight_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(today);
  const waterLog = db.prepare('SELECT * FROM water_logs WHERE date = ?').get(today);

  // Goal & targets
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();

  // Food totals
  const foodTotals = foodLogs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein_g: acc.protein_g + l.protein_g,
    carbs_g: acc.carbs_g + l.carbs_g,
    fat_g: acc.fat_g + l.fat_g,
    fiber_g: acc.fiber_g + (l.fiber_g || 0),
    sugar_g: acc.sugar_g + (l.sugar_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 });

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

  // Water
  const waterTarget = goal?.water_target_ml || 3000;
  const waterTargetGlasses = Math.round(waterTarget / 250);

  // Notifications
  const notifications = [];

  // Stall detection — waist-aware
  if (rolling_avg_weight) {
    const twoWeeksAgo = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date DESC, logged_at DESC LIMIT 14').all();
    if (twoWeeksAgo.length >= 10) {
      const oldAvg = twoWeeksAgo.slice(-7).reduce((s, w) => s + w.weight_kg, 0) / Math.min(7, twoWeeksAgo.slice(-7).length);
      const weightDiff = Math.abs(rolling_avg_weight - oldAvg);
      const weightFlat = weightDiff < 0.3;

      if (weightFlat) {
        // Check waist measurements over the last 3 weeks
        const threeWeeksAgoDate = new Date(Date.now() + 330 * 60000);
        threeWeeksAgoDate.setUTCDate(threeWeeksAgoDate.getUTCDate() - 21);
        const threeWeeksStr = threeWeeksAgoDate.toISOString().split('T')[0];

        const recentMeasurements = db.prepare(
          'SELECT waist_cm, date FROM measurement_logs WHERE date >= ? ORDER BY date ASC'
        ).all(threeWeeksStr);

        if (recentMeasurements.length >= 2) {
          const firstWaist = recentMeasurements[0].waist_cm;
          const lastWaist = recentMeasurements[recentMeasurements.length - 1].waist_cm;
          const waistChange = lastWaist - firstWaist;

          if (waistChange < -0.5) {
            // Weight flat but waist shrinking — NOT a stall
            notifications.push({
              type: 'waist_progress',
              message: `Scale is flat but your waist is down ${Math.abs(Math.round(waistChange * 10) / 10)} cm over ${recentMeasurements.length} measurements — you're losing fat, water retention is masking it on the scale. Keep going.`,
            });
          } else {
            // Weight flat and waist flat — genuine stall
            notifications.push({
              type: 'stall',
              message: 'Your weight and waist measurements have both been stable for 2+ weeks. Consider checking portion sizes or logging accuracy — not a failure, just a data check.',
            });
          }
        } else {
          // No waist data — fall back to original stall message
          notifications.push({
            type: 'stall',
            message: 'Your weight average has been stable for 2+ weeks. Log a waist measurement to check if you\'re still losing fat despite the scale.',
          });
        }
      }

      // Weight dropping but waist flat — possible muscle loss
      const weightDropping = (oldAvg - rolling_avg_weight) > 0.5;
      if (weightDropping) {
        const threeWeeksStr2 = new Date(Date.now() + 330 * 60000 - 21 * 86400000).toISOString().split('T')[0];
        const recentM = db.prepare(
          'SELECT waist_cm FROM measurement_logs WHERE date >= ? ORDER BY date ASC'
        ).all(threeWeeksStr2);

        if (recentM.length >= 2) {
          const waistChange2 = recentM[recentM.length - 1].waist_cm - recentM[0].waist_cm;
          if (Math.abs(waistChange2) < 0.5) {
            notifications.push({
              type: 'check_protein',
              message: 'Weight is dropping but waist is unchanged — this could indicate some muscle loss. Make sure you\'re hitting your protein target and keeping training intensity up.',
            });
          }
        }
      }
    }

    // Too-fast-loss
    const twoWeeksWeights = db.prepare('SELECT weight_kg, date FROM weight_logs ORDER BY date ASC LIMIT 14').all();
    if (twoWeeksWeights.length >= 7) {
      const firstAvg = twoWeeksWeights.slice(0, 7).reduce((s, w) => s + w.weight_kg, 0) / 7;
      const weeklyLossRate = (firstAvg - rolling_avg_weight) / firstAvg;
      if (weeklyLossRate > 0.01 * 2) {
        notifications.push({ type: 'fast_loss', message: 'You\'re losing weight quickly — great progress, but make sure you\'re hitting your protein target. Fast loss without enough protein can mean muscle loss.' });
      }
    }
  }

  // Measurement reminder — weekly, only if no measurement in 7+ days
  const sevenDaysAgo = new Date(Date.now() + 330 * 60000);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];
  const recentMeasurement = db.prepare(
    'SELECT id FROM measurement_logs WHERE date >= ? LIMIT 1'
  ).get(sevenDaysStr);
  if (!recentMeasurement) {
    notifications.push({
      type: 'measurement_reminder',
      message: 'It\'s been a week since your last measurement. A quick waist measurement helps track fat loss even when the scale is flat.',
      dismissible: true,
    });
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

  // Rest day
  const restDayTargets = getRestDayTargets(db, today, goal);

  res.json({
    today,
    week_start: weekStart,
    food_logs: foodLogs,
    food_totals: foodTotals,
    exercise_logs: exerciseLogs,
    sleep_log: sleepLog,
    weight_log: weightLog,
    water: {
      glasses: waterLog?.glasses || 0,
      target_glasses: waterTargetGlasses,
      target_ml: waterTarget,
    },
    daily_points: dailyPoints,
    weekly_points: weeklyPoints,
    threshold,
    treat_earned,
    treat_redeemed,
    goal,
    rolling_avg_weight,
    notifications,
    rest_day: restDayTargets,
  });
});

module.exports = router;
