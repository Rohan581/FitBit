const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

function computeMacros(weight_kg, height_cm, age, activity_multiplier) {
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  const tdee = bmr * activity_multiplier;
  const calorie_target = Math.round(tdee - 550);
  const protein_target = Math.round(2 * weight_kg);
  const fat_target = Math.round((calorie_target * 0.25) / 9);
  const carb_target = Math.round((calorie_target - protein_target * 4 - fat_target * 9) / 4);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calorie_target, protein_target, fat_target, carb_target };
}

function get7DayRollingAvg(db) {
  const recent = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date DESC, logged_at DESC LIMIT 7').all();
  if (recent.length === 0) return null;
  return recent.reduce((s, w) => s + w.weight_kg, 0) / recent.length;
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

  const rollingAvg = get7DayRollingAvg(db);
  const computed = rollingAvg
    ? computeMacros(rollingAvg, goal.height_cm, goal.age, goal.activity_multiplier)
    : null;

  res.json({ ...goal, rolling_avg_weight: rollingAvg, computed_targets: computed });
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
      weekly_point_threshold=?
    WHERE id=1
  `).run(
    updates.start_weight_kg, updates.goal_weight_kg, updates.start_date, updates.target_date,
    updates.height_cm, updates.age, updates.activity_multiplier,
    updates.current_calorie_target, updates.current_protein_target_g, updates.current_fat_target_g, updates.current_carb_target_g,
    updates.current_fiber_target_g || 32, updates.current_sugar_limit_g || 50, updates.water_target_ml || 3000,
    updates.calorie_override ? 1 : 0, updates.protein_override ? 1 : 0,
    updates.fat_override ? 1 : 0, updates.carb_override ? 1 : 0,
    updates.weekly_point_threshold || 350
  );

  res.json(db.prepare('SELECT * FROM goal WHERE id = 1').get());
});

// POST /api/goal/recalculate — recompute macro targets from rolling average weight
router.post('/recalculate', (req, res) => {
  const db = getDB();
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const rollingAvg = get7DayRollingAvg(db);

  if (!rollingAvg) return res.status(400).json({ error: 'No weight data yet to recalculate from' });

  const computed = computeMacros(rollingAvg, goal.height_cm, goal.age, goal.activity_multiplier);
  const changes = [];
  const today = todayIST();

  if (!goal.calorie_override && goal.current_calorie_target !== computed.calorie_target) {
    changes.push(`Calorie target: ${Math.round(goal.current_calorie_target)} → ${computed.calorie_target} kcal`);
  }
  if (!goal.protein_override && goal.current_protein_target_g !== computed.protein_target) {
    changes.push(`Protein target: ${Math.round(goal.current_protein_target_g)}g → ${computed.protein_target}g`);
  }

  db.prepare(`
    UPDATE goal SET
      current_calorie_target = CASE WHEN calorie_override = 0 THEN ? ELSE current_calorie_target END,
      current_protein_target_g = CASE WHEN protein_override = 0 THEN ? ELSE current_protein_target_g END,
      current_fat_target_g = CASE WHEN fat_override = 0 THEN ? ELSE current_fat_target_g END,
      current_carb_target_g = CASE WHEN carb_override = 0 THEN ? ELSE current_carb_target_g END,
      last_recalibration_date = ?
    WHERE id = 1
  `).run(computed.calorie_target, computed.protein_target, computed.fat_target, computed.carb_target, today);

  res.json({
    rolling_avg_weight: Math.round(rollingAvg * 100) / 100,
    computed,
    changes,
    goal: db.prepare('SELECT * FROM goal WHERE id = 1').get()
  });
});

module.exports = router;
module.exports.computeMacros = computeMacros;
module.exports.get7DayRollingAvg = get7DayRollingAvg;
