const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');
const { parseLog } = require('../lib/parseLogLine');
const { dayReview, dayVerdict, contributors } = require('../lib/dayReview');
const { estimateMeal, EstimateError, MAX_DESCRIPTION_CHARS } = require('../lib/geminiEstimate');

// GET /api/food-logs?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const logs = db.prepare('SELECT * FROM food_logs WHERE date = ? ORDER BY logged_at').all(date);

  // Group by meal_type
  const grouped = { breakfast: [], lunch: [], dinner: [], snack: [], drinks: [] };
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

  // Day review: what the numbers mean and which items caused them. Computed
  // server-side so Trends and History can reuse it without duplicating the rules.
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get() || {};
  const inProgress = date === todayIST();
  const review = dayReview(logs, goal, { inProgress });

  // Per-macro breakdown, so tapping a macro tile needs no extra round trip.
  const breakdown = {};
  for (const m of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar']) {
    breakdown[m] = contributors(logs, m);
  }

  res.json({
    date, grouped, all: logs, totals,
    review, verdict: dayVerdict(review), breakdown, in_progress: inProgress,
  });
});

// POST /api/food-logs/parse — turn pasted text into reviewable entries.
// Parses only; saves nothing. The client shows editable cards and posts each
// confirmed entry back through the normal manual-entry path.
router.post('/parse', (req, res) => {
  const db = getDB();
  const text = req.body.text;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: 'text is too long (5,000 character limit)' });
  }
  const foods = db.prepare('SELECT id, name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g FROM foods').all();
  const { entries, errors } = parseLog(text, { foods });
  res.json({ entries, errors });
});

// GET /api/food-logs/estimate/status — is the photo estimate usable right now?
// Lets Settings and the Add sheet say "not configured" instead of failing on tap.
router.get('/estimate/status', (req, res) => {
  res.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    models: (process.env.GEMINI_MODEL || '').split(',').map(s => s.trim()).filter(Boolean),
  });
});

// POST /api/food-logs/estimate — a photo or a description in, reviewable entries out.
// Estimates only; saves nothing. The result goes through the same parser and the
// same editable preview cards as a pasted line, because an estimate from one
// photo is a first draft, not a measurement.
router.post('/estimate', async (req, res) => {
  const { image, mime_type, description = '', note = '' } = req.body || {};

  if (!image && !String(description).trim()) {
    return res.status(400).json({ error: 'Send a photo or a description' });
  }
  if (String(description).length > MAX_DESCRIPTION_CHARS * 2) {
    return res.status(400).json({ error: 'Description is too long' });
  }

  const models = (process.env.GEMINI_MODEL || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  try {
    const { text, model } = await estimateMeal({
      apiKey: process.env.GEMINI_API_KEY,
      image: typeof image === 'string' ? image.replace(/^data:[^,]+,/, '') : null,
      mimeType: mime_type || 'image/jpeg',
      description: String(description),
      note: String(note),
      ...(models.length ? { models } : {}),
    });

    const db = getDB();
    const foods = db.prepare('SELECT id, name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g FROM foods').all();
    const { entries, errors } = parseLog(text, { foods });

    if (!entries.length) {
      // The model answered but not in the format the parser reads. Hand back the
      // raw text so it can still be corrected by hand rather than lost.
      return res.status(502).json({
        error: 'The estimate came back in an unexpected format',
        raw: text,
        errors,
      });
    }
    res.json({ entries, errors, model, raw: text });
  } catch (err) {
    if (err instanceof EstimateError) {
      const status = { no_key: 503, auth: 503, quota: 429, timeout: 504 }[err.kind] || 502;
      return res.status(status).json({ error: err.message, kind: err.kind });
    }
    res.status(500).json({ error: 'Estimate failed' });
  }
});

// POST /api/food-logs
router.post('/', (req, res) => {
  const db = getDB();
  const date = req.body.date || todayIST();
  const meal_type = req.body.meal_type || 'snack';
  const isQuickAdd = req.body.quick_add ? 1 : 0;

  const insertLog = db.prepare(`
    INSERT INTO food_logs (date, meal_type, food_id, saved_meal_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, unit_used, quick_add)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          (food.fiber_g || 0) * qty, (food.sugar_g || 0) * qty, null, 0
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
      (food.fiber_g || 0) * multiplier, (food.sugar_g || 0) * multiplier, unitUsed, 0
    );
    return res.status(201).json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(result.lastInsertRowid));
  }

  // Case 3: custom/manual entry (or quick add)
  const { food_name, calories, protein_g = 0, carbs_g = 0, fat_g = 0, fiber_g = 0, sugar_g = 0 } = req.body;
  if (!food_name || calories == null) {
    return res.status(400).json({ error: 'food_name and calories are required for manual entries' });
  }
  const result = insertLog.run(date, meal_type, null, null, food_name, 1, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, null, isQuickAdd);
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

  const insertLog2 = db.prepare(`
    INSERT INTO food_logs (date, meal_type, food_id, saved_meal_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, unit_used, quick_add)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const ids = db.transaction(() => {
    const newIds = [];
    for (const log of yesterdayLogs) {
      const result = insertLog2.run(
        today, meal_type, log.food_id, log.saved_meal_id, log.food_name, log.quantity,
        log.calories, log.protein_g, log.carbs_g, log.fat_g, log.fiber_g || 0, log.sugar_g || 0, log.unit_used, log.quick_add || 0
      );
      newIds.push(result.lastInsertRowid);
    }
    return newIds;
  })();

  res.status(201).json({ copied: ids.length, meal_type });
});

// PUT /api/food-logs/:id — update quantity/unit of an existing entry
router.put('/:id', (req, res) => {
  const db = getDB();
  const log = db.prepare('SELECT * FROM food_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Log entry not found' });

  const qty = parseFloat(req.body.quantity) || log.quantity;
  const unitUsed = req.body.unit_used !== undefined ? req.body.unit_used : log.unit_used;

  // If linked to a food, recalculate nutrition from the food's base values
  const food = log.food_id ? db.prepare('SELECT * FROM foods WHERE id = ?').get(log.food_id) : null;

  if (food) {
    let multiplier = qty;
    if (unitUsed && food.units) {
      const units = JSON.parse(food.units);
      const unitDef = units.find(u => u.unit === unitUsed);
      if (unitDef) {
        multiplier = qty * unitDef.multiplier;
      }
    }
    db.prepare(`
      UPDATE food_logs SET quantity=?, unit_used=?, calories=?, protein_g=?, carbs_g=?, fat_g=?, fiber_g=?, sugar_g=?
      WHERE id=?
    `).run(
      qty, unitUsed,
      food.calories * multiplier, food.protein_g * multiplier, food.carbs_g * multiplier, food.fat_g * multiplier,
      (food.fiber_g || 0) * multiplier, (food.sugar_g || 0) * multiplier,
      req.params.id
    );
  } else {
    // Manual entry — just update quantity (can't recalculate without base food)
    const scale = qty / (log.quantity || 1);
    db.prepare(`
      UPDATE food_logs SET quantity=?, calories=?, protein_g=?, carbs_g=?, fat_g=?, fiber_g=?, sugar_g=?
      WHERE id=?
    `).run(
      qty,
      log.calories * scale, log.protein_g * scale, log.carbs_g * scale, log.fat_g * scale,
      (log.fiber_g || 0) * scale, (log.sugar_g || 0) * scale,
      req.params.id
    );
  }

  res.json(db.prepare('SELECT * FROM food_logs WHERE id = ?').get(req.params.id));
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
