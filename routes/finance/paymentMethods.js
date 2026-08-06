const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');
const { todayIST } = require('../../dateUtils');

// GET / — List payment methods with current month expense totals
router.get('/', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const month = today.slice(0, 7);
  const startDate = month + '-01';
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = month + '-' + String(lastDay).padStart(2, '0');

  const methods = db.prepare('SELECT * FROM fin_payment_methods ORDER BY sort_order, name').all();

  const spendRows = db.prepare(`
    SELECT payment_method_id, SUM(amount) AS total_spent
    FROM fin_transactions
    WHERE type = 'expense' AND date >= ? AND date <= ?
    GROUP BY payment_method_id
  `).all(startDate, endDate);

  const spendMap = {};
  for (const row of spendRows) {
    spendMap[row.payment_method_id] = row.total_spent;
  }

  const result = methods.map(pm => ({
    ...pm,
    spent_this_month: spendMap[pm.id] || 0
  }));

  res.json({ payment_methods: result });
});

// PUT /:id — Update payment method fields
router.put('/:id', (req, res) => {
  const db = getDB();
  const fields = req.body;
  const keys = Object.keys(fields).filter(k => ['statement_day', 'due_day', 'name'].includes(k));
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);
  vals.push(req.params.id);

  db.prepare(`UPDATE fin_payment_methods SET ${sets} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

module.exports = router;
