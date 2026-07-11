const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET /api/saved-meals
router.get('/', (req, res) => {
  const db = getDB();
  const meals = db.prepare('SELECT * FROM saved_meals ORDER BY name').all();
  res.json(meals.map(m => ({ ...m, items: JSON.parse(m.items) })));
});

// POST /api/saved-meals
router.post('/', (req, res) => {
  const { name, items } = req.body;
  if (!name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'name and items[] are required' });
  }

  const db = getDB();
  let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;

  for (const item of items) {
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(item.food_id);
    if (!food) return res.status(400).json({ error: `Food ${item.food_id} not found` });
    const qty = item.quantity || 1;
    totalCal  += food.calories  * qty;
    totalPro  += food.protein_g * qty;
    totalCarb += food.carbs_g   * qty;
    totalFat  += food.fat_g     * qty;
  }

  const result = db.prepare(`
    INSERT INTO saved_meals (name, items, total_calories, total_protein_g, total_carbs_g, total_fat_g)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, JSON.stringify(items), Math.round(totalCal), Math.round(totalPro * 10) / 10, Math.round(totalCarb * 10) / 10, Math.round(totalFat * 10) / 10);

  const meal = db.prepare('SELECT * FROM saved_meals WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...meal, items: JSON.parse(meal.items) });
});

// DELETE /api/saved-meals/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  const meal = db.prepare('SELECT id FROM saved_meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Saved meal not found' });
  db.prepare('DELETE FROM saved_meals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
