const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const log = db.prepare('SELECT * FROM sleep_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(date);
  res.json(log || null);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { hours, quality = 'ok' } = req.body;
  const date = req.body.date || todayIST();

  if (hours == null) return res.status(400).json({ error: 'hours is required' });

  // Upsert: remove existing entry for this date first
  db.prepare('DELETE FROM sleep_logs WHERE date = ?').run(date);

  const result = db.prepare(`
    INSERT INTO sleep_logs (date, hours, quality)
    VALUES (?, ?, ?)
  `).run(date, parseFloat(hours), quality);

  res.status(201).json(db.prepare('SELECT * FROM sleep_logs WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const log = db.prepare('SELECT id FROM sleep_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Log not found' });
  db.prepare('DELETE FROM sleep_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
