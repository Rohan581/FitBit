const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// GET /api/food-logs?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayStr();
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
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  res.json({ date, grouped, all: logs, totals });
});

// POST /api/food-logs
// Body options:
// 1. Log from food: { date, meal_type, food_id, quantity }
// 2. Log a saved meal: { date, meal_type, saved_meal_id }
// 3. Log custom entry: { date, meal_type, food_name, calories, protein_g, carbs_g, fat_g }
router.post('/', (req, res) => {
  const db = getDB();
  const date = req.body.date || todayStr();
  const meal_type = req.body.meal_type || 'snack';

  const insertLog = db.prepare(`
    INSERT INTO food_logs (date, meal_type, food_id, saved_meal_id, food_name, quantity, calories, protein_g, carbs_g, fat_g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Case 1: logging a saved meal — expand into food_log entries per food item
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
          food.calories * qty, food.protein_g * qty, food.carbs_g * qty, food.fat_g * qty
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
      }
    });
  }

  // Case 2: logging a specific food from the database
  if (req.body.food_id) {
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.body.food_id);
    if (!food) return res.status(404).json({ error: 'Food not found' });
    const qty = parseFloat(req.body.quantity) || 1;
    const result = insertLog.run(
      date, meal_type, food.id, null, food.name, qty,
      food.calories * qty, food.protein_g * qty, food.carbs_g * qty, food.fat_g * qty
    );
    return res.status(201).json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid));
  }

  // Case 3: custom/manual entry
  const { food_name, calories, protein_g = 0, carbs_g = 0, fat_g = 0 } = req.body;
  if (!food_name || calories == null) {
    return res.status(400).json({ error: 'food_name and calories are required for manual entries' });
  }
  const result = insertLog.run(date, meal_type, null, null, food_name, 1, calories, protein_g, carbs_g, fat_g);
  res.status(201).json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid));
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
