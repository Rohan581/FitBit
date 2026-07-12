const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// GET /api/water?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const row = db.prepare('SELECT * FROM water_logs WHERE date = ?').get(date);
  const goal = db.prepare('SELECT water_target_ml FROM goal WHERE id = 1').get();
  const target_ml = goal?.water_target_ml || 3000;
  const target_glasses = Math.round(target_ml / 250);

  res.json({
    date,
    glasses: row?.glasses || 0,
    target_glasses,
    target_ml,
  });
});

// POST /api/water/add — increment one glass
router.post('/add', (req, res) => {
  const db = getDB();
  const date = req.body.date || todayIST();

  const existing = db.prepare('SELECT * FROM water_logs WHERE date = ?').get(date);
  if (existing) {
    db.prepare('UPDATE water_logs SET glasses = glasses + 1 WHERE date = ?').run(date);
  } else {
    db.prepare('INSERT INTO water_logs (date, glasses) VALUES (?, 1)').run(date);
  }

  const row = db.prepare('SELECT * FROM water_logs WHERE date = ?').get(date);
  res.json({ date, glasses: row.glasses });
});

// POST /api/water/remove — decrement one glass
router.post('/remove', (req, res) => {
  const db = getDB();
  const date = req.body.date || todayIST();

  const existing = db.prepare('SELECT * FROM water_logs WHERE date = ?').get(date);
  if (existing && existing.glasses > 0) {
    db.prepare('UPDATE water_logs SET glasses = MAX(0, glasses - 1) WHERE date = ?').run(date);
  }

  const row = db.prepare('SELECT * FROM water_logs WHERE date = ?').get(date);
  res.json({ date, glasses: row?.glasses || 0 });
});

module.exports = router;
