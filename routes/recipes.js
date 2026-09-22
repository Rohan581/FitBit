const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// ── Helpers ────────────────────────────────────────────────────────
function parseJson(val, fallback) {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function recipeRow(r) {
  return {
    ...r,
    tags: parseJson(r.tags, []),
    per_serving: parseJson(r.per_serving, {}),
    ingredients: parseJson(r.ingredients, []),
    steps: parseJson(r.steps, []),
    pairs_with: parseJson(r.pairs_with, []),
  };
}

// Computed filter helpers
function proteinPer100kcal(ps) {
  if (!ps.calories || ps.calories === 0) return 0;
  return (ps.protein_g / ps.calories) * 100;
}

// ── GET /api/recipes ──────────────────────────────────────────────
router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM recipes WHERE is_hidden = 0 ORDER BY title COLLATE NOCASE').all();
  const recipes = rows.map(recipeRow);

  // Search
  let filtered = recipes;
  const q = (req.query.q || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(r => {
      if (r.title.toLowerCase().includes(q)) return true;
      const ings = r.ingredients || [];
      return ings.some(i => i.name && i.name.toLowerCase().includes(q));
    });
  }

  // Filter by chip
  const chip = req.query.chip;
  if (chip) {
    const chips = chip.split(',');
    filtered = filtered.filter(r => {
      const ps = r.per_serving;
      for (const c of chips) {
        switch (c) {
          case 'high-protein':
            if (proteinPer100kcal(ps) < 10) return false;
            break;
          case 'air-fryer':
            if (!r.tags.includes('air-fryer')) return false;
            break;
          case 'high-fibre':
            if (!ps.fiber_g || ps.fiber_g < 4) return false;
            break;
          case 'under-300':
            if (!ps.calories || ps.calories >= 300) return false;
            break;
          case 'quick':
            if (!r.total_time_min || r.total_time_min > 20) return false;
            break;
          case 'meal-prep':
            if (!r.tags.includes('meal-prep')) return false;
            break;
          case 'vegetarian':
            if (!r.tags.includes('vegetarian')) return false;
            break;
          case 'sides-dips':
            if (!r.tags.includes('side') && !r.tags.includes('dip') && !r.tags.includes('chutney') && !r.tags.includes('condiment')) return false;
            break;
        }
      }
      return true;
    });
  }

  // Sort
  const sort = req.query.sort || 'protein-density';
  switch (sort) {
    case 'protein-density':
      filtered.sort((a, b) => proteinPer100kcal(b.per_serving) - proteinPer100kcal(a.per_serving));
      break;
    case 'calories':
      filtered.sort((a, b) => (a.per_serving.calories || 0) - (b.per_serving.calories || 0));
      break;
    case 'time':
      filtered.sort((a, b) => (a.total_time_min || 999) - (b.total_time_min || 999));
      break;
    case 'recently-cooked': {
      const batches = db.prepare('SELECT recipe_id, MAX(cooked_on) as last FROM recipe_batches GROUP BY recipe_id').all();
      const lastCooked = {};
      for (const b of batches) lastCooked[b.recipe_id] = b.last;
      filtered.sort((a, b) => (lastCooked[b.id] || '').localeCompare(lastCooked[a.id] || ''));
      break;
    }
  }

  // Sections
  const favourites = filtered.filter(r => r.is_favourite);

  const batchRows = db.prepare('SELECT DISTINCT recipe_id FROM recipe_batches ORDER BY cooked_on DESC LIMIT 20').all();
  const recentIds = new Set(batchRows.map(b => b.recipe_id));
  const recentlyCooked = filtered.filter(r => recentIds.has(r.id));

  res.json({ recipes: filtered, favourites, recentlyCooked, total: filtered.length });
});

// ── GET /api/recipes/:id ──────────────────────────────────────────
router.get('/:id', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Recipe not found' });

  const recipe = recipeRow(row);

  // Resolve pairs_with ids to recipe stubs
  const pairIds = recipe.pairs_with || [];
  let pairRecipes = [];
  if (pairIds.length > 0) {
    pairRecipes = db.prepare(`SELECT id, title, icon, seed_key FROM recipes WHERE id IN (${pairIds.map(() => '?').join(',')})`)
      .all(...pairIds);
  }

  res.json({ ...recipe, pair_recipes: pairRecipes });
});

// ── POST /api/recipes ─────────────────────────────────────────────
router.post('/', (req, res) => {
  const db = getDB();
  const b = req.body;
  const result = db.prepare(`
    INSERT INTO recipes (title, source, icon, servings, cooked_yield_g, total_time_min,
      tags, per_serving, ingredients, steps, notes, my_notes, pairs_with, is_favourite)
    VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0)
  `).run(
    b.title, b.icon || '🍽️', b.servings || 1, b.cooked_yield_g || null,
    b.total_time_min || null, JSON.stringify(b.tags || []),
    JSON.stringify(b.per_serving || {}), JSON.stringify(b.ingredients || []),
    JSON.stringify(b.steps || []), b.notes || null, b.my_notes || null
  );
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(recipeRow(recipe));
});

// ── PUT /api/recipes/:id ──────────────────────────────────────────
router.put('/:id', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Recipe not found' });

  const b = req.body;
  db.prepare(`
    UPDATE recipes SET title=?, icon=?, servings=?, cooked_yield_g=?, total_time_min=?,
      tags=?, per_serving=?, ingredients=?, steps=?, notes=?, my_notes=?,
      user_edited=1, updated_at=datetime('now')
    WHERE id=?
  `).run(
    b.title ?? existing.title, b.icon ?? existing.icon,
    b.servings ?? existing.servings, b.cooked_yield_g ?? existing.cooked_yield_g,
    b.total_time_min ?? existing.total_time_min,
    b.tags ? JSON.stringify(b.tags) : existing.tags,
    b.per_serving ? JSON.stringify(b.per_serving) : existing.per_serving,
    b.ingredients ? JSON.stringify(b.ingredients) : existing.ingredients,
    b.steps ? JSON.stringify(b.steps) : existing.steps,
    b.notes ?? existing.notes, b.my_notes ?? existing.my_notes,
    req.params.id
  );
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  res.json(recipeRow(recipe));
});

// ── DELETE /api/recipes/:id ───────────────────────────────────────
router.delete('/:id', (req, res) => {
  const db = getDB();
  const r = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Recipe not found' });
  if (r.source !== 'user') return res.status(400).json({ error: 'Only user-created recipes can be deleted' });
  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/recipes/:id/favourite ───────────────────────────────
router.post('/:id/favourite', (req, res) => {
  const db = getDB();
  const r = db.prepare('SELECT id, is_favourite FROM recipes WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Recipe not found' });
  db.prepare('UPDATE recipes SET is_favourite = ? WHERE id = ?').run(r.is_favourite ? 0 : 1, r.id);
  res.json({ is_favourite: !r.is_favourite });
});

// ── POST /api/recipes/:id/hide ────────────────────────────────────
router.post('/:id/hide', (req, res) => {
  const db = getDB();
  const r = db.prepare('SELECT id, is_hidden FROM recipes WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Recipe not found' });
  db.prepare('UPDATE recipes SET is_hidden = ? WHERE id = ?').run(r.is_hidden ? 0 : 1, r.id);
  res.json({ is_hidden: !r.is_hidden });
});

// ── POST /api/recipes/:id/duplicate ───────────────────────────────
router.post('/:id/duplicate', (req, res) => {
  const db = getDB();
  const r = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Recipe not found' });
  const result = db.prepare(`
    INSERT INTO recipes (title, source, icon, servings, cooked_yield_g, total_time_min,
      tags, per_serving, ingredients, steps, notes, pairs_with)
    VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    r.title + ' (copy)', r.icon, r.servings, r.cooked_yield_g, r.total_time_min,
    r.tags, r.per_serving, r.ingredients, r.steps, r.notes, r.pairs_with || '[]'
  );
  const dup = db.prepare('SELECT * FROM recipes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(recipeRow(dup));
});

// ── Batches ───────────────────────────────────────────────────────

// GET /api/recipes/batches/all
router.get('/batches/all', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT rb.*, r.title, r.icon, r.per_serving, r.cooked_yield_g as recipe_yield_g,
           r.servings as recipe_servings
    FROM recipe_batches rb
    JOIN recipes r ON r.id = rb.recipe_id
    ORDER BY rb.cooked_on DESC
  `).all();

  const today = todayIST();
  const fourDaysAgo = new Date(new Date(today).getTime() - 4 * 86400000).toISOString().split('T')[0];

  const batches = rows.map(b => {
    const ps = parseJson(b.per_serving, {});
    const scale = b.scale_factor || 1;
    const portions = b.portions || 1;

    // Total batch macros = per_serving * recipe_servings * scale_factor
    const recipeSrv = b.recipe_servings || 1;
    const totalCal = (ps.calories || 0) * recipeSrv * scale;
    const totalProtein = (ps.protein_g || 0) * recipeSrv * scale;

    // Per portion from this batch
    const perPortionCal = totalCal / portions;
    const perPortionProtein = totalProtein / portions;

    // Per 100g (use measured weight if available, else scaled yield)
    const weight = b.measured_weight_g || (b.recipe_yield_g ? b.recipe_yield_g * scale : null);
    const per100Cal = weight ? (totalCal / weight) * 100 : null;

    // Portions logged from this batch
    const logged = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM food_logs WHERE batch_id = ?').get(b.id);
    const portionsLeft = Math.max(0, portions - (logged.total || 0));

    return {
      ...b,
      per_serving: ps,
      per_portion_calories: Math.round(perPortionCal),
      per_portion_protein: Math.round(perPortionProtein * 10) / 10,
      per_100g_calories: per100Cal ? Math.round(per100Cal) : null,
      portions_left: portionsLeft,
    };
  });

  const active = batches.filter(b => !b.finished && b.cooked_on >= fourDaysAgo);
  const finished = batches.filter(b => b.finished || b.cooked_on < fourDaysAgo);

  res.json({ active, finished });
});

// POST /api/recipes/batches — "I cooked this"
router.post('/batches', (req, res) => {
  const db = getDB();
  const { recipe_id, scale_factor, portions, measured_weight_g } = req.body;
  const recipe = db.prepare('SELECT id FROM recipes WHERE id = ?').get(recipe_id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

  const result = db.prepare(`
    INSERT INTO recipe_batches (recipe_id, cooked_on, scale_factor, portions, measured_weight_g, finished)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(recipe_id, todayIST(), scale_factor || 1, portions || 1, measured_weight_g || null);

  const batch = db.prepare('SELECT * FROM recipe_batches WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(batch);
});

// PUT /api/recipes/batches/:id — update batch (finish, etc.)
router.put('/batches/:id', (req, res) => {
  const db = getDB();
  const b = db.prepare('SELECT * FROM recipe_batches WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Batch not found' });

  if (req.body.finished !== undefined) {
    db.prepare('UPDATE recipe_batches SET finished = ? WHERE id = ?').run(req.body.finished ? 1 : 0, b.id);
  }
  if (req.body.portions !== undefined) {
    db.prepare('UPDATE recipe_batches SET portions = ? WHERE id = ?').run(req.body.portions, b.id);
  }
  if (req.body.measured_weight_g !== undefined) {
    db.prepare('UPDATE recipe_batches SET measured_weight_g = ? WHERE id = ?').run(req.body.measured_weight_g, b.id);
  }

  res.json(db.prepare('SELECT * FROM recipe_batches WHERE id = ?').get(b.id));
});

// ── Log a portion ─────────────────────────────────────────────────

// POST /api/recipes/log-portion
router.post('/log-portion', (req, res) => {
  const db = getDB();
  const { recipe_id, batch_id, servings, grams, meal_type, date } = req.body;

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipe_id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  const ps = parseJson(recipe.per_serving, {});

  let multiplier;
  let unit_used = 'serving';
  const logDate = date || todayIST();
  const meal = meal_type || defaultMeal();

  if (grams && batch_id) {
    // Logging by weight from a batch
    const batch = db.prepare('SELECT * FROM recipe_batches WHERE id = ?').get(batch_id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const scale = batch.scale_factor || 1;
    const recipeSrv = recipe.servings || 1;
    const totalWeight = batch.measured_weight_g || (recipe.cooked_yield_g ? recipe.cooked_yield_g * scale : null);
    if (!totalWeight) return res.status(400).json({ error: 'No weight data available for this batch' });

    // macros per gram = total batch macros / total weight
    const macroPerGram = {
      calories: (ps.calories * recipeSrv * scale) / totalWeight,
      protein_g: (ps.protein_g * recipeSrv * scale) / totalWeight,
      carbs_g: ((ps.carbs_g || 0) * recipeSrv * scale) / totalWeight,
      fat_g: ((ps.fat_g || 0) * recipeSrv * scale) / totalWeight,
      fiber_g: ((ps.fiber_g || 0) * recipeSrv * scale) / totalWeight,
      sugar_g: ((ps.sugar_g || 0) * recipeSrv * scale) / totalWeight,
    };

    const g = parseFloat(grams);
    const result = db.prepare(`
      INSERT INTO food_logs (date, meal_type, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, unit_used, recipe_id, batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logDate, meal, recipe.title, g,
      Math.round(macroPerGram.calories * g),
      Math.round(macroPerGram.protein_g * g * 10) / 10,
      Math.round(macroPerGram.carbs_g * g * 10) / 10,
      Math.round(macroPerGram.fat_g * g * 10) / 10,
      Math.round(macroPerGram.fiber_g * g * 10) / 10,
      Math.round(macroPerGram.sugar_g * g * 10) / 10,
      'g', recipe_id, batch_id
    );
    return res.status(201).json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid));
  }

  // Logging by servings
  const qty = parseFloat(servings) || 1;
  let scaledPs = ps;

  if (batch_id) {
    const batch = db.prepare('SELECT * FROM recipe_batches WHERE id = ?').get(batch_id);
    if (batch) {
      const scale = batch.scale_factor || 1;
      const recipeSrv = recipe.servings || 1;
      const portions = batch.portions || recipeSrv;
      // Per portion = total batch / portions
      scaledPs = {
        calories: (ps.calories * recipeSrv * scale) / portions,
        protein_g: (ps.protein_g * recipeSrv * scale) / portions,
        carbs_g: ((ps.carbs_g || 0) * recipeSrv * scale) / portions,
        fat_g: ((ps.fat_g || 0) * recipeSrv * scale) / portions,
        fiber_g: ((ps.fiber_g || 0) * recipeSrv * scale) / portions,
        sugar_g: ((ps.sugar_g || 0) * recipeSrv * scale) / portions,
      };
    }
  }

  const result = db.prepare(`
    INSERT INTO food_logs (date, meal_type, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, unit_used, recipe_id, batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    logDate, meal, recipe.title, qty,
    Math.round(scaledPs.calories * qty),
    Math.round((scaledPs.protein_g || 0) * qty * 10) / 10,
    Math.round((scaledPs.carbs_g || 0) * qty * 10) / 10,
    Math.round((scaledPs.fat_g || 0) * qty * 10) / 10,
    Math.round((scaledPs.fiber_g || 0) * qty * 10) / 10,
    Math.round((scaledPs.sugar_g || 0) * qty * 10) / 10,
    'serving', recipe_id, batch_id || null
  );
  res.status(201).json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid));
});

// ── Recipe search for food log ────────────────────────────────────
router.get('/search/for-food-log', (req, res) => {
  const db = getDB();
  const q = (req.query.q || '').trim().toLowerCase();

  // Recipes matching search
  let recipes = db.prepare('SELECT id, title, icon, source, per_serving, servings FROM recipes WHERE is_hidden = 0').all();
  if (q) {
    recipes = recipes.filter(r => r.title.toLowerCase().includes(q));
  }
  recipes = recipes.slice(0, 10).map(r => ({
    ...r,
    per_serving: parseJson(r.per_serving, {}),
    type: 'recipe',
  }));

  // Active batches
  const today = todayIST();
  const fourDaysAgo = new Date(new Date(today).getTime() - 4 * 86400000).toISOString().split('T')[0];
  let batches = db.prepare(`
    SELECT rb.*, r.title, r.icon, r.per_serving, r.servings as recipe_servings
    FROM recipe_batches rb JOIN recipes r ON r.id = rb.recipe_id
    WHERE rb.finished = 0 AND rb.cooked_on >= ?
  `).all(fourDaysAgo);

  if (q) {
    batches = batches.filter(b => b.title.toLowerCase().includes(q));
  }
  batches = batches.slice(0, 5).map(b => ({
    ...b,
    per_serving: parseJson(b.per_serving, {}),
    type: 'batch',
  }));

  res.json({ recipes, batches });
});

function defaultMeal() {
  const h = new Date(Date.now() + 330 * 60000).getUTCHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}

module.exports = router;
