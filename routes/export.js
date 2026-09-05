const express = require('express');
const router = express.Router();
const { ZipArchive } = require('archiver');
const { getDB } = require('../db/database');

// ─── CSV helpers ────────────────────────────────────────────
function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(rows, columns) {
  const header = columns.join(',');
  if (rows.length === 0) return header + '\n';
  const lines = rows.map(row =>
    columns.map(col => csvEscape(row[col])).join(',')
  );
  return header + '\n' + lines.join('\n') + '\n';
}

// ─── Data extraction ────────────────────────────────────────
function getAllData(db) {
  const food_logs = db.prepare(`
    SELECT fl.id, fl.date, fl.meal_type, fl.food_name, fl.quantity, fl.unit_used,
           fl.calories, fl.protein_g, fl.carbs_g, fl.fat_g, fl.fiber_g, fl.sugar_g,
           fl.logged_at
    FROM food_logs fl ORDER BY fl.date, fl.meal_type, fl.id
  `).all();

  const exercise_logs = db.prepare(`
    SELECT id, date, type, duration_min, intensity, notes, logged_at
    FROM exercise_logs ORDER BY date, id
  `).all();

  const workout_sessions = db.prepare(`
    SELECT id, date, workout_type, completed, duration_min, logged_at
    FROM workout_sessions ORDER BY date, id
  `).all();

  const workout_sets = db.prepare(`
    SELECT ws.id, ws.session_id, e.name AS exercise_name,
           ws.set_number, ws.weight_kg, ws.reps
    FROM workout_sets ws
    LEFT JOIN exercises e ON e.id = ws.exercise_id
    ORDER BY ws.session_id, e.name, ws.set_number
  `).all();

  const weight_logs = db.prepare(`
    SELECT id, date, weight_kg, logged_at
    FROM weight_logs ORDER BY date, id
  `).all();

  const sleep_logs = db.prepare(`
    SELECT id, date, hours, quality, logged_at
    FROM sleep_logs ORDER BY date, id
  `).all();

  const measurement_logs = db.prepare(`
    SELECT id, date, waist_cm, chest_cm, hips_cm, logged_at
    FROM measurement_logs ORDER BY date, id
  `).all();

  const weekly_summary = db.prepare(`
    SELECT id, week_start, total_points, threshold,
           treat_redeemed, treat_redeemed_date
    FROM weekly_summary ORDER BY week_start
  `).all();

  const reward_bank_ledger = db.prepare(`
    SELECT id, date, delta, kind, description, week_start
    FROM reward_bank_ledger ORDER BY date, id
  `).all();

  return {
    food_logs,
    exercise_logs,
    workout_sessions,
    workout_sets,
    weight_logs,
    sleep_logs,
    measurement_logs,
    weekly_summary,
    reward_bank_ledger,
  };
}

// Column definitions for CSV export
const CSV_COLUMNS = {
  food_logs: ['id', 'date', 'meal_type', 'food_name', 'quantity', 'unit_used', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'logged_at'],
  exercise_logs: ['id', 'date', 'type', 'duration_min', 'intensity', 'notes', 'logged_at'],
  workout_sessions: ['id', 'date', 'workout_type', 'completed', 'duration_min', 'logged_at'],
  workout_sets: ['id', 'session_id', 'exercise_name', 'set_number', 'weight_kg', 'reps'],
  weight_logs: ['id', 'date', 'weight_kg', 'logged_at'],
  sleep_logs: ['id', 'date', 'hours', 'quality', 'logged_at'],
  measurement_logs: ['id', 'date', 'waist_cm', 'chest_cm', 'hips_cm', 'logged_at'],
  weekly_summary: ['id', 'week_start', 'total_points', 'threshold', 'treat_redeemed', 'treat_redeemed_date'],
  reward_bank_ledger: ['id', 'date', 'delta', 'kind', 'description', 'week_start'],
};

// GET /api/export/csv — download ZIP of CSVs
router.get('/csv', (req, res) => {
  const db = getDB();
  const data = getAllData(db);
  const dateStr = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="earned-export-${dateStr}.zip"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', err => {
    console.error('Archive error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
  });
  archive.pipe(res);

  for (const [table, columns] of Object.entries(CSV_COLUMNS)) {
    archive.append(toCsv(data[table] || [], columns), { name: `${table}.csv` });
  }

  archive.finalize();
});

// GET /api/export/json — download combined JSON
router.get('/json', (req, res) => {
  const db = getDB();
  const data = getAllData(db);
  const dateStr = new Date().toISOString().split('T')[0];
  const json = JSON.stringify(data, null, 2);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="earned-export-${dateStr}.json"`);
  res.send(json);
});

module.exports = router;
