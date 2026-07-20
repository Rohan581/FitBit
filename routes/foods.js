const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

function searchRank(name, query) {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/[\s(\/,]+/).some(w => w.startsWith(query))) return 2;
  return 3;
}

// GET /api/foods?q=search&category=staple&categories=alcohol,beverage
router.get('/', (req, res) => {
  const db = getDB();
  const { q, category, categories } = req.query;
  const trimmedQ = (q || '').trim();

  let sql = 'SELECT * FROM foods WHERE 1=1';
  const params = [];

  if (trimmedQ) {
    sql += ' AND LOWER(name) LIKE ?';
    params.push(`%${trimmedQ.toLowerCase()}%`);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (categories) {
    const catList = categories.split(',').map(c => c.trim()).filter(Boolean);
    if (catList.length > 0) {
      sql += ` AND category IN (${catList.map(() => '?').join(',')})`;
      params.push(...catList);
    }
  }

  sql += ` ORDER BY is_favorite DESC, CASE category
    WHEN 'staple' THEN 1
    WHEN 'home-cooked' THEN 2
    WHEN 'snack' THEN 3
    WHEN 'beverage' THEN 4
    WHEN 'alcohol' THEN 5
    WHEN 'restaurant' THEN 6
    ELSE 7
  END, name`;

  let foods = db.prepare(sql).all(...params);

  // Rank and cap when searching
  if (trimmedQ) {
    const ql = trimmedQ.toLowerCase();
    foods.sort((a, b) => {
      const rankA = searchRank(a.name.toLowerCase(), ql);
      const rankB = searchRank(b.name.toLowerCase(), ql);
      if (rankA !== rankB) return rankA - rankB;
      if (b.is_favorite !== a.is_favorite) return b.is_favorite - a.is_favorite;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    foods = foods.slice(0, 20);
  }

  res.json(foods);
});

// GET /api/foods/recents — last 10 distinct logged foods
router.get('/recents', (req, res) => {
  const db = getDB();
  const { categories } = req.query;

  let sql = `
    SELECT DISTINCT f.* FROM food_logs fl
    JOIN foods f ON f.id = fl.food_id
    WHERE fl.food_id IS NOT NULL
  `;
  const params = [];

  if (categories) {
    const catList = categories.split(',').map(c => c.trim()).filter(Boolean);
    if (catList.length > 0) {
      sql += ` AND f.category IN (${catList.map(() => '?').join(',')})`;
      params.push(...catList);
    }
  }

  sql += ' ORDER BY fl.logged_at DESC LIMIT 10';
  const recents = db.prepare(sql).all(...params);
  res.json(recents);
});

// GET /api/foods/favorites
router.get('/favorites', (req, res) => {
  const db = getDB();
  const { categories } = req.query;

  let sql = 'SELECT * FROM foods WHERE is_favorite = 1';
  const params = [];

  if (categories) {
    const catList = categories.split(',').map(c => c.trim()).filter(Boolean);
    if (catList.length > 0) {
      sql += ` AND category IN (${catList.map(() => '?').join(',')})`;
      params.push(...catList);
    }
  }

  sql += ' ORDER BY name';
  const favs = db.prepare(sql).all(...params);
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
