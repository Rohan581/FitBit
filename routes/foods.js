const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET /api/foods?q=search&category=staple
router.get('/', (req, res) => {
  const db = getDB();
  const { q, category } = req.query;

  let sql = 'SELECT * FROM foods WHERE 1=1';
  const params = [];

  if (q) {
    sql += ' AND name LIKE ?';
    params.push(`%${q}%`);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  // Sort: favorites first, then staples, then by name
  sql += ` ORDER BY is_favorite DESC, CASE category
    WHEN 'staple' THEN 1
    WHEN 'home-cooked' THEN 2
    WHEN 'snack' THEN 3
    WHEN 'restaurant' THEN 4
    ELSE 5
  END, name`;

  const foods = db.prepare(sql).all(...params);
  res.json(foods);
});

// GET /api/foods/recents — last 10 distinct logged foods
router.get('/recents', (req, res) => {
  const db = getDB();
  const recents = db.prepare(`
    SELECT DISTINCT f.* FROM food_logs fl
    JOIN foods f ON f.id = fl.food_id
    WHERE fl.food_id IS NOT NULL
    ORDER BY fl.logged_at DESC
    LIMIT 10
  `).all();
  res.json(recents);
});

// GET /api/foods/favorites
router.get('/favorites', (req, res) => {
  const db = getDB();
  const favs = db.prepare('SELECT * FROM foods WHERE is_favorite = 1 ORDER BY name').all();
  res.json(favs);
});

// POST /api/foods — add custom food
router.post('/', (req, res) => {
  const { name, category = 'custom', serving_unit, serving_size = 1, calories, protein_g = 0, carbs_g = 0, fat_g = 0, fiber_g = 0, sugar_g = 0, units } = req.body;

  if (!name || !serving_unit || calories == null) {
    return res.status(400).json({ error: 'name, serving_unit and calories are required' });
  }

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO foods (name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, is_custom, units)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, units ? JSON.stringify(units) : null);

  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(food);
});

// PUT /api/foods/:id
router.put('/:id', (req, res) => {
  const db = getDB();
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  if (!food) return res.status(404).json({ error: 'Food not found' });

  const { name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, is_favorite, units, default_unit } = req.body;
  db.prepare(`
    UPDATE foods SET name=?, category=?, serving_unit=?, serving_size=?, calories=?, protein_g=?, carbs_g=?, fat_g=?, fiber_g=?, sugar_g=?, is_favorite=?, units=?, default_unit=?
    WHERE id=?
  `).run(
    name ?? food.name, category ?? food.category, serving_unit ?? food.serving_unit,
    serving_size ?? food.serving_size, calories ?? food.calories,
    protein_g ?? food.protein_g, carbs_g ?? food.carbs_g, fat_g ?? food.fat_g,
    fiber_g ?? food.fiber_g, sugar_g ?? food.sugar_g,
    is_favorite ?? food.is_favorite,
    units !== undefined ? (units ? JSON.stringify(units) : null) : food.units,
    default_unit ?? food.default_unit,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id));
});

// PATCH /api/foods/:id/favorite — toggle favorite
router.patch('/:id/favorite', (req, res) => {
  const db = getDB();
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  if (!food) return res.status(404).json({ error: 'Food not found' });
  const newVal = food.is_favorite ? 0 : 1;
  db.prepare('UPDATE foods SET is_favorite = ? WHERE id = ?').run(newVal, req.params.id);
  res.json({ ...food, is_favorite: newVal });
});

// DELETE /api/foods/:id — only custom foods
router.delete('/:id', (req, res) => {
  const db = getDB();
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  if (!food) return res.status(404).json({ error: 'Food not found' });
  if (!food.is_custom) return res.status(403).json({ error: 'Cannot delete built-in foods' });

  db.prepare('DELETE FROM foods WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
