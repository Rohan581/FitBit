const Database = require('better-sqlite3');
const path = require('path');
const { seedDatabase } = require('./seed');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'earned.db');

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      serving_unit TEXT NOT NULL,
      serving_size REAL NOT NULL DEFAULT 1,
      calories REAL NOT NULL,
      protein_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      fat_g REAL NOT NULL DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      items TEXT NOT NULL,
      total_calories REAL NOT NULL,
      total_protein_g REAL NOT NULL DEFAULT 0,
      total_carbs_g REAL NOT NULL DEFAULT 0,
      total_fat_g REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'snack',
      food_id INTEGER,
      saved_meal_id INTEGER,
      food_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      calories REAL NOT NULL,
      protein_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      fat_g REAL NOT NULL DEFAULT 0,
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      intensity TEXT DEFAULT 'moderate',
      notes TEXT,
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sleep_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      hours REAL NOT NULL,
      quality TEXT DEFAULT 'ok',
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL UNIQUE,
      total_points REAL DEFAULT 0,
      threshold INTEGER DEFAULT 350,
      treat_redeemed INTEGER DEFAULT 0,
      treat_redeemed_date TEXT
    );

    CREATE TABLE IF NOT EXISTS goal (
      id INTEGER PRIMARY KEY DEFAULT 1,
      start_weight_kg REAL DEFAULT 90,
      goal_weight_kg REAL DEFAULT 78,
      start_date TEXT,
      target_date TEXT,
      height_cm REAL DEFAULT 183,
      age INTEGER DEFAULT 25,
      activity_multiplier REAL DEFAULT 1.45,
      current_calorie_target REAL DEFAULT 2240,
      current_protein_target_g REAL DEFAULT 180,
      current_fat_target_g REAL DEFAULT 62,
      current_carb_target_g REAL DEFAULT 240,
      last_recalibration_date TEXT,
      calorie_override INTEGER DEFAULT 0,
      protein_override INTEGER DEFAULT 0,
      fat_override INTEGER DEFAULT 0,
      carb_override INTEGER DEFAULT 0,
      weekly_point_threshold INTEGER DEFAULT 350
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg_threshold REAL NOT NULL,
      achieved_date TEXT
    );
  `);

  // Seed if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM foods').get();
  if (count.c === 0) {
    seedDatabase(db);
  }

  return db;
}

module.exports = { getDB, initDB };
