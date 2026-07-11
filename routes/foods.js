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

  // Sort: staples first, then by name
  sql += ` ORDER BY CASE category
    WHEN 'staple' THEN 1
    WHEN 'home-cooked' THEN 2
    WHEN 'snack' THEN 3
    WHEN 'restaurant' THEN 4
    ELSE 5
  END, name`;

  const foods = db.prepare(sql).all(...params);
  res.json(foods);
});

// POST /api/foods — add custom food
router.post('/', (req, res) => {
  const { name, category = 'custom', serving_unit, serving_size = 1, calories, protein_g = 0, carbs_g = 0, fat_g = 0 } = req.body;

  if (!name || !serving_unit || calories == null) {
    return res.status(400).json({ error: 'name, serving_unit and calories are required' });
  }

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO foods (name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g, is_custom)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g);

  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(food);
});

// PUT /api/foods/:id
router.put('/:id', (req, res) => {
  const db = getDB();
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id);
  if (!food) return res.status(404).json({ error: 'Food not found' });

  const { name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g } = req.body;
  db.prepare(`
    UPDATE foods SET name=?, category=?, serving_unit=?, serving_size=?, calories=?, protein_g=?, carbs_g=?, fat_g=?
    WHERE id=?
  `).run(
    name ?? food.name, category ?? food.category, serving_unit ?? food.serving_unit,
    serving_size ?? food.serving_size, calories ?? food.calories,
    protein_g ?? food.protein_g, carbs_g ?? food.carbs_g, fat_g ?? food.fat_g,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM foods WHERE id = ?').get(req.params.id));
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
