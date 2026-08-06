const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');

// GET / — Return finance settings
router.get('/', (req, res) => {
  const db = getDB();
  const settings = db.prepare('SELECT * FROM fin_settings WHERE id = 1').get();
  res.json(settings || { id: 1, monthly_overall_budget: 0, monthly_invest_target: 0, monthly_income_default: 0 });
});

// PUT / — Update finance settings
router.put('/', (req, res) => {
  const db = getDB();
  const fields = req.body;
  const keys = Object.keys(fields).filter(k =>
    ['monthly_overall_budget', 'monthly_invest_target', 'monthly_income_default'].includes(k)
  );
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);

  db.prepare(`UPDATE fin_settings SET ${sets} WHERE id = 1`).run(...vals);
  res.json({ ok: true });
});

module.exports = router;
