const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST, getMondayIST, getDaysOfWeek } = require('../dateUtils');

function calculateDailyPoints(db, date) {
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const foodLogs = db.prepare('SELECT * FROM food_logs WHERE date = ?').all(date);
  const exerciseLogs = db.prepare('SELECT * FROM exercise_logs WHERE date = ?').all(date);
  const sleepLog = db.prepare('SELECT * FROM sleep_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(date);
  const weightLog = db.prepare('SELECT * FROM weight_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(date);
  const waterLog = db.prepare('SELECT * FROM water_logs WHERE date = ?').get(date);

  const breakdown = [];
  let total = 0;

  // ── Calorie adherence ───────────────────────────────────────────
  if (foodLogs.length > 0) {
    const totalCal = foodLogs.reduce((s, f) => s + f.calories, 0);
    const target = goal?.current_calorie_target || 2240;
    const diff = totalCal - target;
    const absDiff = Math.abs(diff);

    if (absDiff <= 100) {
      breakdown.push({ category: 'calories', points: 20, reason: `${Math.round(totalCal)} kcal — within 100 kcal of target` });
      total += 20;
    } else if (absDiff <= 200) {
      breakdown.push({ category: 'calories', points: 12, reason: `${Math.round(totalCal)} kcal — within 200 kcal of target` });
      total += 12;
    } else if (diff < 0) {
      breakdown.push({ category: 'calories', points: 5, reason: `${Math.round(totalCal)} kcal — under target` });
      total += 5;
    }
  }

  // ── Protein ────────────────────────────────────────────────────
  if (foodLogs.length > 0) {
    const totalPro = foodLogs.reduce((s, f) => s + f.protein_g, 0);
    const target = goal?.current_protein_target_g || 180;
    const pct = totalPro / target;

    if (pct >= 1.0) {
      breakdown.push({ category: 'protein', points: 25, reason: `${Math.round(totalPro)}g protein — target hit!` });
      total += 25;
    } else if (pct >= 0.8) {
      breakdown.push({ category: 'protein', points: 15, reason: `${Math.round(totalPro)}g protein — 80%+ of target` });
      total += 15;
    } else if (pct >= 0.6) {
      breakdown.push({ category: 'protein', points: 8, reason: `${Math.round(totalPro)}g protein — 60%+ of target` });
      total += 8;
    }
  }

  // ── Fiber ──────────────────────────────────────────────────────
  if (foodLogs.length > 0) {
    const totalFiber = foodLogs.reduce((s, f) => s + (f.fiber_g || 0), 0);
    const fiberTarget = goal?.current_fiber_target_g || 32;
    const pct = totalFiber / fiberTarget;

    if (pct >= 1.0) {
      breakdown.push({ category: 'fiber', points: 12, reason: `${Math.round(totalFiber)}g fiber — target hit!` });
      total += 12;
    } else if (pct >= 0.8) {
      breakdown.push({ category: 'fiber', points: 6, reason: `${Math.round(totalFiber)}g fiber — 80%+ of target` });
      total += 6;
    }
  }

  // ── Exercise ───────────────────────────────────────────────────
  for (const ex of exerciseLogs) {
    const type = (ex.type || '').toLowerCase();
    const dur = ex.duration_min || 0;
    let base = 0;

    if (['gym', 'weights', 'gym/weights', 'strength'].includes(type)) {
      base = dur >= 60 ? 30 : dur >= 45 ? 25 : dur >= 30 ? 20 : 12;
    } else if (['running', 'swimming', 'cycling'].includes(type)) {
      base = dur >= 45 ? 22 : dur >= 30 ? 18 : 10;
    } else if (['walking', 'hiking'].includes(type)) {
      base = dur >= 45 ? 15 : 10;
    } else {
      base = 12;
    }

    const modifier = ex.intensity === 'intense' ? 1.2 : ex.intensity === 'light' ? 0.8 : 1.0;
    const pts = Math.round(base * modifier);
    breakdown.push({ category: 'exercise', points: pts, reason: `${ex.type} — ${dur} min (${ex.intensity})` });
    total += pts;
  }

  // ── Sleep ──────────────────────────────────────────────────────
  if (sleepLog) {
    const h = sleepLog.hours;
    if (h >= 7 && h <= 8.5) {
      breakdown.push({ category: 'sleep', points: 15, reason: `${h}h sleep — ideal range` });
      total += 15;
    } else if ((h >= 6.5 && h < 7) || (h > 8.5 && h <= 9)) {
      breakdown.push({ category: 'sleep', points: 8, reason: `${h}h sleep — close to ideal` });
      total += 8;
    }
  }

  // ── Water ──────────────────────────────────────────────────────
  if (waterLog && waterLog.glasses > 0) {
    const waterTarget = goal?.water_target_ml || 3000;
    const targetGlasses = Math.round(waterTarget / 250);
    if (waterLog.glasses >= targetGlasses) {
      breakdown.push({ category: 'water', points: 5, reason: `${waterLog.glasses} glasses — water target hit` });
      total += 5;
    }
  }

  // ── Full-day logging bonus ──────────────────────────────────────
  if (foodLogs.length > 0 && exerciseLogs.length > 0 && sleepLog && weightLog) {
    breakdown.push({ category: 'streak', points: 10, reason: 'All 4 categories logged today' });
    total += 10;
  }

  return { date, total, breakdown };
}

// GET /api/points/daily?date=YYYY-MM-DD
router.get('/daily', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  res.json(calculateDailyPoints(db, date));
});

// GET /api/points/weekly?weekStart=YYYY-MM-DD
router.get('/weekly', (req, res) => {
  const db = getDB();
  const weekStart = req.query.weekStart || getMondayIST(todayIST());
  const days = getDaysOfWeek(weekStart);

  const goal = db.prepare('SELECT weekly_point_threshold FROM goal WHERE id = 1').get();
  const threshold = goal?.weekly_point_threshold || 350;

  const byDay = days.map(d => calculateDailyPoints(db, d));
  const total = byDay.reduce((s, d) => s + d.total, 0);

  const summary = db.prepare('SELECT * FROM weekly_summary WHERE week_start = ?').get(weekStart);
  const treat_earned = total >= threshold;
  const treat_redeemed = summary?.treat_redeemed === 1;

  res.json({ week_start: weekStart, total_points: total, threshold, treat_earned, treat_redeemed, by_day: byDay });
});

module.exports = router;
module.exports.calculateDailyPoints = calculateDailyPoints;
