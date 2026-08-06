const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');
const { todayIST } = require('../../dateUtils');

// GET / — Aggregated dashboard data
router.get('/', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const month = today.slice(0, 7);
  const startDate = month + '-01';
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = month + '-' + String(lastDay).padStart(2, '0');

  // Settings
  const settings = db.prepare('SELECT * FROM fin_settings WHERE id = 1').get() || {
    monthly_overall_budget: 0, monthly_invest_target: 0, monthly_income_default: 0
  };

  const monthly_budget = settings.monthly_overall_budget;
  const monthly_income = settings.monthly_income_default;

  // MTD spend
  const mtdRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM fin_transactions
    WHERE type = 'expense' AND date >= ? AND date <= ?
  `).get(startDate, endDate);
  const spend_mtd = mtdRow.total;

  // Today's spend
  const todayRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM fin_transactions
    WHERE type = 'expense' AND date = ?
  `).get(today);
  const spend_today = todayRow.total;

  // Days remaining in month (including today)
  const todayDay = parseInt(today.slice(8, 10), 10);
  const days_remaining = lastDay - todayDay + 1;

  // Safe to spend
  const remaining_budget = Math.max(0, monthly_budget - spend_mtd);
  const safe_to_spend = days_remaining > 0 ? Math.round(remaining_budget / days_remaining) : 0;
  const safe_tomorrow = Math.max(1, days_remaining - 1) > 0
    ? Math.round(remaining_budget / Math.max(1, days_remaining - 1))
    : 0;

  // No-spend day check
  const noSpendRow = db.prepare('SELECT id FROM fin_no_spend_days WHERE date = ?').get(today);
  const is_no_spend = !!noSpendRow;

  // Category snapshot — top 5 by spend
  const category_snapshot = db.prepare(`
    SELECT c.id, c.name, c.color_token, c.monthly_budget AS budget,
           COALESCE(SUM(t.amount), 0) AS spent
    FROM fin_categories c
    LEFT JOIN fin_transactions t ON t.category_id = c.id
      AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
    GROUP BY c.id
    ORDER BY spent DESC
    LIMIT 5
  `).all(startDate, endDate).map(row => ({
    ...row,
    pct: row.budget > 0 ? Math.round((row.spent / row.budget) * 100) : 0
  }));

  // Recent transactions — last 5
  const recent_transactions = db.prepare(`
    SELECT t.*, c.name AS category_name, c.color_token AS category_color,
           pm.short_name AS payment_method_short_name, pm.name AS payment_method_name
    FROM fin_transactions t
    LEFT JOIN fin_categories c ON t.category_id = c.id
    LEFT JOIN fin_payment_methods pm ON t.payment_method_id = pm.id
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 5
  `).all();

  // Month name
  const month_name = new Date(y, m - 1).toLocaleString('en-IN', { month: 'long' });

  res.json({
    monthly_budget,
    monthly_income,
    spend_mtd,
    spend_today,
    days_remaining,
    safe_to_spend,
    safe_tomorrow,
    is_no_spend,
    category_snapshot,
    recent_transactions,
    month_name
  });
});

module.exports = router;
