const express = require('express');
const router = express.Router();
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

// ─── Tables excluded from export ────────────────────────────
// Internal/framework tables that are not user data.
const EXCLUDED_TABLES = new Set([
  'sqlite_sequence',       // SQLite internal auto-increment tracker
]);

// ─── Legacy table order (first 9, matching pre-v47 exports) ──
const LEGACY_ORDER = [
  'food_logs', 'exercise_logs', 'workout_sessions', 'workout_sets',
  'weight_logs', 'sleep_logs', 'measurement_logs', 'weekly_summary',
  'reward_bank_ledger',
];

// ─── Custom queries for specific tables ─────────────────────
// Tables that need JOINs or column renaming use custom queries.
// All others use SELECT * ORDER BY id or rowid.
const CUSTOM_QUERIES = {
  food_logs: `
    SELECT fl.id, fl.date, fl.meal_type, fl.food_name, fl.quantity, fl.unit_used,
           fl.calories, fl.protein_g, fl.carbs_g, fl.fat_g, fl.fiber_g, fl.sugar_g,
           fl.logged_at
    FROM food_logs fl ORDER BY fl.date, fl.meal_type, fl.id`,
  exercise_logs: `
    SELECT id, date, type, duration_min, intensity, notes, logged_at
    FROM exercise_logs ORDER BY date, id`,
  workout_sessions: `
    SELECT id, date, workout_type, completed, duration_min, logged_at
    FROM workout_sessions ORDER BY date, id`,
  workout_sets: `
    SELECT ws.id, ws.session_id, e.name AS exercise_name,
           ws.set_number, ws.weight_kg, ws.reps
    FROM workout_sets ws
    LEFT JOIN exercises e ON e.id = ws.exercise_id
    ORDER BY ws.session_id, e.name, ws.set_number`,
  weight_logs: `SELECT id, date, weight_kg, logged_at FROM weight_logs ORDER BY date, id`,
  sleep_logs: `SELECT id, date, hours, quality, logged_at FROM sleep_logs ORDER BY date, id`,
  measurement_logs: `SELECT id, date, waist_cm, chest_cm, hips_cm, logged_at FROM measurement_logs ORDER BY date, id`,
  weekly_summary: `SELECT id, week_start, total_points, threshold, treat_redeemed, treat_redeemed_date FROM weekly_summary ORDER BY week_start`,
  reward_bank_ledger: `SELECT id, date, delta, kind, description, week_start FROM reward_bank_ledger ORDER BY date, id`,
};

// ─── Get all exportable tables from schema ──────────────────
function getExportTables(db) {
  const allTables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all().map(t => t.name).filter(t => !EXCLUDED_TABLES.has(t));

  // Legacy tables first (in original order), then the rest alphabetically
  const legacySet = new Set(LEGACY_ORDER);
  const legacyPresent = LEGACY_ORDER.filter(t => allTables.includes(t));
  const rest = allTables.filter(t => !legacySet.has(t)).sort();

  return [...legacyPresent, ...rest];
}

function queryTable(db, table) {
  if (CUSTOM_QUERIES[table]) {
    return db.prepare(CUSTOM_QUERIES[table]).all();
  }
  // Generic: SELECT * with sensible ordering
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  const hasDate = cols.includes('date');
  const hasId = cols.includes('id');
  let orderBy = '';
  if (hasDate && hasId) orderBy = ' ORDER BY date, id';
  else if (hasDate) orderBy = ' ORDER BY date';
  else if (hasId) orderBy = ' ORDER BY id';
  return db.prepare(`SELECT * FROM ${table}${orderBy}`).all();
}

function getColumns(db, table, rows) {
  if (CUSTOM_QUERIES[table] && rows.length > 0) {
    return Object.keys(rows[0]);
  }
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

function getBuildSha() {
  try { return require('child_process').execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; }
}

// ─── Goal as key/value rows ─────────────────────────────────
function goalToKeyValue(db) {
  const row = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  if (!row) return [];
  return Object.entries(row).map(([key, value]) => ({ key, value }));
}

// GET /api/export/csv/:table — download a single table as CSV
router.get('/csv/:table', (req, res) => {
  const table = req.params.table;
  const db = getDB();
  const tables = getExportTables(db);
  if (!tables.includes(table)) return res.status(404).json({ error: `Unknown table: ${table}` });

  const rows = queryTable(db, table);
  const columns = getColumns(db, table, rows);
  const dateStr = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${table}-${dateStr}.csv"`);
  res.send(toCsv(rows, columns));
});

// GET /api/export/csv — download all tables concatenated into one CSV with section headers
router.get('/csv', (req, res) => {
  const db = getDB();
  const tables = getExportTables(db);
  const dateStr = new Date().toISOString();
  const sha = getBuildSha();
  const sections = [];

  sections.push(`# exported ${dateStr} · build ${sha} · ${tables.length} tables`);
  sections.push('');

  for (const table of tables) {
    if (table === 'goal') {
      // Goal as key/value for readability
      const kvRows = goalToKeyValue(db);
      sections.push(`# goal`);
      sections.push(toCsv(kvRows, ['key', 'value']));
    } else {
      const rows = queryTable(db, table);
      const columns = getColumns(db, table, rows);
      sections.push(`# ${table}`);
      sections.push(toCsv(rows, columns));
    }
  }

  const datePart = dateStr.split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="earned-export-${datePart}.csv"`);
  res.send(sections.join('\n'));
});

// GET /api/export/json — download combined JSON
router.get('/json', (req, res) => {
  const db = getDB();
  const tables = getExportTables(db);
  const data = {};

  for (const table of tables) {
    if (table === 'goal') {
      const row = db.prepare('SELECT * FROM goal WHERE id = 1').get();
      data.goal = row || {};
    } else {
      data[table] = queryTable(db, table);
    }
  }

  data._meta = {
    exported: new Date().toISOString(),
    build: getBuildSha(),
    tables: tables.length,
  };

  const datePart = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="earned-export-${datePart}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

// Expose for testing
module.exports = router;
module.exports.getExportTables = getExportTables;
module.exports.EXCLUDED_TABLES = EXCLUDED_TABLES;
