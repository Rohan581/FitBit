const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// GET /api/rest-days?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const row = db.prepare('SELECT id FROM rest_days WHERE date = ?').get(date);
  res.json({ date, is_rest_day: !!row });
});

// POST /api/rest-days/toggle — toggle rest day for a date
router.post('/toggle', (req, res) => {
  const db = getDB();
  const date = req.body.date || todayIST();
  const existing = db.prepare('SELECT id FROM rest_days WHERE date = ?').get(date);

  if (existing) {
    db.prepare('DELETE FROM rest_days WHERE id = ?').run(existing.id);
    res.json({ date, is_rest_day: false });
  } else {
    db.prepare('INSERT INTO rest_days (date) VALUES (?)').run(date);
    res.json({ date, is_rest_day: true });
  }
});

module.exports = router;
