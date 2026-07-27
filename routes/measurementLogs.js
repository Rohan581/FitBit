const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// GET /api/measurements?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const log = db.prepare('SELECT * FROM measurement_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(date);
  res.json(log || null);
});

// GET /api/measurements/trend?days=90
router.get('/trend', (req, res) => {
  const db = getDB();
  const days = parseInt(req.query.days) || 90;
  const cutoff = new Date(Date.now() + 330 * 60000);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const logs = db.prepare(
    'SELECT * FROM measurement_logs WHERE date >= ? ORDER BY date ASC'
  ).all(cutoffStr);

  res.json(logs);
});

// POST /api/measurements
router.post('/', (req, res) => {
  const db = getDB();
  const { date, waist_cm, chest_cm, hips_cm } = req.body;
  const logDate = date || todayIST();

  if (!waist_cm || waist_cm <= 0) {
    return res.status(400).json({ error: 'waist_cm is required' });
  }

  // Upsert: delete existing for this date, then insert
  db.prepare('DELETE FROM measurement_logs WHERE date = ?').run(logDate);
  db.prepare(
    'INSERT INTO measurement_logs (date, waist_cm, chest_cm, hips_cm) VALUES (?, ?, ?, ?)'
  ).run(logDate, waist_cm, chest_cm || null, hips_cm || null);

  const log = db.prepare('SELECT * FROM measurement_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(logDate);
  res.json(log);
});

// DELETE /api/measurements/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM measurement_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
