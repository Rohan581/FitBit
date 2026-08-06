const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST, getMondayIST, getDaysOfWeek } = require('../dateUtils');

function getRestDayTargets(db, date, goal) {
  const isRestDay = !!db.prepare('SELECT id FROM rest_days WHERE date = ?').get(date);
  if (!isRestDay) return null;

  const reduction = goal?.rest_day_reduction || 150;
  const calTarget = (goal?.current_calorie_target || 2240) - reduction;
  // Reduction comes from carbs: carb_g reduction = reduction / 4 (4 kcal per g carbs)
  const carbReduction = Math.round(reduction / 4);
  const carbTarget = Math.max(50, (goal?.current_carb_target_g || 240) - carbReduction);

  return {
    is_rest_day: true,
    calorie_target: Math.round(calTarget),
    protein_target: goal?.current_protein_target_g || 180, // unchanged
    carb_target: carbTarget,
    fat_target: goal?.current_fat_target_g || 60, // unchanged
    reduction,
  };
}

function calculateDailyPoints(db, date) {
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const foodLogs = db.prepare('SELECT * FROM food_logs WHERE date = ?').all(date);
  const exerciseLogs = db.prepare('SELECT * FROM exercise_logs WHERE date = ?').all(date);
  const sleepLog = db.prepare('SELECT * FROM sleep_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(date);
  const weightLog = db.prepare('SELECT * FROM weight_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(date);
  const waterLog = db.prepare('SELECT * FROM water_logs WHERE date = ?').get(date);

  // Rest-day adjusted targets
  const restDayTargets = getRestDayTargets(db, date, goal);

  const breakdown = [];
  let total = 0;

  // ── Calorie adherence ───────────────────────────────────────────
  if (foodLogs.length > 0) {
    const totalCal = foodLogs.reduce((s, f) => s + f.calories, 0);
    const target = restDayTargets?.calorie_target || goal?.current_calorie_target || 2240;
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
  // Measurements are an optional contributor — they count toward the bonus
  // when logged, but their absence never blocks it.
  const coreLogged = foodLogs.length > 0 && exerciseLogs.length > 0 && sleepLog && weightLog;
  if (coreLogged) {
    const measurementLog = db.prepare('SELECT id FROM measurement_logs WHERE date = ? LIMIT 1').get(date);
    const categories = measurementLog ? 5 : 4;
    breakdown.push({ category: 'streak', points: 10, reason: `All ${categories} categories logged today` });
    total += 10;
  }

  // ── Finance: transaction/no-spend logging ──────────────────────
  // Guarded by table existence check so fitness points are never affected
  const finTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fin_transactions'").get();
  if (finTable) {
    const finTxCount = db.prepare("SELECT COUNT(*) as c FROM fin_transactions WHERE date = ? AND type = 'expense'").get(date)?.c || 0;
    const finNoSpend = db.prepare('SELECT id FROM fin_no_spend_days WHERE date = ?').get(date);
    if (finTxCount > 0 || finNoSpend) {
      breakdown.push({
        category: 'finance',
        points: 5,
        reason: finNoSpend ? 'No-spend day logged' : `${finTxCount} expense(s) logged`,
      });
      total += 5;
    }
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
  let total = byDay.reduce((s, d) => s + d.total, 0);

  // ── Finance weekly bonus: +25 if MTD accrual spend <= pro-rated budget ──
  let finance_weekly_bonus = 0;
  const finTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fin_settings'").get();
  if (finTable) {
    const finSettings = db.prepare('SELECT monthly_overall_budget FROM fin_settings WHERE id = 1').get();
    const monthlyBudget = finSettings?.monthly_overall_budget || 0;
    if (monthlyBudget > 0) {
      const today = todayIST();
      const monthStart = today.slice(0, 7) + '-01';
      const daysInMonth = new Date(parseInt(today.slice(0, 4)), parseInt(today.slice(5, 7)), 0).getDate();
      const dayOfMonth = parseInt(today.slice(8, 10));
      const proRatedBudget = (monthlyBudget / daysInMonth) * dayOfMonth;
      const mtdSpend = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM fin_transactions WHERE type = 'expense' AND date >= ? AND date <= ?").get(monthStart, today)?.s || 0;
      if (mtdSpend <= proRatedBudget && mtdSpend > 0) {
        finance_weekly_bonus = 25;
      }
    }

    // Enforce 60/week hard cap on finance points
    const dailyFinPts = byDay.reduce((s, d) => s + d.breakdown.filter(b => b.category === 'finance').reduce((s2, b2) => s2 + b2.points, 0), 0);
    const totalFinPts = dailyFinPts + finance_weekly_bonus;
    if (totalFinPts > 60) {
      finance_weekly_bonus = Math.max(0, 60 - dailyFinPts);
    }
    if (finance_weekly_bonus > 0) {
      total += finance_weekly_bonus;
    }
  }

  const summary = db.prepare('SELECT * FROM weekly_summary WHERE week_start = ?').get(weekStart);
  const treat_earned = total >= threshold;
  const treat_redeemed = summary?.treat_redeemed === 1;

  res.json({ week_start: weekStart, total_points: total, threshold, treat_earned, treat_redeemed, by_day: byDay, finance_weekly_bonus });
});

module.exports = router;
module.exports.calculateDailyPoints = calculateDailyPoints;
module.exports.getRestDayTargets = getRestDayTargets;
