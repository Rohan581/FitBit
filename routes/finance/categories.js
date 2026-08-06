const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');
const { todayIST } = require('../../dateUtils');

// GET / — List categories with current month spend
router.get('/', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const month = today.slice(0, 7);
  const startDate = month + '-01';
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = month + '-' + String(lastDay).padStart(2, '0');

  const categories = db.prepare('SELECT * FROM fin_categories ORDER BY sort_order, name').all();

  const spendRows = db.prepare(`
    SELECT category_id, SUM(amount) AS spent
    FROM fin_transactions
    WHERE type = 'expense' AND date >= ? AND date <= ?
    GROUP BY category_id
  `).all(startDate, endDate);

  const spendMap = {};
  for (const row of spendRows) {
    spendMap[row.category_id] = row.spent;
  }

  const result = categories.map(cat => ({
    ...cat,
    spent_this_month: spendMap[cat.id] || 0
  }));

  res.json({ categories: result });
});

// PUT /:id/budget — Update category budget
router.put('/:id/budget', (req, res) => {
  const db = getDB();
  const { monthly_budget } = req.body;
  db.prepare('UPDATE fin_categories SET monthly_budget = ? WHERE id = ?').run(monthly_budget, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
