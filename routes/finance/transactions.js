const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');
const { todayIST } = require('../../dateUtils');

// GET / — List transactions grouped by date
router.get('/', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const month = req.query.month || today.slice(0, 7);
  const startDate = month + '-01';
  // Last day of month: go to next month day 0
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = month + '-' + String(lastDay).padStart(2, '0');

  let sql = `
    SELECT t.*, c.name AS category_name, c.color_token AS category_color,
           pm.short_name AS payment_method_short_name, pm.name AS payment_method_name
    FROM fin_transactions t
    LEFT JOIN fin_categories c ON t.category_id = c.id
    LEFT JOIN fin_payment_methods pm ON t.payment_method_id = pm.id
    WHERE t.date >= ? AND t.date <= ?
  `;
  const params = [startDate, endDate];

  if (req.query.category_id) {
    sql += ' AND t.category_id = ?';
    params.push(req.query.category_id);
  }
  if (req.query.payment_method_id) {
    sql += ' AND t.payment_method_id = ?';
    params.push(req.query.payment_method_id);
  }
  if (req.query.type) {
    sql += ' AND t.type = ?';
    params.push(req.query.type);
  }
  if (req.query.search) {
    sql += ' AND (t.merchant LIKE ? OR t.note LIKE ?)';
    const term = '%' + req.query.search + '%';
    params.push(term, term);
  }

  sql += ' ORDER BY t.date DESC, t.created_at DESC';

  const transactions = db.prepare(sql).all(...params);

  // Group by date
  const groupMap = {};
  for (const tx of transactions) {
    if (!groupMap[tx.date]) {
      groupMap[tx.date] = { date: tx.date, total: 0, items: [] };
    }
    groupMap[tx.date].items.push(tx);
    if (tx.type === 'expense') {
      groupMap[tx.date].total += tx.amount;
    }
  }
  const day_groups = Object.values(groupMap);

  res.json({ transactions, day_groups });
});

// POST / — Create transaction
router.post('/', (req, res) => {
  const db = getDB();
  const { date, amount, type, category_id, payment_method_id, merchant, note, goal_id } = req.body;

  const result = db.prepare(`
    INSERT INTO fin_transactions (date, amount, type, category_id, payment_method_id, merchant, note, goal_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date || todayIST(), amount, type || 'expense', category_id, payment_method_id || null, merchant || null, note || null, goal_id || null);

  // Auto-learn merchant -> category mapping for expenses
  if (merchant && (type === 'expense' || !type)) {
    db.prepare(`
      INSERT OR IGNORE INTO fin_merchant_category_map (merchant_pattern, category_id)
      VALUES (?, ?)
    `).run(merchant.toUpperCase(), category_id);
  }

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /:id — Update transaction
router.put('/:id', (req, res) => {
  const db = getDB();
  const fields = req.body;
  const keys = Object.keys(fields).filter(k => ['date', 'amount', 'type', 'category_id', 'payment_method_id', 'merchant', 'note', 'goal_id'].includes(k));
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);
  vals.push(req.params.id);

  db.prepare(`UPDATE fin_transactions SET ${sets} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// DELETE /:id — Delete transaction
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM fin_transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /no-spend — Toggle no-spend day
router.post('/no-spend', (req, res) => {
  const db = getDB();
  const date = req.body.date || todayIST();
  const existing = db.prepare('SELECT id FROM fin_no_spend_days WHERE date = ?').get(date);
  if (existing) {
    db.prepare('DELETE FROM fin_no_spend_days WHERE id = ?').run(existing.id);
    res.json({ is_no_spend: false });
  } else {
    db.prepare('INSERT INTO fin_no_spend_days (date) VALUES (?)').run(date);
    res.json({ is_no_spend: true });
  }
});

// GET /no-spend — Check if date is no-spend
router.get('/no-spend', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const row = db.prepare('SELECT id FROM fin_no_spend_days WHERE date = ?').get(date);
  res.json({ is_no_spend: !!row });
});

module.exports = router;
