const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// GET /api/food-logs?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const logs = db.prepare('SELECT * FROM food_logs WHERE date = ? ORDER BY logged_at').all(date);

  // Group by meal_type
  const grouped = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const log of logs) {
    const key = grouped[log.meal_type] ? log.meal_type : 'snack';
    grouped[key].push(log);
  }

  const totals = logs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein_g: acc.protein_g + l.protein_g,
    carbs_g: acc.carbs_g + l.carbs_g,
    fat_g: acc.fat_g + l.fat_g,
    fiber_g: acc.fiber_g + (l.fiber_g || 0),
    sugar_g: acc.sugar_g + (l.sugar_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 });

  res.json({ date, grouped, all: logs, totals });
});

// POST /api/food-logs
router.post('/', (req, res) => {
  const db = getDB();
  const date = req.body.date || todayIST();
  const meal_type = req.body.meal_type || 'snack';

  const insertLog = db.prepare(`
    INSERT INTO food_logs (date, meal_type, food_id, saved_meal_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, unit_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Case 1: logging a saved meal
  if (req.body.saved_meal_id) {
    const meal = db.prepare('SELECT * FROM saved_meals WHERE id = ?').get(req.body.saved_meal_id);
    if (!meal) return res.status(404).json({ error: 'Saved meal not found' });

    const items = JSON.parse(meal.items);
    const logEntries = db.transaction(() => {
      const ids = [];
      for (const item of items) {
        const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(item.food_id);
        if (!food) continue;
        const qty = item.quantity || 1;
        const result = insertLog.run(
          date, meal_type, food.id, meal.id, food.name, qty,
          food.calories * qty, food.protein_g * qty, food.carbs_g * qty, food.fat_g * qty,
          (food.fiber_g || 0) * qty, (food.sugar_g || 0) * qty, null
        );
        ids.push(result.lastInsertRowid);
      }
      return ids;
    })();

    return res.status(201).json({
      saved_meal_id: meal.id,
      meal_name: meal.name,
      entries_logged: logEntries.length,
      totals: {
        calories: meal.total_calories,
        protein_g: meal.total_protein_g,
        carbs_g: meal.total_carbs_g,
        fat_g: meal.total_fat_g,
        fiber_g: meal.total_fiber_g || 0,
        sugar_g: meal.total_sugar_g || 0,
      }
    });
  }

  // Case 2: logging a specific food from the database
  if (req.body.food_id) {
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.body.food_id);
    if (!food) return res.status(404).json({ error: 'Food not found' });
    const qty = parseFloat(req.body.quantity) || 1;
    const unitUsed = req.body.unit_used || null;

    // If a unit is specified, apply its multiplier
    let multiplier = qty;
    if (unitUsed && food.units) {
      const units = JSON.parse(food.units);
      const unitDef = units.find(u => u.unit === unitUsed);
      if (unitDef) {
        multiplier = qty * unitDef.multiplier;
      }
    }

    const result = insertLog.run(
      date, meal_type, food.id, null, food.name, qty,
      food.calories * multiplier, food.protein_g * multiplier, food.carbs_g * multiplier, food.fat_g * multiplier,
      (food.fiber_g || 0) * multiplier, (food.sugar_g || 0) * multiplier, unitUsed
    );
    return res.status(201).json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid));
  }

  // Case 3: custom/manual entry
  const { food_name, calories, protein_g = 0, carbs_g = 0, fat_g = 0, fiber_g = 0, sugar_g = 0 } = req.body;
  if (!food_name || calories == null) {
    return res.status(400).json({ error: 'food_name and calories are required for manual entries' });
  }
  const result = insertLog.run(date, meal_type, null, null, food_name, 1, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, null);
  res.status(201).json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid));
});

// POST /api/food-logs/copy-yesterday — copy a meal from yesterday to today
router.post('/copy-yesterday', (req, res) => {
  const db = getDB();
  const { meal_type } = req.body;
  const today = req.body.date || todayIST();

  // Calculate yesterday
  const d = new Date(today + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterday = d.toISOString().split('T')[0];

  const yesterdayLogs = db.prepare(
    'SELECT * FROM food_logs WHERE date = ? AND meal_type = ? ORDER BY logged_at'
  ).all(yesterday, meal_type);

  if (yesterdayLogs.length === 0) {
    return res.status(404).json({ error: 'No entries found for yesterday\'s ' + meal_type });
  }

  const insertLog = db.prepare(`
    INSERT INTO food_logs (date, meal_type, food_id, saved_meal_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, unit_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const ids = db.transaction(() => {
    const newIds = [];
    for (const log of yesterdayLogs) {
      const result = insertLog.run(
        today, meal_type, log.food_id, log.saved_meal_id, log.food_name, log.quantity,
        log.calories, log.protein_g, log.carbs_g, log.fat_g, log.fiber_g || 0, log.sugar_g || 0, log.unit_used
      );
      newIds.push(result.lastInsertRowid);
    }
    return newIds;
  })();

  res.status(201).json({ copied: ids.length, meal_type });
});

// DELETE /api/food-logs/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  const log = db.prepare('SELECT id FROM food_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Log entry not found' });
  db.prepare('DELETE FROM food_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
