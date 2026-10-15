const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST, getMondayIST, getDaysOfWeek } = require('../dateUtils');
const { calculateDailyPoints } = require('./points');

/**
 * Compute total points for a week from the logs (source of truth).
 * Also writes the result into weekly_summary.total_points so the stored
 * aggregate stays in sync.
 */
function computeWeekPoints(db, weekStart) {
  const days = getDaysOfWeek(weekStart);
  const total = days.reduce((s, d) => s + calculateDailyPoints(db, d).total, 0);

  // Persist into weekly_summary so total_points is never structurally zero
  db.prepare('INSERT OR IGNORE INTO weekly_summary (week_start, threshold) VALUES (?, 0)').run(weekStart);
  db.prepare('UPDATE weekly_summary SET total_points = ? WHERE week_start = ?').run(total, weekStart);

  return total;
}

/**
 * Self-healing reconciliation: scan the last 8 completed weeks.
 * For any week whose computed points >= threshold and which has no
 * weekly_credit row, insert one (backfill). Idempotent — keyed on week_start.
 *
 * Called from dashboard on every load and from server boot.
 */
function reconcileMissingCredits(db) {
  const today = todayIST();
  const currentMonday = getMondayIST(today);
  const goal = db.prepare('SELECT weekly_point_threshold, reward_credit_amount FROM goal WHERE id = 1').get();
  const threshold = goal?.weekly_point_threshold || 315;
  const amount = goal?.reward_credit_amount || 2000;

  // Check last 8 completed weeks (not the current in-progress week)
  const pending = [];
  for (let i = 1; i <= 8; i++) {
    const d = new Date(currentMonday + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - i * 7);
    const weekStart = d.toISOString().split('T')[0];

    // Already credited?
    const exists = db.prepare(
      "SELECT id FROM reward_bank_ledger WHERE kind = 'weekly_credit' AND week_start = ?"
    ).get(weekStart);
    if (exists) continue;

    // Compute points from logs
    const total = computeWeekPoints(db, weekStart);
    if (total >= threshold) {
      // Compute the week-end date for the credit date
      const weekEnd = new Date(weekStart + 'T12:00:00Z');
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const creditDate = weekEnd.toISOString().split('T')[0];

      db.prepare(
        'INSERT INTO reward_bank_ledger (date, delta, kind, description, week_start) VALUES (?, ?, ?, ?, ?)'
      ).run(creditDate, amount, 'weekly_credit', `Weekly reward — backfill`, weekStart);

      db.prepare('UPDATE reward_bank SET balance = balance + ? WHERE id = 1').run(amount);
      pending.push(weekStart);
    }
  }

  // Also check current week (in case threshold already met mid-week)
  const currentExists = db.prepare(
    "SELECT id FROM reward_bank_ledger WHERE kind = 'weekly_credit' AND week_start = ?"
  ).get(currentMonday);
  if (!currentExists) {
    const currentTotal = computeWeekPoints(db, currentMonday);
    if (currentTotal >= threshold) {
      db.prepare(
        'INSERT INTO reward_bank_ledger (date, delta, kind, description, week_start) VALUES (?, ?, ?, ?, ?)'
      ).run(today, amount, 'weekly_credit', `Weekly reward — threshold met`, currentMonday);
      db.prepare('UPDATE reward_bank SET balance = balance + ? WHERE id = 1').run(amount);
      pending.push(currentMonday);
    }
  }

  if (pending.length > 0) {
    console.log(`Bank reconciliation: credited ${pending.length} week(s): ${pending.join(', ')}`);
  }
  return pending;
}

// GET /api/bank — current balance, wishlist items, recent ledger, pending weeks
router.get('/', (req, res) => {
  const db = getDB();

  // Run reconciliation on every Bank page visit
  reconcileMissingCredits(db);

  const bank = db.prepare('SELECT balance FROM reward_bank WHERE id = 1').get();
  const items = db.prepare('SELECT * FROM wishlist_items ORDER BY purchased ASC, id ASC').all();
  const ledger = db.prepare('SELECT * FROM reward_bank_ledger ORDER BY date DESC, id DESC LIMIT 50').all();
  const goal = db.prepare('SELECT weekly_point_threshold, reward_credit_amount FROM goal WHERE id = 1').get();
  const threshold = goal?.weekly_point_threshold || 315;
  const amount = goal?.reward_credit_amount || 2000;

  // Find any completed weeks that met threshold but have no credit (for UI display)
  const today = todayIST();
  const currentMonday = getMondayIST(today);
  const pendingWeeks = [];
  for (let i = 1; i <= 8; i++) {
    const d = new Date(currentMonday + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - i * 7);
    const weekStart = d.toISOString().split('T')[0];
    const credited = db.prepare(
      "SELECT id FROM reward_bank_ledger WHERE kind = 'weekly_credit' AND week_start = ?"
    ).get(weekStart);
    if (credited) continue;
    const total = computeWeekPoints(db, weekStart);
    if (total >= threshold) {
      pendingWeeks.push({ week_start: weekStart, points: total, amount });
    }
  }

  res.json({
    balance: bank?.balance || 0,
    credit_amount: amount,
    items,
    ledger,
    pending_weeks: pendingWeeks,
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
module.exports.reconcileMissingCredits = reconcileMissingCredits;
module.exports.computeWeekPoints = computeWeekPoints;
