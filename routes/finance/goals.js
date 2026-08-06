const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');

// GET / — List goals with progress
router.get('/', (req, res) => {
  const db = getDB();
  const goals = db.prepare('SELECT * FROM fin_goals ORDER BY created_at DESC').all();

  const result = goals.map(g => ({
    ...g,
    progress_pct: g.target_amount > 0 ? Math.round((g.saved_amount / g.target_amount) * 100) : 0
  }));

  res.json({ goals: result });
});

// POST / — Create goal
router.post('/', (req, res) => {
  const db = getDB();
  const { name, target_amount, target_date } = req.body;
  const result = db.prepare(`
    INSERT INTO fin_goals (name, target_amount, target_date)
    VALUES (?, ?, ?)
  `).run(name, target_amount, target_date || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /:id — Update goal
router.put('/:id', (req, res) => {
  const db = getDB();
  const fields = req.body;
  const keys = Object.keys(fields).filter(k =>
    ['name', 'target_amount', 'saved_amount', 'target_date'].includes(k)
  );
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);
  vals.push(req.params.id);

  db.prepare(`UPDATE fin_goals SET ${sets} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// DELETE /:id — Delete goal
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM fin_goals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /:id/add — Quick-add to saved_amount
router.post('/:id/add', (req, res) => {
  const db = getDB();
  const { amount } = req.body;
  db.prepare('UPDATE fin_goals SET saved_amount = saved_amount + ? WHERE id = ?').run(amount, req.params.id);
  const goal = db.prepare('SELECT * FROM fin_goals WHERE id = ?').get(req.params.id);
  res.json({
    ok: true,
    saved_amount: goal.saved_amount,
    progress_pct: goal.target_amount > 0 ? Math.round((goal.saved_amount / goal.target_amount) * 100) : 0
  });
});

module.exports = router;
