const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const logs = db.prepare('SELECT * FROM exercise_logs WHERE date = ? ORDER BY logged_at').all(date);
  res.json(logs);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { type, duration_min, intensity = 'moderate', notes = '' } = req.body;
  const date = req.body.date || todayIST();

  if (!type || !duration_min) {
    return res.status(400).json({ error: 'type and duration_min are required' });
  }

  const result = db.prepare(`
    INSERT INTO exercise_logs (date, type, duration_min, intensity, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(date, type, parseInt(duration_min), intensity, notes);

  res.status(201).json(db.prepare('SELECT * FROM exercise_logs WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const log = db.prepare('SELECT id FROM exercise_logs WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'Log not found' });
  db.prepare('DELETE FROM exercise_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
