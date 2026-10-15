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
  const calorie_target = Math.round(tdee * (1 - defPct));
  const protein_target = Math.max(160, Math.round(2 * weight_kg));
  const fat_target = Math.round((calorie_target * 0.26) / 9);
  const carb_target = Math.round((calorie_target - protein_target * 4 - fat_target * 9) / 4);
  return { calorie_target, protein_target, fat_target, carb_target };
}

function get7DayRollingAvg(db) {
  const recent = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date DESC, logged_at DESC LIMIT 7').all();
  if (recent.length === 0) return null;
  return recent.reduce((s, w) => s + w.weight_kg, 0) / recent.length;
}

// ── Observed TDEE computation ────────────────────────────────
// observedTDEE = meanDailyIntake + (weightChangeKg × 7700) / days
// Uses 7-day rolling avg at each end of the window for smoothing.
function computeObservedTDEE(db, goal) {
  const today = todayIST();
  const windowDays = 28;
  const minDays = 14;

  // Get all weight logs in the last 28 days
  const cutoff = new Date(today + 'T12:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const allWeights = db.prepare(
    'SELECT date, weight_kg FROM weight_logs WHERE date >= ? ORDER BY date ASC'
  ).all(cutoffStr);

  if (allWeights.length < 10) {
    return { source: 'formula', reason: 'fewer than 10 weight entries in window' };
  }

  // Compute 7-day rolling avg at start and end of window
  const allWeightsFull = db.prepare('SELECT date, weight_kg FROM weight_logs ORDER BY date ASC').all();
  function rollingAvgAt(targetDate, direction) {
    // Find entries near targetDate
    const idx = allWeightsFull.findIndex(w => w.date >= targetDate);
    if (idx < 0) return null;
    if (direction === 'start') {
      const window = allWeightsFull.slice(idx, Math.min(idx + 7, allWeightsFull.length));
      if (window.length < 3) return null;
      return window.reduce((s, w) => s + w.weight_kg, 0) / window.length;
    } else {
      // End: use last 7
      const end = allWeightsFull.length;
      const start = Math.max(0, end - 7);
      const window = allWeightsFull.slice(start, end);
      if (window.length < 3) return null;
      return window.reduce((s, w) => s + w.weight_kg, 0) / window.length;
    }
  }

  const rollingStart = rollingAvgAt(cutoffStr, 'start');
  const rollingEnd = rollingAvgAt(today, 'end');

  if (!rollingStart || !rollingEnd) {
    return { source: 'formula', reason: 'insufficient weight data for rolling averages' };
  }

  // Check food log coverage
  const foodDays = db.prepare(`
    SELECT COUNT(DISTINCT date) as cnt FROM food_logs WHERE date >= ?
  `).get(cutoffStr);

  const totalDaysInWindow = Math.round(
    (new Date(today + 'T12:00:00Z') - new Date(cutoffStr + 'T12:00:00Z')) / 86400000
  );
  const actualWindow = Math.max(minDays, totalDaysInWindow);
  const coveragePct = (foodDays.cnt / actualWindow) * 100;

  if (coveragePct < 80) {
    return {
      source: 'formula',
      reason: `food logged on ${foodDays.cnt} of ${actualWindow} days (${Math.round(coveragePct)}%) — need 80%`,
      coverage_pct: Math.round(coveragePct),
    };
  }

  // Compute mean daily intake over logged days
  const intakeData = db.prepare(`
    SELECT SUM(calories) / COUNT(DISTINCT date) as mean_intake
    FROM food_logs WHERE date >= ?
  `).get(cutoffStr);

  const meanIntake = intakeData.mean_intake || 0;
  const weightChangeKg = rollingEnd - rollingStart;
  const observedTDEE = meanIntake + (weightChangeKg * 7700) / actualWindow;

  // Sanity clamp: ±25% of formula TDEE
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
    window_days: actualWindow,
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

  if (result.source === 'observed') {
    // Store in tdee_history
    db.prepare(`
      INSERT INTO tdee_history (date, observed_tdee, formula_tdee, window_days, coverage_pct, mean_intake, rolling_weight_start, rolling_weight_end, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'observed')
    `).run(today, result.observed_tdee, result.formula_tdee, result.window_days, result.coverage_pct,
      result.mean_intake, result.rolling_weight_start, result.rolling_weight_end);

    db.prepare(`
      UPDATE goal SET observed_tdee = ?, tdee_source = 'observed', last_tdee_compute_date = ? WHERE id = 1
    `).run(result.observed_tdee, today);

    // Re-derive targets from observed TDEE if not overridden
    if (rollingAvg) {
      const macros = deriveMacrosFromTDEE(result.observed_tdee, goal.deficit_pct, rollingAvg);
      db.prepare(`
        UPDATE goal SET
          current_calorie_target = CASE WHEN calorie_override = 0 THEN ? ELSE current_calorie_target END,
          current_protein_target_g = CASE WHEN protein_override = 0 THEN ? ELSE current_protein_target_g END,
          current_fat_target_g = CASE WHEN fat_override = 0 THEN ? ELSE current_fat_target_g END,
          current_carb_target_g = CASE WHEN carb_override = 0 THEN ? ELSE current_carb_target_g END
        WHERE id = 1
      `).run(macros.calorie_target, macros.protein_target, macros.fat_target, macros.carb_target);
    }
  } else {
    // Store formula fallback in history
    db.prepare(`
      INSERT INTO tdee_history (date, observed_tdee, formula_tdee, window_days, coverage_pct, mean_intake, rolling_weight_start, rolling_weight_end, source)
      VALUES (?, NULL, ?, NULL, ?, NULL, NULL, NULL, 'formula')
    `).run(today, formulaTDEE, result.coverage_pct || null);

    // Keep using previous observed_tdee if we had one, else use formula
    if (!goal.observed_tdee) {
      db.prepare(`
        UPDATE goal SET tdee_source = 'formula', last_tdee_compute_date = ? WHERE id = 1
      `).run(today);
    } else {
      // Keep last good observed_tdee, just update compute date
      db.prepare(`UPDATE goal SET last_tdee_compute_date = ? WHERE id = 1`).run(today);
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
  const computed = rollingAvg
    ? computeMacros(rollingAvg, goal.height_cm, goal.age, goal.activity_multiplier, goal.deficit_pct)
    : null;

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
    Math.max(0.15, Math.min(0.28, parseFloat(updates.deficit_pct) || 0.25)),
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

// GET /api/goal/tdee-history — audit trail
router.get('/tdee-history', (req, res) => {
  const db = getDB();
  const history = db.prepare('SELECT * FROM tdee_history ORDER BY date DESC LIMIT 20').all();
  res.json(history);
});

module.exports = router;
module.exports.computeMacros = computeMacros;
module.exports.get7DayRollingAvg = get7DayRollingAvg;
module.exports.computeObservedTDEE = computeObservedTDEE;
module.exports.weeklyTDEERecompute = weeklyTDEERecompute;
