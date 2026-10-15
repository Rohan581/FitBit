const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-bank.db');

// Shared setup
let db;
let reconcileMissingCredits, computeWeekPoints, calculateDailyPoints;

before(() => {
  try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  process.env.DATABASE_PATH = TEST_DB_PATH;

  // Clear module caches so we get fresh instances
  for (const key of Object.keys(require.cache)) {
    if (key.includes('database') || key.includes('routes/') || key.includes('dateUtils')) {
      delete require.cache[key];
    }
  }

  const freshDb = require('../db/database');
  freshDb.initDB();
  db = freshDb.getDB();

  // Set up goal with threshold
  db.prepare('UPDATE goal SET weekly_point_threshold = 425, reward_credit_amount = 2000 WHERE id = 1').run();

  const bank = require('../routes/bank');
  reconcileMissingCredits = bank.reconcileMissingCredits;
  computeWeekPoints = bank.computeWeekPoints;
  calculateDailyPoints = require('../routes/points').calculateDailyPoints;
});

after(() => {
  if (db) db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch {}
});

/**
 * Seed a week with enough activity to generate points.
 */
function seedWeekActivity(weekStart, daysWithFood, gymSessions) {
  const days = [];
  const d = new Date(weekStart + 'T12:00:00Z');
  for (let i = 0; i < 7; i++) {
    days.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const calTarget = goal.current_calorie_target || 2240;

  for (let i = 0; i < Math.min(daysWithFood, 7); i++) {
    const date = days[i];
    db.prepare('INSERT OR IGNORE INTO food_logs (date, meal_type, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(date, 'lunch', 'Test meal', 1, calTarget - 50, 180, 200, 50, 35, 10);
    db.prepare('INSERT OR IGNORE INTO sleep_logs (date, hours) VALUES (?, ?)').run(date, 7.5);
    db.prepare('INSERT OR IGNORE INTO weight_logs (date, weight_kg) VALUES (?, ?)').run(date, 85);
    if (i < gymSessions) {
      db.prepare('INSERT OR IGNORE INTO exercise_logs (date, type, duration_min, intensity) VALUES (?, ?, ?, ?)')
        .run(date, 'gym', 60, 'moderate');
    }
  }
}

describe('Reward Bank Reconciliation', () => {
  it('reconciles exactly one missing credit from four seeded weeks', () => {
    // Week 1: over threshold WITH a credit already (should be skipped)
    const week1 = '2026-09-07';
    seedWeekActivity(week1, 7, 4);
    db.prepare(
      "INSERT INTO reward_bank_ledger (date, delta, kind, description, week_start) VALUES (?, ?, ?, ?, ?)"
    ).run('2026-09-13', 2000, 'weekly_credit', 'Weekly reward — threshold met', week1);
    db.prepare('UPDATE reward_bank SET balance = balance + 2000 WHERE id = 1').run();

    // Week 2: over threshold WITHOUT a credit (should be credited by reconciliation)
    const week2 = '2026-09-14';
    seedWeekActivity(week2, 7, 4);

    // Week 3: under threshold WITHOUT a credit (should NOT be credited)
    const week3 = '2026-09-21';
    seedWeekActivity(week3, 2, 0);

    // Week 4: over threshold with a backfilled credit already present (should be skipped)
    const week4 = '2026-09-28';
    seedWeekActivity(week4, 7, 4);
    db.prepare(
      "INSERT INTO reward_bank_ledger (date, delta, kind, description, week_start) VALUES (?, ?, ?, ?, ?)"
    ).run('2026-10-04', 2000, 'weekly_credit', 'Weekly reward — backfill', week4);
    db.prepare('UPDATE reward_bank SET balance = balance + 2000 WHERE id = 1').run();

    const balanceBefore = db.prepare('SELECT balance FROM reward_bank WHERE id = 1').get().balance;
    const creditCountBefore = db.prepare(
      "SELECT COUNT(*) as cnt FROM reward_bank_ledger WHERE kind = 'weekly_credit'"
    ).get().cnt;

    const credited = reconcileMissingCredits(db);

    const balanceAfter = db.prepare('SELECT balance FROM reward_bank WHERE id = 1').get().balance;
    const creditCountAfter = db.prepare(
      "SELECT COUNT(*) as cnt FROM reward_bank_ledger WHERE kind = 'weekly_credit'"
    ).get().cnt;

    assert.equal(creditCountAfter - creditCountBefore, 1, 'Should add exactly one credit row');
    assert.equal(balanceAfter - balanceBefore, 2000, 'Balance should increase by 2000');

    const newCredit = db.prepare(
      "SELECT * FROM reward_bank_ledger WHERE kind = 'weekly_credit' AND week_start = ?"
    ).get(week2);
    assert.ok(newCredit, 'Credit should exist for week 2');
    assert.equal(newCredit.delta, 2000);
    assert.ok(newCredit.description.includes('backfill'), 'Description should mention backfill');

    // Second run adds nothing
    reconcileMissingCredits(db);
    const creditCountFinal = db.prepare(
      "SELECT COUNT(*) as cnt FROM reward_bank_ledger WHERE kind = 'weekly_credit'"
    ).get().cnt;
    assert.equal(creditCountFinal, creditCountAfter, 'Second run should not add any credits');
  });

  it('weekly_summary.total_points is populated after computeWeekPoints', () => {
    const weekStart = '2026-09-07';
    const total = computeWeekPoints(db, weekStart);
    const stored = db.prepare('SELECT total_points FROM weekly_summary WHERE week_start = ?').get(weekStart);
    assert.ok(stored, 'weekly_summary row should exist');
    assert.ok(stored.total_points > 0, `total_points should be > 0, got ${stored.total_points}`);
    assert.equal(stored.total_points, total, 'Stored total should match computed total');
  });
});

describe('Calorie Points Rule', () => {
  it('awards 20 pts for eating at or under calorie target', () => {
    const date = '2026-11-01';
    db.prepare('DELETE FROM food_logs WHERE date = ?').run(date);
    db.prepare('DELETE FROM exercise_logs WHERE date = ?').run(date);
    db.prepare('DELETE FROM sleep_logs WHERE date = ?').run(date);
    db.prepare('DELETE FROM weight_logs WHERE date = ?').run(date);

    const goal = db.prepare('SELECT current_calorie_target FROM goal WHERE id = 1').get();
    const target = goal.current_calorie_target;

    // Log food at 80% of target (under, but above 60% floor)
    db.prepare('INSERT INTO food_logs (date, meal_type, food_name, quantity, calories, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(date, 'lunch', 'Test', 1, target * 0.8, 100, 150, 40);

    const result = calculateDailyPoints(db, date);
    const calEntry = result.breakdown.find(b => b.category === 'calories');
    assert.ok(calEntry, 'Should have a calories breakdown entry');
    assert.equal(calEntry.points, 20, 'Should award 20 pts for under-target eating');
  });

  it('awards 0 pts for eating below 60% of calorie target', () => {
    const date = '2026-11-02';
    db.prepare('DELETE FROM food_logs WHERE date = ?').run(date);
    db.prepare('DELETE FROM exercise_logs WHERE date = ?').run(date);
    db.prepare('DELETE FROM sleep_logs WHERE date = ?').run(date);
    db.prepare('DELETE FROM weight_logs WHERE date = ?').run(date);

    const goal = db.prepare('SELECT current_calorie_target FROM goal WHERE id = 1').get();
    const target = goal.current_calorie_target;

    // Log food at 50% of target (below 60% floor)
    db.prepare('INSERT INTO food_logs (date, meal_type, food_name, quantity, calories, protein_g, carbs_g, fat_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(date, 'lunch', 'Test', 1, target * 0.5, 50, 100, 20);

    const result = calculateDailyPoints(db, date);
    const calEntry = result.breakdown.find(b => b.category === 'calories');
    assert.ok(calEntry, 'Should have a calories breakdown entry');
    assert.equal(calEntry.points, 0, 'Should award 0 pts for under-eating below 60%');
  });
});
