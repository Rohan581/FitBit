const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// GET /api/bank — current balance, wishlist items, recent ledger
router.get('/', (req, res) => {
  const db = getDB();
  const bank = db.prepare('SELECT balance FROM reward_bank WHERE id = 1').get();
  const items = db.prepare('SELECT * FROM wishlist_items ORDER BY purchased ASC, id ASC').all();
  const ledger = db.prepare('SELECT * FROM reward_bank_ledger ORDER BY date DESC, id DESC LIMIT 50').all();
  const goal = db.prepare('SELECT reward_credit_amount FROM goal WHERE id = 1').get();

  res.json({
    balance: bank?.balance || 0,
    credit_amount: goal?.reward_credit_amount || 2000,
    items,
    ledger,
  });
});

// POST /api/bank/credit — credit weekly reward (called when week threshold is met)
router.post('/credit', (req, res) => {
  const db = getDB();
  const { week_start } = req.body;
  const today = todayIST();

  // Check if this week already credited
  const existing = db.prepare(
    "SELECT id FROM reward_bank_ledger WHERE kind = 'weekly_credit' AND week_start = ?"
  ).get(week_start);

  if (existing) {
    return res.json({ ok: true, already_credited: true });
  }

  const goal = db.prepare('SELECT reward_credit_amount FROM goal WHERE id = 1').get();
  const amount = goal?.reward_credit_amount || 2000;

  db.prepare(
    'INSERT INTO reward_bank_ledger (date, delta, kind, description, week_start) VALUES (?, ?, ?, ?, ?)'
  ).run(today, amount, 'weekly_credit', `Weekly reward — threshold met`, week_start);

  db.prepare('UPDATE reward_bank SET balance = balance + ? WHERE id = 1').run(amount);

  const bank = db.prepare('SELECT balance FROM reward_bank WHERE id = 1').get();
  res.json({ ok: true, balance: bank.balance, credited: amount });
});

// POST /api/bank/purchase — record a purchase
router.post('/purchase', (req, res) => {
  const db = getDB();
  const { amount, description, wishlist_item_id } = req.body;
  const today = todayIST();

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be positive' });
  }

  const bank = db.prepare('SELECT balance FROM reward_bank WHERE id = 1').get();
  if (bank.balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  db.prepare(
    'INSERT INTO reward_bank_ledger (date, delta, kind, description) VALUES (?, ?, ?, ?)'
  ).run(today, -amount, 'purchase', description || 'Purchase');

  db.prepare('UPDATE reward_bank SET balance = balance - ? WHERE id = 1').run(amount);

  // If purchasing a wishlist item, mark it
  if (wishlist_item_id) {
    db.prepare('UPDATE wishlist_items SET purchased = 1, purchased_date = ? WHERE id = ?').run(today, wishlist_item_id);
  }

  const updated = db.prepare('SELECT balance FROM reward_bank WHERE id = 1').get();
  res.json({ ok: true, balance: updated.balance });
});

// CRUD for wishlist items
router.get('/wishlist', (req, res) => {
  const db = getDB();
  const items = db.prepare('SELECT * FROM wishlist_items ORDER BY purchased ASC, id ASC').all();
  res.json(items);
});

router.post('/wishlist', (req, res) => {
  const db = getDB();
  const { name, target_amount } = req.body;
  const result = db.prepare(
    'INSERT INTO wishlist_items (name, target_amount) VALUES (?, ?)'
  ).run(name, target_amount || null);
  res.json({ id: result.lastInsertRowid });
});

router.put('/wishlist/:id', (req, res) => {
  const db = getDB();
  const { name, target_amount } = req.body;
  db.prepare('UPDATE wishlist_items SET name = ?, target_amount = ? WHERE id = ?')
    .run(name, target_amount || null, req.params.id);
  res.json({ ok: true });
});

router.delete('/wishlist/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM wishlist_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
