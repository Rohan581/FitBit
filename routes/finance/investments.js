const express = require('express');
const router = express.Router();
const { getDB } = require('../../db/database');
const { todayIST } = require('../../dateUtils');

// GET / — List investments
router.get('/', (req, res) => {
  const db = getDB();
  let sql = 'SELECT * FROM fin_investments WHERE 1=1';
  const params = [];

  if (req.query.month) {
    const month = req.query.month;
    const startDate = month + '-01';
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = month + '-' + String(lastDay).padStart(2, '0');
    sql += ' AND date >= ? AND date <= ?';
    params.push(startDate, endDate);
  }

  if (req.query.type) {
    sql += ' AND type = ?';
    params.push(req.query.type);
  }

  sql += ' ORDER BY date DESC';

  const investments = db.prepare(sql).all(...params);
  res.json({ investments });
});

// POST / — Create investment
router.post('/', (req, res) => {
  const db = getDB();
  const { date, type, instrument_name, amount, is_recurring_template } = req.body;
  const result = db.prepare(`
    INSERT INTO fin_investments (date, type, instrument_name, amount, is_recurring_template)
    VALUES (?, ?, ?, ?, ?)
  `).run(date || todayIST(), type, instrument_name || null, amount, is_recurring_template || 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /:id — Update investment
router.put('/:id', (req, res) => {
  const db = getDB();
  const fields = req.body;
  const keys = Object.keys(fields).filter(k =>
    ['date', 'type', 'instrument_name', 'amount', 'is_recurring_template'].includes(k)
  );
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = keys.map(k => fields[k]);
  vals.push(req.params.id);

  db.prepare(`UPDATE fin_investments SET ${sets} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// DELETE /:id — Delete investment
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM fin_investments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /summary — Current month investment summary
router.get('/summary', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const month = today.slice(0, 7);
  const startDate = month + '-01';
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = month + '-' + String(lastDay).padStart(2, '0');

  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM fin_investments
    WHERE date >= ? AND date <= ?
  `).get(startDate, endDate);

  const byType = db.prepare(`
    SELECT type, SUM(amount) AS total
    FROM fin_investments
    WHERE date >= ? AND date <= ?
    GROUP BY type
  `).all(startDate, endDate);

  const total_invested = totalRow.total;
  const by_type = byType.map(row => ({
    type: row.type,
    total: row.total,
    pct: total_invested > 0 ? Math.round((row.total / total_invested) * 100) : 0
  }));

  const settings = db.prepare('SELECT monthly_invest_target FROM fin_settings WHERE id = 1').get();
  const target = settings ? settings.monthly_invest_target : 0;

  const sip_templates = db.prepare(`
    SELECT * FROM fin_investments WHERE is_recurring_template = 1 ORDER BY type, instrument_name
  `).all();

  res.json({ total_invested, target, by_type, sip_templates });
});

module.exports = router;
