const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// Compute 7-day rolling average for an ordered array of weight logs
function addRollingAverage(logs) {
  return logs.map((log, i) => {
    const window = logs.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((s, w) => s + w.weight_kg, 0) / window.length;
    return { ...log, rolling_avg: Math.round(avg * 100) / 100 };
  });
}

// GET /api/weight-logs?limit=60
router.get('/', (req, res) => {
  const db = getDB();
  const limit = parseInt(req.query.limit) || 60;
  const raw = db.prepare('SELECT * FROM weight_logs ORDER BY date ASC, logged_at ASC').all();
  const withAvg = addRollingAverage(raw);
  res.json(withAvg.slice(-limit));
});

// GET /api/weight-logs/today
router.get('/today', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const log = db.prepare('SELECT * FROM weight_logs WHERE date = ? ORDER BY logged_at DESC LIMIT 1').get(today);
  res.json(log || null);
});

// GET /api/weight-logs/rolling-average — returns current 7-day rolling average
router.get('/rolling-average', (req, res) => {
  const db = getDB();
  const recent = db.prepare('SELECT * FROM weight_logs ORDER BY date DESC, logged_at DESC LIMIT 7').all().reverse();
  if (recent.length === 0) return res.json({ rolling_avg: null, count: 0 });
  const avg = recent.reduce((s, w) => s + w.weight_kg, 0) / recent.length;
  res.json({ rolling_avg: Math.round(avg * 100) / 100, count: recent.length });
});

router.post('/', (req, res) => {
  const db = getDB();
  const { weight_kg } = req.body;
  const date = req.body.date || todayIST();

  if (weight_kg == null) return res.status(400).json({ error: 'weight_kg is required' });

  // Upsert: replace existing entry for today
  db.prepare('DELETE FROM weight_logs WHERE date = ?').run(date);

  const result = db.prepare('INSERT INTO weight_logs (date, weight_kg) VALUES (?, ?)').run(date, parseFloat(weight_kg));
  res.status(201).json(db.prepare('SELECT * FROM weight_logs WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const log = db.prepare('SELECT id FROM weight_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Log not found' });
  db.prepare('DELETE FROM weight_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
