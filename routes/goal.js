const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// ── Formula-based TDEE (Mifflin-St Jeor, male) ─────────────
function computeFormulaTDEE(weight_kg, height_cm, age, activity_multiplier) {
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * activity_multiplier) };
}

function computeMacros(weight_kg, height_cm, age, activity_multiplier, deficit_pct) {
  const defPct = typeof deficit_pct === 'number' ? deficit_pct : 0.25;
  const { bmr, tdee } = computeFormulaTDEE(weight_kg, height_cm, age, activity_multiplier);
  let calorie_target = Math.round(tdee * (1 - defPct));
  const bmrFloor = Math.round(bmr * 1.1);
  const floored = calorie_target < bmrFloor;
  if (floored) calorie_target = bmrFloor;
  const protein_target = Math.max(160, Math.round(2 * weight_kg));
  const fat_target = Math.round((calorie_target * 0.26) / 9);
  const carb_target = Math.round((calorie_target - protein_target * 4 - fat_target * 9) / 4);
  return { bmr, tdee, calorie_target, protein_target, fat_target, carb_target, floored };
}

// ── Derive macros from a given TDEE and deficit ──────────────
function deriveMacrosFromTDEE(tdee, deficit_pct, weight_kg) {
  const defPct = typeof deficit_pct === 'number' ? deficit_pct : 0.25;
  let calorie_target = Math.round(tdee * (1 - defPct));

  // Safety floor: max(1600, 22 × bodyweight_kg)
  const floor = Math.max(1600, Math.round(22 * weight_kg));
  const floored = calorie_target < floor;
  if (floored) calorie_target = floor;

  const protein_target = Math.max(160, Math.round(2 * weight_kg));
  const fat_target = Math.round((calorie_target * 0.26) / 9);
  const carb_target = Math.round((calorie_target - protein_target * 4 - fat_target * 9) / 4);
  return { calorie_target, protein_target, fat_target, carb_target, floored };
}

function get7DayRollingAvg(db) {
  const recent = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date DESC, logged_at DESC LIMIT 7').all();
  if (recent.length === 0) return null;
  return recent.reduce((s, w) => s + w.weight_kg, 0) / recent.length;
}

// ── Single TDEE source of truth ─────────────────────────────
// Returns the best available TDEE: observed if stored, else formula.
function getTDEE(db, goal) {
  const rollingAvg = get7DayRollingAvg(db);
  const weight = rollingAvg || goal.start_weight_kg;
  const { bmr, tdee: formulaTDEE } = computeFormulaTDEE(weight, goal.height_cm, goal.age, goal.activity_multiplier);

  if (goal.observed_tdee && goal.tdee_source === 'observed') {
    return { tdee: goal.observed_tdee, source: 'observed', bmr, formula_tdee: formulaTDEE };
  }
  return { tdee: formulaTDEE, source: 'formula', bmr, formula_tdee: formulaTDEE };
}

// ── Observed TDEE computation ────────────────────────────────
// observedTDEE = meanDailyIntake + (weightChangeKg × 7700) / days
// Both weight endpoints use date-aligned 7-day rolling averages.
// Intake window and weight window use the same date range [cutoff, today].
// Intake mean divides by logged days; weight delta divides by elapsed days.
function computeObservedTDEE(db, goal) {
  const today = todayIST();
  const windowDays = 28;

  // Window = [cutoff, today]
  const cutoff = new Date(today + 'T12:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  // Need enough weight entries across the full window
  const weightCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM weight_logs WHERE date >= ? AND date <= ?'
  ).get(cutoffStr, today).cnt;

  if (weightCount < 10) {
    return { source: 'formula', reason: 'fewer than 10 weight entries in window' };
  }

  // 7-day rolling average at START: weights in [cutoff, cutoff+6 days]
  const startEnd = new Date(cutoffStr + 'T12:00:00Z');
  startEnd.setUTCDate(startEnd.getUTCDate() + 6);
  const startEndStr = startEnd.toISOString().split('T')[0];

  const startWeights = db.prepare(
    'SELECT weight_kg FROM weight_logs WHERE date >= ? AND date <= ?'
  ).all(cutoffStr, startEndStr);

  if (startWeights.length < 3) {
    return { source: 'formula', reason: 'insufficient weight data at start of window (need 3+ in first 7 days)' };
  }
  const rollingStart = startWeights.reduce((s, w) => s + w.weight_kg, 0) / startWeights.length;

  // 7-day rolling average at END: weights in [today-6, today]
  const endStart = new Date(today + 'T12:00:00Z');
  endStart.setUTCDate(endStart.getUTCDate() - 6);
  const endStartStr = endStart.toISOString().split('T')[0];

  const endWeights = db.prepare(
    'SELECT weight_kg FROM weight_logs WHERE date >= ? AND date <= ?'
  ).all(endStartStr, today);

  if (endWeights.length < 3) {
    return { source: 'formula', reason: 'insufficient weight data at end of window (need 3+ in last 7 days)' };
  }
  const rollingEnd = endWeights.reduce((s, w) => s + w.weight_kg, 0) / endWeights.length;

  // Food log coverage — same window [cutoff, today]
  const foodDays = db.prepare(
    'SELECT COUNT(DISTINCT date) as cnt FROM food_logs WHERE date >= ? AND date <= ?'
  ).get(cutoffStr, today);

  const elapsedDays = windowDays;
  const coveragePct = (foodDays.cnt / elapsedDays) * 100;

  if (coveragePct < 80) {
    return {
      source: 'formula',
      reason: `food logged on ${foodDays.cnt} of ${elapsedDays} days (${Math.round(coveragePct)}%) — need 80%`,
      coverage_pct: Math.round(coveragePct),
    };
  }

  // Mean daily intake: SUM / COUNT(DISTINCT date) — divides by logged days
  const intakeData = db.prepare(
    'SELECT SUM(calories) / COUNT(DISTINCT date) as mean_intake FROM food_logs WHERE date >= ? AND date <= ?'
  ).get(cutoffStr, today);

  const meanIntake = intakeData.mean_intake || 0;
  const weightChangeKg = rollingEnd - rollingStart;

  // Weight delta divides by elapsed calendar days
  const observedTDEE = meanIntake + (weightChangeKg * 7700) / elapsedDays;

  // Sanity band: 0.75–1.25 × formula TDEE
  const { tdee: formulaTDEE } = computeFormulaTDEE(
    rollingEnd, goal.height_cm, goal.age, goal.activity_multiplier
  );
  const lo = formulaTDEE * 0.75;
  const hi = formulaTDEE * 1.25;
  const clampedTDEE = Math.round(Math.max(lo, Math.min(hi, observedTDEE)));

  return {
    source: 'observed',
    observed_tdee: clampedTDEE,
    formula_tdee: formulaTDEE,
    window_days: elapsedDays,
    coverage_pct: Math.round(coveragePct),
    mean_intake: Math.round(meanIntake),
    rolling_weight_start: Math.round(rollingStart * 100) / 100,
    rolling_weight_end: Math.round(rollingEnd * 100) / 100,
    weight_change_kg: Math.round(weightChangeKg * 100) / 100,
    raw_observed: Math.round(observedTDEE),
    was_clamped: observedTDEE < lo || observedTDEE > hi,
  };
}

// ── Weekly TDEE recompute (idempotent per week) ──────────────
function weeklyTDEERecompute(db) {
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  if (!goal) return;

  const today = todayIST();

  // Only recompute once per week (check last compute date)
  if (goal.last_tdee_compute_date) {
    const lastDate = new Date(goal.last_tdee_compute_date + 'T12:00:00Z');
    const todayDate = new Date(today + 'T12:00:00Z');
    const daysSince = Math.round((todayDate - lastDate) / 86400000);
    if (daysSince < 7) return;
  }

  const result = computeObservedTDEE(db, goal);
  const rollingAvg = get7DayRollingAvg(db);
  const { tdee: formulaTDEE } = computeFormulaTDEE(
    rollingAvg || goal.start_weight_kg, goal.height_cm, goal.age, goal.activity_multiplier
  );

  let activeTDEE;

  if (result.source === 'observed') {
    db.prepare(`
      INSERT INTO tdee_history (date, observed_tdee, formula_tdee, window_days, coverage_pct, mean_intake, rolling_weight_start, rolling_weight_end, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'observed')
    `).run(today, result.observed_tdee, result.formula_tdee, result.window_days, result.coverage_pct,
      result.mean_intake, result.rolling_weight_start, result.rolling_weight_end);

    db.prepare(`
      UPDATE goal SET observed_tdee = ?, tdee_source = 'observed', last_tdee_compute_date = ? WHERE id = 1
    `).run(result.observed_tdee, today);

    activeTDEE = result.observed_tdee;
  } else {
    db.prepare(`
      INSERT INTO tdee_history (date, observed_tdee, formula_tdee, window_days, coverage_pct, mean_intake, rolling_weight_start, rolling_weight_end, source)
      VALUES (?, NULL, ?, NULL, ?, NULL, NULL, NULL, 'formula')
    `).run(today, formulaTDEE, result.coverage_pct || null);

    activeTDEE = goal.observed_tdee || formulaTDEE;
    const tdeeSource = goal.observed_tdee ? goal.tdee_source : 'formula';

    db.prepare(`
      UPDATE goal SET tdee_source = ?, last_tdee_compute_date = ? WHERE id = 1
    `).run(tdeeSource, today);
  }

  // Re-derive targets from best available TDEE
  if (rollingAvg) {
    const macros = deriveMacrosFromTDEE(activeTDEE, goal.deficit_pct, rollingAvg);
    const delta = Math.abs(macros.calorie_target - goal.current_calorie_target);

    if (!goal.calorie_override && delta > 150) {
      // Large change — store as pending, require user acceptance
      db.prepare(`
        UPDATE goal SET pending_calorie_target = ?, pending_tdee = ? WHERE id = 1
      `).run(macros.calorie_target, activeTDEE);
    } else {
      // Small change or user has override — auto-apply
      db.prepare(`
        UPDATE goal SET
          current_calorie_target = CASE WHEN calorie_override = 0 THEN ? ELSE current_calorie_target END,
          current_protein_target_g = CASE WHEN protein_override = 0 THEN ? ELSE current_protein_target_g END,
          current_fat_target_g = CASE WHEN fat_override = 0 THEN ? ELSE current_fat_target_g END,
          current_carb_target_g = CASE WHEN carb_override = 0 THEN ? ELSE current_carb_target_g END,
          pending_calorie_target = NULL, pending_tdee = NULL
        WHERE id = 1
      `).run(macros.calorie_target, macros.protein_target, macros.fat_target, macros.carb_target);
    }
  }
}

function estimateTargetDate(startWeight, goalWeight, startDate) {
  const weeklyLoss = startWeight * 0.006; // 0.6% bodyweight/week
  const weeksNeeded = (startWeight - goalWeight) / weeklyLoss;
  const d = new Date(startDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.round(weeksNeeded * 7));
  return d.toISOString().split('T')[0];
}

// GET /api/goal
router.get('/', (req, res) => {
  const db = getDB();
  let goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  if (!goal) {
    db.prepare(`INSERT INTO goal (id) VALUES (1)`).run();
    goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  }

  // Weekly TDEE recompute on goal fetch
  weeklyTDEERecompute(db);
  goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();

  const rollingAvg = get7DayRollingAvg(db);
  const tdeeResult = getTDEE(db, goal);

  // Compute targets from the active TDEE (observed when available, else formula)
  let computed = null;
  if (rollingAvg) {
    const macros = deriveMacrosFromTDEE(tdeeResult.tdee, goal.deficit_pct, rollingAvg);
    computed = { ...macros, bmr: tdeeResult.bmr, tdee: tdeeResult.tdee, source: tdeeResult.source, formula_tdee: tdeeResult.formula_tdee };
  }

  // Observed TDEE info for display
  const tdeeInfo = computeObservedTDEE(db, goal);

  res.json({
    ...goal,
    rolling_avg_weight: rollingAvg,
    computed_targets: computed,
    tdee_info: tdeeInfo,
  });
});

// PUT /api/goal
router.put('/', (req, res) => {
  const db = getDB();
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const updates = { ...goal, ...req.body, id: 1 };

  // Recalculate target date if weight goals changed
  if (!updates.target_date && updates.start_date) {
    updates.target_date = estimateTargetDate(updates.start_weight_kg, updates.goal_weight_kg, updates.start_date);
  }

  db.prepare(`
    UPDATE goal SET
      start_weight_kg=?, goal_weight_kg=?, start_date=?, target_date=?,
      height_cm=?, age=?, activity_multiplier=?,
      current_calorie_target=?, current_protein_target_g=?, current_fat_target_g=?, current_carb_target_g=?,
      current_fiber_target_g=?, current_sugar_limit_g=?, water_target_ml=?,
      calorie_override=?, protein_override=?, fat_override=?, carb_override=?,
      weekly_point_threshold=?, deficit_pct=?,
      enable_chest_measurement=?, enable_hips_measurement=?,
      rest_day_reduction=?, reward_credit_amount=?,
      maintenance_start=?, maintenance_end=?,
      goal_date=?, waist_goal_cm=?,
      step_target_weekday=?, step_target_weekend=?
    WHERE id=1
  `).run(
    updates.start_weight_kg, updates.goal_weight_kg, updates.start_date, updates.target_date,
    updates.height_cm, updates.age, updates.activity_multiplier,
    updates.current_calorie_target, updates.current_protein_target_g, updates.current_fat_target_g, updates.current_carb_target_g,
    updates.current_fiber_target_g || 32, updates.current_sugar_limit_g || 50, updates.water_target_ml || 3000,
    updates.calorie_override ? 1 : 0, updates.protein_override ? 1 : 0,
    updates.fat_override ? 1 : 0, updates.carb_override ? 1 : 0,
    updates.weekly_point_threshold || 315,
    Math.max(0.15, Math.min(0.25, parseFloat(updates.deficit_pct) || 0.25)),
    updates.enable_chest_measurement ? 1 : 0, updates.enable_hips_measurement ? 1 : 0,
    Math.max(100, Math.min(250, parseInt(updates.rest_day_reduction) || 150)),
    parseFloat(updates.reward_credit_amount) || 2000,
    updates.maintenance_start || null, updates.maintenance_end || null,
    updates.goal_date || null, updates.waist_goal_cm || null,
    parseInt(updates.step_target_weekday) || 12000,
    parseInt(updates.step_target_weekend) || 10000,
  );

  res.json(db.prepare('SELECT * FROM goal WHERE id = 1').get());
});

// POST /api/goal/recalculate — recompute macro targets from rolling average weight
router.post('/recalculate', (req, res) => {
  const db = getDB();
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const rollingAvg = get7DayRollingAvg(db);

  if (!rollingAvg) return res.status(400).json({ error: 'No weight data yet to recalculate from' });

  // Use observed TDEE if available, else formula
  const activeTDEE = goal.observed_tdee || computeFormulaTDEE(rollingAvg, goal.height_cm, goal.age, goal.activity_multiplier).tdee;
  const macros = deriveMacrosFromTDEE(activeTDEE, goal.deficit_pct, rollingAvg);
  const changes = [];
  const today = todayIST();

  if (!goal.calorie_override && goal.current_calorie_target !== macros.calorie_target) {
    changes.push(`Calorie target: ${Math.round(goal.current_calorie_target)} → ${macros.calorie_target} kcal`);
  }
  if (!goal.protein_override && goal.current_protein_target_g !== macros.protein_target) {
    changes.push(`Protein target: ${Math.round(goal.current_protein_target_g)}g → ${macros.protein_target}g`);
  }

  db.prepare(`
    UPDATE goal SET
      current_calorie_target = CASE WHEN calorie_override = 0 THEN ? ELSE current_calorie_target END,
      current_protein_target_g = CASE WHEN protein_override = 0 THEN ? ELSE current_protein_target_g END,
      current_fat_target_g = CASE WHEN fat_override = 0 THEN ? ELSE current_fat_target_g END,
      current_carb_target_g = CASE WHEN carb_override = 0 THEN ? ELSE current_carb_target_g END,
      last_recalibration_date = ?
    WHERE id = 1
  `).run(macros.calorie_target, macros.protein_target, macros.fat_target, macros.carb_target, today);

  res.json({
    rolling_avg_weight: Math.round(rollingAvg * 100) / 100,
    computed: { ...macros, tdee: activeTDEE, source: goal.tdee_source || 'formula' },
    changes,
    goal: db.prepare('SELECT * FROM goal WHERE id = 1').get()
  });
});

// POST /api/goal/accept-tdee — accept pending calorie change
router.post('/accept-tdee', (req, res) => {
  const db = getDB();
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  if (!goal?.pending_calorie_target || !goal?.pending_tdee) {
    return res.status(400).json({ error: 'No pending TDEE change' });
  }

  const rollingAvg = get7DayRollingAvg(db);
  const weight = rollingAvg || goal.start_weight_kg;
  const macros = deriveMacrosFromTDEE(goal.pending_tdee, goal.deficit_pct, weight);

  db.prepare(`
    UPDATE goal SET
      current_calorie_target = CASE WHEN calorie_override = 0 THEN ? ELSE current_calorie_target END,
      current_protein_target_g = CASE WHEN protein_override = 0 THEN ? ELSE current_protein_target_g END,
      current_fat_target_g = CASE WHEN fat_override = 0 THEN ? ELSE current_fat_target_g END,
      current_carb_target_g = CASE WHEN carb_override = 0 THEN ? ELSE current_carb_target_g END,
      pending_calorie_target = NULL, pending_tdee = NULL
    WHERE id = 1
  `).run(macros.calorie_target, macros.protein_target, macros.fat_target, macros.carb_target);

  res.json(db.prepare('SELECT * FROM goal WHERE id = 1').get());
});

// POST /api/goal/dismiss-tdee — dismiss pending calorie change
router.post('/dismiss-tdee', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE goal SET pending_calorie_target = NULL, pending_tdee = NULL WHERE id = 1').run();
  res.json(db.prepare('SELECT * FROM goal WHERE id = 1').get());
});

// GET /api/goal/tdee-history — audit trail
router.get('/tdee-history', (req, res) => {
  const db = getDB();
  const history = db.prepare('SELECT * FROM tdee_history ORDER BY date DESC LIMIT 20').all();
  res.json(history);
});

module.exports = router;
module.exports.computeMacros = computeMacros;
module.exports.get7DayRollingAvg = get7DayRollingAvg;
module.exports.getTDEE = getTDEE;
module.exports.computeObservedTDEE = computeObservedTDEE;
module.exports.weeklyTDEERecompute = weeklyTDEERecompute;
module.exports.deriveMacrosFromTDEE = deriveMacrosFromTDEE;
