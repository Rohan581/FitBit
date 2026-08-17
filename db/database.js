const Database = require('better-sqlite3');
const path = require('path');
const { seedFoods, seedInitialData, toSeedKey } = require('./seed');
const { seedExercises } = require('./exerciseSeed');

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
      fiber_g REAL NOT NULL DEFAULT 0,
      sugar_g REAL NOT NULL DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      units TEXT,
      default_unit TEXT,
      seed_key TEXT UNIQUE,
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
      total_fiber_g REAL NOT NULL DEFAULT 0,
      total_sugar_g REAL NOT NULL DEFAULT 0,
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
      fiber_g REAL NOT NULL DEFAULT 0,
      sugar_g REAL NOT NULL DEFAULT 0,
      unit_used TEXT,
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

    CREATE TABLE IF NOT EXISTS water_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      glasses INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS weekly_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL UNIQUE,
      total_points REAL DEFAULT 0,
      threshold INTEGER DEFAULT 315,
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
      current_fiber_target_g REAL DEFAULT 32,
      current_sugar_limit_g REAL DEFAULT 50,
      water_target_ml INTEGER DEFAULT 3000,
      last_recalibration_date TEXT,
      calorie_override INTEGER DEFAULT 0,
      protein_override INTEGER DEFAULT 0,
      fat_override INTEGER DEFAULT 0,
      carb_override INTEGER DEFAULT 0,
      weekly_point_threshold INTEGER DEFAULT 315,
      deficit_pct REAL DEFAULT 0.25,
      enable_chest_measurement INTEGER DEFAULT 0,
      enable_hips_measurement INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg_threshold REAL NOT NULL,
      achieved_date TEXT
    );

    CREATE TABLE IF NOT EXISTS measurement_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      waist_cm REAL NOT NULL,
      chest_cm REAL,
      hips_cm REAL,
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      primary_muscles TEXT NOT NULL DEFAULT '[]',
      secondary_muscles TEXT NOT NULL DEFAULT '[]',
      form_cues TEXT NOT NULL DEFAULT '[]',
      common_mistakes TEXT NOT NULL DEFAULT '[]',
      substitutes TEXT NOT NULL DEFAULT '[]',
      youtube_search_term TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      workout_type TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      duration_min INTEGER,
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );
  `);

  // ── Wishlist Bank ──────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS reward_bank (
      id INTEGER PRIMARY KEY DEFAULT 1,
      balance REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reward_bank_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      delta REAL NOT NULL,
      kind TEXT NOT NULL,
      description TEXT,
      week_start TEXT
    );

    CREATE TABLE IF NOT EXISTS wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL,
      purchased INTEGER DEFAULT 0,
      purchased_date TEXT
    );
  `);

  // Initialize reward_bank if empty
  const bankExists = db.prepare('SELECT id FROM reward_bank WHERE id = 1').get();
  if (!bankExists) {
    db.prepare('INSERT INTO reward_bank (id, balance) VALUES (1, 0)').run();
  }

  // ── Push notifications ─────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      keys_json TEXT NOT NULL,
      measurement_reminder INTEGER DEFAULT 0,
      stale_workout INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      ref_id TEXT
    );
  `);

  // ── Finance module tables ──────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS fin_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color_token TEXT NOT NULL DEFAULT '--oth',
      icon TEXT NOT NULL DEFAULT 'circle-ellipsis',
      monthly_budget REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fin_payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'upi',
      statement_day INTEGER,
      due_day INTEGER,
      color_var TEXT DEFAULT '--fin',
      short_name TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      category_id INTEGER NOT NULL,
      payment_method_id INTEGER,
      merchant TEXT,
      note TEXT,
      source TEXT DEFAULT 'manual',
      import_batch_id TEXT,
      goal_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES fin_categories(id),
      FOREIGN KEY (payment_method_id) REFERENCES fin_payment_methods(id)
    );

    CREATE TABLE IF NOT EXISTS fin_card_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method_id INTEGER NOT NULL,
      category_or_merchant TEXT NOT NULL,
      multiplier_text TEXT NOT NULL,
      note TEXT,
      priority INTEGER DEFAULT 0,
      FOREIGN KEY (payment_method_id) REFERENCES fin_payment_methods(id)
    );

    CREATE TABLE IF NOT EXISTS fin_points_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      delta REAL NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'earned',
      description TEXT,
      value_inr REAL,
      FOREIGN KEY (payment_method_id) REFERENCES fin_payment_methods(id)
    );

    CREATE TABLE IF NOT EXISTS fin_card_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method_id INTEGER NOT NULL,
      cycle_start TEXT NOT NULL,
      cycle_end TEXT NOT NULL,
      amount_computed REAL NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      paid_date TEXT,
      paid_transaction_id INTEGER,
      FOREIGN KEY (payment_method_id) REFERENCES fin_payment_methods(id)
    );

    CREATE TABLE IF NOT EXISTS fin_investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      instrument_name TEXT,
      amount REAL NOT NULL,
      is_recurring_template INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fin_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      saved_amount REAL DEFAULT 0,
      target_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fin_merchant_category_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_pattern TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES fin_categories(id)
    );

    CREATE TABLE IF NOT EXISTS fin_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      monthly_overall_budget REAL DEFAULT 0,
      monthly_invest_target REAL DEFAULT 0,
      monthly_income_default REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fin_no_spend_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE
    );
  `);

  // Run migrations for existing databases
  runMigrations(db);

  // Check if first run (for saved meal / goal / milestone seeding)
  const countBefore = db.prepare('SELECT COUNT(*) as c FROM foods').get().c;

  // Idempotent per-item food seeding — runs every startup
  seedFoods(db);

  // Seed default wishlist items if table is empty
  const wishlistCount = db.prepare('SELECT COUNT(*) as c FROM wishlist_items').get()?.c || 0;
  if (wishlistCount === 0) {
    const insertWishlist = db.prepare('INSERT INTO wishlist_items (name, target_amount) VALUES (?, ?)');
    insertWishlist.run('Casual sneakers', 12000);
    insertWishlist.run('Tom Ford Tobacco Vanille', null);
    insertWishlist.run('Leather jacket', null);
    insertWishlist.run('Ergonomic desk chair', null);
    insertWishlist.run('MacBook', null);
  }

  // First-run-only seeding (saved meal, goal, milestones)
  if (countBefore === 0) {
    seedInitialData(db);
  }

  return db;
}

function runMigrations(db) {
  // Check if fiber_g column exists on foods table
  const foodCols = db.prepare("PRAGMA table_info(foods)").all().map(c => c.name);

  if (!foodCols.includes('fiber_g')) {
    db.exec(`ALTER TABLE foods ADD COLUMN fiber_g REAL NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE foods ADD COLUMN sugar_g REAL NOT NULL DEFAULT 0`);
  }
  if (!foodCols.includes('is_favorite')) {
    db.exec(`ALTER TABLE foods ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`);
  }
  if (!foodCols.includes('units')) {
    db.exec(`ALTER TABLE foods ADD COLUMN units TEXT`);
    db.exec(`ALTER TABLE foods ADD COLUMN default_unit TEXT`);
  }

  // seed_key column for idempotent per-item seeding
  if (!foodCols.includes('seed_key')) {
    db.exec(`ALTER TABLE foods ADD COLUMN seed_key TEXT`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_seed_key ON foods(seed_key) WHERE seed_key IS NOT NULL`);
    // Backfill seed_keys for existing non-custom foods
    const unseeded = db.prepare(`SELECT id, name FROM foods WHERE is_custom = 0 AND seed_key IS NULL`).all();
    if (unseeded.length > 0) {
      const update = db.prepare('UPDATE foods SET seed_key = ? WHERE id = ?');
      for (const f of unseeded) {
        update.run(toSeedKey(f.name), f.id);
      }
    }
  }

  // food_logs columns
  const logCols = db.prepare("PRAGMA table_info(food_logs)").all().map(c => c.name);
  if (!logCols.includes('fiber_g')) {
    db.exec(`ALTER TABLE food_logs ADD COLUMN fiber_g REAL NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE food_logs ADD COLUMN sugar_g REAL NOT NULL DEFAULT 0`);
  }
  if (!logCols.includes('unit_used')) {
    db.exec(`ALTER TABLE food_logs ADD COLUMN unit_used TEXT`);
  }

  // saved_meals columns
  const mealCols = db.prepare("PRAGMA table_info(saved_meals)").all().map(c => c.name);
  if (!mealCols.includes('total_fiber_g')) {
    db.exec(`ALTER TABLE saved_meals ADD COLUMN total_fiber_g REAL NOT NULL DEFAULT 0`);
    db.exec(`ALTER TABLE saved_meals ADD COLUMN total_sugar_g REAL NOT NULL DEFAULT 0`);
  }

  // goal columns
  const goalCols = db.prepare("PRAGMA table_info(goal)").all().map(c => c.name);
  if (!goalCols.includes('current_fiber_target_g')) {
    db.exec(`ALTER TABLE goal ADD COLUMN current_fiber_target_g REAL DEFAULT 32`);
    db.exec(`ALTER TABLE goal ADD COLUMN current_sugar_limit_g REAL DEFAULT 50`);
    db.exec(`ALTER TABLE goal ADD COLUMN water_target_ml INTEGER DEFAULT 3000`);
    // Update existing rows
    db.exec(`UPDATE goal SET current_fiber_target_g = 32, current_sugar_limit_g = 50, water_target_ml = 3000 WHERE current_fiber_target_g IS NULL`);
  }

  // water_logs table
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  if (!tables.includes('water_logs')) {
    db.exec(`
      CREATE TABLE water_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        glasses INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  // deficit_pct column for percentage-based deficit
  if (!goalCols.includes('deficit_pct')) {
    db.exec(`ALTER TABLE goal ADD COLUMN deficit_pct REAL DEFAULT 0.25`);
    db.exec(`UPDATE goal SET deficit_pct = 0.25 WHERE deficit_pct IS NULL`);
  }

  // measurement toggles
  if (!goalCols.includes('enable_chest_measurement')) {
    db.exec(`ALTER TABLE goal ADD COLUMN enable_chest_measurement INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE goal ADD COLUMN enable_hips_measurement INTEGER DEFAULT 0`);
  }

  // measurement_logs table
  if (!tables.includes('measurement_logs')) {
    db.exec(`
      CREATE TABLE measurement_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        waist_cm REAL NOT NULL,
        chest_cm REAL,
        hips_cm REAL,
        logged_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  // Backfill fiber/sugar for existing foods
  const needsBackfill = db.prepare("SELECT COUNT(*) as c FROM foods WHERE fiber_g = 0 AND sugar_g = 0 AND name = 'Dal (toor/moong, home-style)'").get();
  if (needsBackfill.c > 0) {
    backfillFiberSugar(db);
  }

  // Training tables migration
  const tablesAfter = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  if (!tablesAfter.includes('exercises')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        primary_muscles TEXT NOT NULL DEFAULT '[]',
        secondary_muscles TEXT NOT NULL DEFAULT '[]',
        form_cues TEXT NOT NULL DEFAULT '[]',
        common_mistakes TEXT NOT NULL DEFAULT '[]',
        substitutes TEXT NOT NULL DEFAULT '[]',
        youtube_search_term TEXT
      );
      CREATE TABLE IF NOT EXISTS workout_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        workout_type TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        duration_min INTEGER,
        logged_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS workout_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        set_number INTEGER NOT NULL,
        weight_kg REAL,
        reps INTEGER,
        FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises(id)
      );
    `);
  }

  // Training config columns in goal
  const goalColsAfter = db.prepare("PRAGMA table_info(goal)").all().map(c => c.name);
  if (!goalColsAfter.includes('gym_frequency')) {
    db.exec(`ALTER TABLE goal ADD COLUMN gym_frequency INTEGER DEFAULT 3`);
    db.exec(`ALTER TABLE goal ADD COLUMN current_workout_index INTEGER DEFAULT 0`);
  }

  // rest_seconds column on exercises
  const exCols = db.prepare("PRAGMA table_info(exercises)").all().map(c => c.name);
  if (!exCols.includes('rest_seconds')) {
    db.exec(`ALTER TABLE exercises ADD COLUMN rest_seconds INTEGER`);
    // Backfill: compounds get 150s, accessories get 75s
    const compounds = [
      'Barbell Back Squat', 'Barbell Bench Press', 'Conventional Deadlift',
      'Romanian Deadlift', 'Standing Overhead Press', 'Barbell Row',
      'Leg Press', 'Bulgarian Split Squat', 'Incline Dumbbell Press',
      'Pull-Up', 'Hip Thrust', 'Dips',
    ];
    db.prepare(`UPDATE exercises SET rest_seconds = 75`).run();
    if (compounds.length > 0) {
      db.prepare(`UPDATE exercises SET rest_seconds = 150 WHERE name IN (${compounds.map(() => '?').join(',')})`)
        .run(...compounds);
    }
  }

  // workout_cardio table
  const tablesLatest = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  if (!tablesLatest.includes('workout_cardio')) {
    db.exec(`
      CREATE TABLE workout_cardio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        duration_min INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
      )
    `);
  }

  // rest_days table
  if (!tablesLatest.includes('rest_days')) {
    db.exec(`
      CREATE TABLE rest_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE
      )
    `);
  }

  // rest_day_reduction in goal
  const goalColsFinal = db.prepare("PRAGMA table_info(goal)").all().map(c => c.name);
  if (!goalColsFinal.includes('rest_day_reduction')) {
    db.exec(`ALTER TABLE goal ADD COLUMN rest_day_reduction INTEGER DEFAULT 150`);
  }

  // pair_group column on exercises for antagonist supersets
  const exColsLatest = db.prepare("PRAGMA table_info(exercises)").all().map(c => c.name);
  if (!exColsLatest.includes('pair_group')) {
    db.exec(`ALTER TABLE exercises ADD COLUMN pair_group TEXT`);
    // Backfill pair groups for compatible pairings
    const pairGroups = {
      'Cable Bicep Curl': 'biceps_triceps',
      'Dumbbell Hammer Curl': 'biceps_triceps',
      'Cable Tricep Pushdown': 'biceps_triceps',
      'Overhead Tricep Extension': 'biceps_triceps',
      'Dumbbell Lateral Raise': 'side_rear_delts',
      'Face Pull': 'side_rear_delts',
      'Rear Delt Fly': 'side_rear_delts',
      'Cable Chest Fly': 'chest_back_iso',
      'Seated Cable Row': 'chest_back_iso',
      'Leg Extension': 'quads_hams_iso',
      'Lying Leg Curl': 'quads_hams_iso',
      'Seated Leg Curl': 'quads_hams_iso',
      'Standing Calf Raise': 'calves_abs',
      'Seated Calf Raise': 'calves_abs',
      'Cable Crunch': 'calves_abs',
      'Hanging Leg Raise': 'calves_abs',
    };
    const updatePair = db.prepare('UPDATE exercises SET pair_group = ? WHERE name = ?');
    for (const [name, group] of Object.entries(pairGroups)) {
      updatePair.run(group, name);
    }
  }

  // Session mode preference
  const goalColsSession = db.prepare("PRAGMA table_info(goal)").all().map(c => c.name);
  if (!goalColsSession.includes('session_mode')) {
    db.exec(`ALTER TABLE goal ADD COLUMN session_mode TEXT DEFAULT 'full'`);
  }

  // Reward credit amount
  if (!goalColsSession.includes('reward_credit_amount')) {
    db.exec(`ALTER TABLE goal ADD COLUMN reward_credit_amount REAL DEFAULT 2000`);
  }

  // Variation refresh tracking
  if (!goalColsSession.includes('template_start_date')) {
    db.exec(`ALTER TABLE goal ADD COLUMN template_start_date TEXT`);
    db.exec(`ALTER TABLE goal ADD COLUMN refresh_snoozed_until TEXT`);
    // Backfill: start date = today for existing users
    const today = new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
    db.exec(`UPDATE goal SET template_start_date = '${today}' WHERE template_start_date IS NULL`);
  }

  // Seed exercises
  seedExercises(db);
}

function backfillFiberSugar(db) {
  // Map of food name -> [fiber_g, sugar_g] based on standard nutrition data
  const fiberSugarMap = {
    'Steamed rice': [0.6, 0],
    'Roti (whole wheat, plain)': [2.5, 0.5],
    'Dal (toor/moong, home-style)': [7, 2],
    'Chicken curry (home-style)': [1, 2],
    'Grilled/tandoori chicken breast': [0, 0],
    'Chicken tikka': [0, 1],
    'Prawn curry (home-style)': [1, 2],
    'Grilled/sauteed prawns (plain)': [0, 0],
    'Prawn masala/fry': [0.5, 1],
    'Flour tortilla (plain, medium)': [1.5, 1],
    'Chicken burrito/wrap': [3, 3],
    'Chicken tortilla tacos': [2.5, 2],
    'Curd/yogurt (plain)': [0, 8],
    'Boiled eggs': [0, 0.5],
    'Plain omelette (2 eggs)': [0, 0.5],
    'Rajma curry': [11, 3],
    'Chole (chickpea curry)': [12, 5],
    'Paneer curry': [1, 3],
    'Egg curry (2 eggs)': [1, 2],
    'Mixed vegetable sabzi': [4, 4],
    'Bhindi masala': [3.5, 3],
    'Palak paneer': [3, 2],
    'Sambar': [5, 3],
    'Rasam': [1, 2],
    'Aloo sabzi (dry)': [3, 2],
    'Khichdi': [4, 1],
    'Poha': [2, 2],
    'Upma': [2, 1],
    'Idli': [1, 0.5],
    'Dosa (plain)': [1, 0.5],
    'Masala dosa': [2, 1],
    'Paratha (plain)': [1.5, 0.5],
    'Aloo paratha': [2, 1],
    'Butter chicken': [1, 4],
    'Biryani (chicken)': [2, 3],
    'Biryani (veg)': [3, 3],
    'Pav bhaji': [4, 5],
    'Samosa': [2, 2],
    'Vada pav': [2, 3],
    'Pani puri': [1.5, 3],
    'Masala chai (with sugar)': [0, 10],
    'Filter coffee (with sugar)': [0, 8],
    'Chicken shawarma roll': [2, 3],
    'Margherita pizza': [1.5, 3],
    'Veg fried rice': [2, 2],
    'Chicken fried rice': [1.5, 2],
    'Gulab jamun': [0.3, 18],
    'Jalebi': [0, 30],
    'Ice cream (regular scoop)': [0.5, 16],
    'Banana': [3.1, 14],
    'Almonds': [1.5, 0.5],
    'Peanuts (roasted)': [2.5, 1],
    'Protein shake (whey, water)': [0, 1],
    'Greek yogurt (plain)': [0, 4],
    'Digestive biscuits': [0.5, 5],
    'Namkeen mixture': [1, 1.5],
    'Dark chocolate (70%+)': [2, 5],
    'Oats': [4, 1],
    'Honey': [0, 17],
    'Chia seeds': [5, 0],
    'Almond milk (unsweetened)': [0.5, 0],
    'Blueberries': [1.8, 7],
    'Whey protein powder': [0, 1],
  };

  const update = db.prepare('UPDATE foods SET fiber_g = ?, sugar_g = ? WHERE name = ?');
  const tx = db.transaction(() => {
    for (const [name, [fiber, sugar]] of Object.entries(fiberSugarMap)) {
      update.run(fiber, sugar, name);
    }
  });
  tx();
}

module.exports = { getDB, initDB };
