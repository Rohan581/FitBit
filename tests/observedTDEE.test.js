const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-tdee.db');

let db;
let computeObservedTDEE, deriveMacrosFromTDEE, weeklyTDEERecompute;

before(() => {
  try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  process.env.DATABASE_PATH = TEST_DB_PATH;

  for (const key of Object.keys(require.cache)) {
    if (key.includes('database') || key.includes('routes/') || key.includes('dateUtils')) {
      delete require.cache[key];
    }
  }

  const freshDb = require('../db/database');
  freshDb.initDB();
  db = freshDb.getDB();

  const goal = require('../routes/goal');
  computeObservedTDEE = goal.computeObservedTDEE;
  deriveMacrosFromTDEE = goal.deriveMacrosFromTDEE;
  weeklyTDEERecompute = goal.weeklyTDEERecompute;
});

after(() => {
  if (db) db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch {}
});

/**
 * Seed weight and food data for a known scenario.
 * User weighs ~87 kg at start, ~86 kg at end over 28 days.
 * Eats ~1,900 kcal/day on 25 of 28 days (~89% coverage).
 *
 * Expected observed TDEE:
 *   meanIntake = 1900
 *   weightChange = 86.0 - 87.0 = -1.0 kg (lost weight)
 *   energyFromTissue = (-1.0 × 7700) / 28 = -275 kcal/day
 *   observedTDEE = 1900 - (-275) = 1900 + 275 = 2175
 *   (TDEE > intake because weight was lost — body burned stored energy)
 */
function seedKnownScenario() {
  const today = new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
  const todayDate = new Date(today + 'T12:00:00Z');

  // Seed goal with known parameters
  db.prepare(`
    UPDATE goal SET height_cm = 183, age = 25, activity_multiplier = 1.45,
      start_weight_kg = 90, deficit_pct = 0.21 WHERE id = 1
  `).run();

  // Seed weight logs: ~87 kg in first 7 days, ~86 kg in last 7 days
  // Fill all 28 days for robust coverage
  for (let i = 28; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    let weight;
    if (i >= 22) {
      // First 7 days (days 28-22): ~87 kg
      weight = 87.0 + (Math.random() * 0.4 - 0.2); // 86.8 to 87.2
      weight = Math.round(weight * 10) / 10;
    } else if (i <= 6) {
      // Last 7 days (days 6-0): ~86 kg
      weight = 86.0 + (Math.random() * 0.4 - 0.2); // 85.8 to 86.2
      weight = Math.round(weight * 10) / 10;
    } else {
      // Middle: gradual decline
      const progress = (28 - i) / 28;
      weight = 87.0 - progress * 1.0;
      weight = Math.round(weight * 10) / 10;
    }

    db.prepare('INSERT INTO weight_logs (date, weight_kg) VALUES (?, ?)').run(dateStr, weight);
  }

  // Seed food logs: 1900 kcal/day for 25 of 28 days
  let loggedDays = 0;
  for (let i = 28; i >= 0; i--) {
    if (loggedDays >= 25) break;
    // Skip 3 random days (days 10, 17, 24)
    if (i === 10 || i === 17 || i === 24) continue;

    const d = new Date(todayDate);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO food_logs (date, meal_type, food_name, quantity, calories, protein_g, carbs_g, fat_g)
      VALUES (?, 'lunch', 'Test meal 1', 1, 950, 90, 100, 25)
    `).run(dateStr);
    db.prepare(`
      INSERT INTO food_logs (date, meal_type, food_name, quantity, calories, protein_g, carbs_g, fat_g)
      VALUES (?, 'dinner', 'Test meal 2', 1, 950, 90, 100, 25)
    `).run(dateStr);
    loggedDays++;
  }
}

describe('computeObservedTDEE', () => {
  before(() => seedKnownScenario());

  it('uses date-aligned 7-day rolling averages and returns reasonable TDEE', () => {
    const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
    const result = computeObservedTDEE(db, goal);

    assert.equal(result.source, 'observed', 'should have enough data for observed');
    assert.ok(result.coverage_pct >= 80, `coverage ${result.coverage_pct}% should be >= 80%`);

    // Rolling averages should be close to 87 and 86
    assert.ok(result.rolling_weight_start >= 86.5 && result.rolling_weight_start <= 87.5,
      `start avg ${result.rolling_weight_start} should be near 87`);
    assert.ok(result.rolling_weight_end >= 85.5 && result.rolling_weight_end <= 86.5,
      `end avg ${result.rolling_weight_end} should be near 86`);

    // Weight change should be approximately -1 kg
    assert.ok(result.weight_change_kg >= -1.5 && result.weight_change_kg <= -0.5,
      `weight change ${result.weight_change_kg} should be near -1.0`);

    // Mean intake should be ~1900
    assert.ok(result.mean_intake >= 1850 && result.mean_intake <= 1950,
      `mean intake ${result.mean_intake} should be near 1900`);

    // Observed TDEE should be near 2175 (1900 + 275)
    // Allow some slack for random weight variation
    assert.ok(result.raw_observed >= 2050 && result.raw_observed <= 2300,
      `raw observed ${result.raw_observed} should be near 2175`);

    // Window should be 28 days
    assert.equal(result.window_days, 28, 'window should be 28 days');
  });

  it('formula TDEE is computed from end-of-window weight', () => {
    const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
    const result = computeObservedTDEE(db, goal);

    // Formula TDEE for ~86 kg, 183cm, 25yo, 1.45 multiplier
    // BMR = 10*86 + 6.25*183 - 5*25 + 5 = 860 + 1143.75 - 125 + 5 = 1883.75
    // TDEE = 1883.75 * 1.45 = 2731
    assert.ok(result.formula_tdee >= 2650 && result.formula_tdee <= 2800,
      `formula TDEE ${result.formula_tdee} should be near 2731`);
  });
});

describe('deriveMacrosFromTDEE safety floor', () => {
  it('applies max(1500, 20 × bodyweight) floor', () => {
    // 87 kg person: floor = max(1500, 20 * 87) = max(1500, 1740) = 1740
    const result = deriveMacrosFromTDEE(1800, 0.25, 87);
    // Without floor: 1800 * 0.75 = 1350 → below 1740
    assert.equal(result.calorie_target, 1740, 'should be floored to 20 × 87 = 1740');
    assert.equal(result.floored, true, 'should flag as floored');
    assert.equal(result.floor, 1740, 'floor value should be 1740');
    assert.equal(result.unfloored_target, 1350, 'unfloored target should be 1350');
  });

  it('does not floor when target is above minimum', () => {
    const result = deriveMacrosFromTDEE(2700, 0.21, 87);
    // 2700 * 0.79 = 2133 > 1740
    assert.equal(result.calorie_target, 2133, 'should not be floored');
    assert.equal(result.floored, false, 'should not flag as floored');
  });

  it('uses 1500 floor for lightweight users', () => {
    // 60 kg person: floor = max(1500, 20 * 60) = max(1500, 1200) = 1500
    const result = deriveMacrosFromTDEE(1800, 0.25, 60);
    // Without floor: 1800 * 0.75 = 1350 → below 1500
    assert.equal(result.calorie_target, 1500, 'should be floored to 1500');
    assert.equal(result.floored, true, 'should flag as floored');
    assert.equal(result.floor, 1500, 'floor value should be 1500');
  });

  it('protein is always at least max(160, 2 × bodyweight)', () => {
    const result = deriveMacrosFromTDEE(2700, 0.21, 87);
    assert.ok(result.protein_target >= 174, `protein ${result.protein_target} should be >= 2×87=174`);
  });

  // Regression test from v47 spec: at 84.15 kg with formula source and 21% deficit, target is ~2136 and floor doesn't bind
  it('at 84.15 kg formula TDEE with 21% deficit yields correct target and floor does not bind', () => {
    // Use the same computation path as the app:
    // BMR = 10*84.15 + 6.25*183 - 5*25 + 5 = 1865.25, rounds to 1865
    // TDEE = 1865 * 1.45 = 2704.25, rounds to 2704
    const { computeFormulaTDEE } = require('../routes/goal');
    const { tdee: formulaTDEE } = computeFormulaTDEE(84.15, 183, 25, 1.45);
    const result = deriveMacrosFromTDEE(formulaTDEE, 0.21, 84.15);

    // formulaTDEE * 0.79, rounded
    const expectedTarget = Math.round(formulaTDEE * 0.79);
    assert.equal(result.calorie_target, expectedTarget, `target should be ${expectedTarget}, got ${result.calorie_target}`);
    assert.equal(result.floored, false, 'floor should not bind at this weight/deficit');

    // floor = max(1500, 20 * 84.15) = max(1500, 1683) = 1683
    assert.equal(result.floor, 1683, 'floor should be 1683');
    assert.ok(result.calorie_target > result.floor, `target ${result.calorie_target} should be above floor ${result.floor}`);
  });
});

describe('TDEE clamping rejection (v47)', () => {
  it('sub-band observed TDEE is rejected — tdee_source stays formula', () => {
    // Clear previous data
    db.prepare('DELETE FROM weight_logs').run();
    db.prepare('DELETE FROM food_logs').run();
    db.prepare('DELETE FROM tdee_history').run();
    db.prepare(`UPDATE goal SET observed_tdee = NULL, tdee_source = 'formula', last_tdee_compute_date = NULL WHERE id = 1`).run();

    const today = new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
    const todayDate = new Date(today + 'T12:00:00Z');

    // Seed at 84.15 kg stable weight (no change) with very low intake (1200 kcal/day)
    // This will produce observedTDEE ≈ 1200, well below 0.75 * formulaTDEE (≈ 2028)
    for (let i = 28; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      db.prepare('INSERT INTO weight_logs (date, weight_kg) VALUES (?, ?)').run(dateStr, 84.15);
    }

    for (let i = 27; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      db.prepare(`
        INSERT INTO food_logs (date, meal_type, food_name, quantity, calories, protein_g, carbs_g, fat_g)
        VALUES (?, 'lunch', 'Low cal meal', 1, 1200, 50, 100, 30)
      `).run(dateStr);
    }

    const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
    const result = computeObservedTDEE(db, goal);

    // The raw observed TDEE should be ~1200 (stable weight, 1200 kcal intake)
    assert.ok(result.raw_observed < 1400, `raw_observed ${result.raw_observed} should be low (around 1200)`);

    // The source should be 'formula' because it was clamped/rejected
    assert.equal(result.source, 'formula', 'source should be formula when measurement is rejected');
    assert.equal(result.was_clamped, true, 'was_clamped should be true');

    // The result should NOT have observed_tdee (that field only exists when source = 'observed')
    assert.equal(result.observed_tdee, undefined, 'observed_tdee should not be set on a rejected result');

    // Now run weeklyTDEERecompute and verify goal stays on formula
    weeklyTDEERecompute(db);
    const updatedGoal = db.prepare('SELECT * FROM goal WHERE id = 1').get();

    assert.equal(updatedGoal.tdee_source, 'formula', 'goal.tdee_source must stay formula after rejected observation');
    assert.equal(updatedGoal.observed_tdee, null, 'goal.observed_tdee must not be overwritten with clamped value');

    // tdee_history should record the rejection
    const historyRow = db.prepare('SELECT * FROM tdee_history ORDER BY id DESC LIMIT 1').get();
    assert.equal(historyRow.was_clamped, 1, 'tdee_history should record was_clamped = 1');
    assert.equal(historyRow.source_used, 'formula', 'tdee_history source_used should be formula');
    assert.ok(historyRow.raw_observed != null, 'tdee_history should record raw_observed');
    assert.equal(historyRow.observed_tdee, null, 'tdee_history observed_tdee should be null for rejected');
  });
});

describe('Export covers all tables (v47)', () => {
  it('every table in sqlite_master is either exported or explicitly excluded', () => {
    const { getExportTables, EXCLUDED_TABLES } = require('../routes/export');
    const allDbTables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all().map(t => t.name);

    const exportedTables = getExportTables(db);
    const exportedSet = new Set(exportedTables);

    for (const table of allDbTables) {
      const isExported = exportedSet.has(table);
      const isExcluded = EXCLUDED_TABLES.has(table);
      assert.ok(isExported || isExcluded,
        `Table '${table}' is neither exported nor in the exclusion list`);
    }
  });

  it('step_logs, tdee_history and goal are all exported', () => {
    const { getExportTables } = require('../routes/export');
    const tables = getExportTables(db);
    assert.ok(tables.includes('step_logs'), 'step_logs must be in export');
    assert.ok(tables.includes('tdee_history'), 'tdee_history must be in export');
    assert.ok(tables.includes('goal'), 'goal must be in export');
  });

  it('legacy nine tables are in original order', () => {
    const { getExportTables } = require('../routes/export');
    const tables = getExportTables(db);
    const legacyOrder = [
      'food_logs', 'exercise_logs', 'workout_sessions', 'workout_sets',
      'weight_logs', 'sleep_logs', 'measurement_logs', 'weekly_summary',
      'reward_bank_ledger',
    ];
    let lastIndex = -1;
    for (const t of legacyOrder) {
      const idx = tables.indexOf(t);
      assert.ok(idx > lastIndex, `${t} should come after previous legacy table (index ${idx} > ${lastIndex})`);
      lastIndex = idx;
    }
  });
});
