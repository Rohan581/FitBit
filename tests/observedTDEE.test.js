const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-tdee.db');

let db;
let computeObservedTDEE, deriveMacrosFromTDEE;

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
 *   weightChange = 86.0 - 87.0 = -1.0 kg
 *   observedTDEE = 1900 + (-1.0 × 7700) / 28
 *                = 1900 + (-7700) / 28
 *                = 1900 - 275
 *                = 1625
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

    // Observed TDEE should be near 1625 (1900 - 275)
    // Allow some slack for random weight variation
    assert.ok(result.raw_observed >= 1500 && result.raw_observed <= 1750,
      `raw observed ${result.raw_observed} should be near 1625`);

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
  it('applies max(1600, 22 × bodyweight) floor', () => {
    // 87 kg person: floor = max(1600, 22 * 87) = max(1600, 1914) = 1914
    const result = deriveMacrosFromTDEE(1800, 0.25, 87);
    // Without floor: 1800 * 0.75 = 1350 → below 1914
    assert.equal(result.calorie_target, 1914, 'should be floored to 22 × 87 = 1914');
    assert.equal(result.floored, true, 'should flag as floored');
  });

  it('does not floor when target is above minimum', () => {
    const result = deriveMacrosFromTDEE(2700, 0.21, 87);
    // 2700 * 0.79 = 2133 > 1914
    assert.equal(result.calorie_target, 2133, 'should not be floored');
    assert.equal(result.floored, false, 'should not flag as floored');
  });

  it('uses 1600 floor for lightweight users', () => {
    // 60 kg person: floor = max(1600, 22 * 60) = max(1600, 1320) = 1600
    const result = deriveMacrosFromTDEE(1800, 0.25, 60);
    // Without floor: 1800 * 0.75 = 1350 → below 1600
    assert.equal(result.calorie_target, 1600, 'should be floored to 1600');
    assert.equal(result.floored, true, 'should flag as floored');
  });

  it('protein is always at least max(160, 2 × bodyweight)', () => {
    const result = deriveMacrosFromTDEE(2700, 0.21, 87);
    assert.ok(result.protein_target >= 174, `protein ${result.protein_target} should be >= 2×87=174`);
  });
});
