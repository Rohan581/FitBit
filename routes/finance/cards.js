const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');
const { todayIST } = require('../../dateUtils');

// GET /suggest — Suggest best card for a category/merchant
router.get('/suggest', (req, res) => {
  const db = getDB();
  const q = req.query.q || '';
  if (!q) return res.json({ best: null, backup: null });

  const rules = db.prepare(`
    SELECT cr.*, pm.name AS card_name, pm.color_var
    FROM fin_card_rules cr
    JOIN fin_payment_methods pm ON cr.payment_method_id = pm.id
    WHERE cr.category_or_merchant LIKE ?
    ORDER BY cr.priority DESC
    LIMIT 2
  `).all('%' + q + '%');

  const format = (r) => r ? { card_name: r.card_name, multiplier_text: r.multiplier_text, note: r.note, color_var: r.color_var } : null;

  res.json({
    best: format(rules[0]),
    backup: format(rules[1])
  });
});

// GET /rules — List all card rules
router.get('/rules', (req, res) => {
  const db = getDB();
  const rules = db.prepare(`
    SELECT cr.*, pm.name AS payment_method_name
    FROM fin_card_rules cr
    JOIN fin_payment_methods pm ON cr.payment_method_id = pm.id
    ORDER BY cr.priority DESC
  `).all();
  res.json({ rules });
});

// POST /rules — Create card rule
router.post('/rules', (req, res) => {
  const db = getDB();
  const { payment_method_id, category_or_merchant, multiplier_text, note, priority } = req.body;
  const result = db.prepare(`
    INSERT INTO fin_card_rules (payment_method_id, category_or_merchant, multiplier_text, note, priority)
    VALUES (?, ?, ?, ?, ?)
  `).run(payment_method_id, category_or_merchant, multiplier_text, note || null, priority || 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /rules/:id — Update card rule
router.put('/rules/:id', (req, res) => {
  const db = getDB();
  const fields = req.body;
  const keys = Object.keys(fields).filter(k =>
    ['payment_method_id', 'category_or_merchant', 'multiplier_text', 'note', 'priority'].includes(k)
  );
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);
  vals.push(req.params.id);

  db.prepare(`UPDATE fin_card_rules SET ${sets} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// DELETE /rules/:id — Delete card rule
router.delete('/rules/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM fin_card_rules WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /bills — List card bills
router.get('/bills', (req, res) => {
  const db = getDB();
  const today = todayIST();

  const bills = db.prepare(`
    SELECT b.*, pm.name AS payment_method_name, pm.color_var
    FROM fin_card_bills b
    JOIN fin_payment_methods pm ON b.payment_method_id = pm.id
    ORDER BY b.due_date
  `).all();

  const upcoming_total = bills
    .filter(b => b.status !== 'paid' && b.due_date >= today)
    .reduce((sum, b) => sum + b.amount_computed, 0);

  res.json({ bills, upcoming_total });
});

// POST /bills — Create bill
router.post('/bills', (req, res) => {
  const db = getDB();
  const { payment_method_id, cycle_start, cycle_end, amount_computed, due_date } = req.body;
  const result = db.prepare(`
    INSERT INTO fin_card_bills (payment_method_id, cycle_start, cycle_end, amount_computed, due_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(payment_method_id, cycle_start, cycle_end, amount_computed, due_date);
  res.status(201).json({ id: result.lastInsertRowid });
});

// POST /bills/:id/pay — Mark bill as paid and create transfer transaction
router.post('/bills/:id/pay', (req, res) => {
  const db = getDB();
  const bill = db.prepare(`
    SELECT b.*, pm.name AS card_name
    FROM fin_card_bills b
    JOIN fin_payment_methods pm ON b.payment_method_id = pm.id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const { paid_date, payment_method_id_from } = req.body;

  // Find the "Other" category (fallback to first category)
  const otherCat = db.prepare("SELECT id FROM fin_categories WHERE name = 'Other'").get()
    || db.prepare('SELECT id FROM fin_categories ORDER BY id LIMIT 1').get();

  const merchant = bill.card_name + ' bill payment';
  const note = `Cycle ${bill.cycle_start} to ${bill.cycle_end}`;

  const txResult = db.prepare(`
    INSERT INTO fin_transactions (date, amount, type, category_id, payment_method_id, merchant, note)
    VALUES (?, ?, 'transfer', ?, ?, ?, ?)
  `).run(paid_date || todayIST(), bill.amount_computed, otherCat.id, payment_method_id_from, merchant, note);

  db.prepare(`
    UPDATE fin_card_bills SET status = 'paid', paid_date = ?, paid_transaction_id = ? WHERE id = ?
  `).run(paid_date || todayIST(), txResult.lastInsertRowid, bill.id);

  res.json({ ok: true, transaction_id: txResult.lastInsertRowid });
});

// GET /points-ledger — List points ledger with running balances
router.get('/points-ledger', (req, res) => {
  const db = getDB();

  const entries = db.prepare(`
    SELECT pl.*, pm.name AS payment_method_name, pm.color_var
    FROM fin_points_ledger pl
    JOIN fin_payment_methods pm ON pl.payment_method_id = pm.id
    ORDER BY pl.date DESC, pl.id DESC
  `).all();

  // Compute running balances per card
  const balances = {};
  // Process in chronological order for running balance
  const sorted = [...entries].reverse();
  for (const e of sorted) {
    if (!balances[e.payment_method_id]) {
      balances[e.payment_method_id] = { name: e.payment_method_name, balance: 0, total_value: 0 };
    }
    balances[e.payment_method_id].balance += e.delta;
    balances[e.payment_method_id].total_value += (e.value_inr || 0);
  }

  const total_value = Object.values(balances).reduce((sum, b) => sum + b.total_value, 0);

  res.json({ entries, balances, total_value });
});

// POST /points-ledger — Create ledger entry
router.post('/points-ledger', (req, res) => {
  const db = getDB();
  const { payment_method_id, date, delta, kind, description, value_inr } = req.body;
  const result = db.prepare(`
    INSERT INTO fin_points_ledger (payment_method_id, date, delta, kind, description, value_inr)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(payment_method_id, date || todayIST(), delta, kind || 'earned', description || null, value_inr || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

module.exports = router;
