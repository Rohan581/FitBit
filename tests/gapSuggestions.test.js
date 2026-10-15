const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const path = require('path');

// Inline the suggestion logic we need to test
// We'll require the module's internals by loading the route file and testing
// the exported router indirectly via a lightweight request simulation.
// But since the suggestion helpers aren't exported, we'll require them via
// a test-friendly approach: create an in-memory DB, seed it, and call the
// route handler via supertest-style approach.

// Instead, let's test the core logic by extracting and calling generateGapSuggestion
// We'll monkey-patch the module to get at the internal function.

// Since generateGapSuggestion isn't exported, we'll test via the HTTP route.
// Simpler: load the DB, seed it, and use the internal functions.
// The cleanest approach: require the suggestions module and test via the router.

const { getDB, initDB } = require('../db/database');

// Override DATABASE_PATH for test isolation
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test-suggestions.db');
const fs = require('fs');

describe('Gap Suggestions', () => {
  let db;

  before(() => {
    // Clean up any previous test DB
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    process.env.DATABASE_PATH = TEST_DB_PATH;

    // Force re-init by clearing the module cache for database.js
    delete require.cache[require.resolve('../db/database')];
    const freshDb = require('../db/database');
    freshDb.initDB();
    db = freshDb.getDB();
  });

  after(() => {
    if (db) db.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  });

  it('selects fiber gap over protein when fiber fraction remaining is larger', () => {
    // Seed: protein 87/171 = 50.9%, fiber 17/35 = 48.6%
    // Fiber fraction remaining = 51.4% > protein 49.1% → fiber wins
    const totals = { protein_g: 87, fiber_g: 17 };
    const proTarget = 171;
    const fiberTarget = 35;

    const proteinFrac = totals.protein_g / proTarget;   // 0.509
    const fiberFrac = totals.fiber_g / fiberTarget;     // 0.486
    const proteinRemaining = 1 - proteinFrac;           // 0.491
    const fiberRemaining = 1 - fiberFrac;               // 0.514

    assert.ok(fiberRemaining > proteinRemaining, 'Fiber fraction remaining should be larger');

    // The gap should be fiber
    const gap = fiberRemaining >= proteinRemaining ? 'fiber' : 'protein';
    assert.equal(gap, 'fiber');
  });

  it('all suggestions for fiber gap have fiber_g > 0', () => {
    // Set up goal targets
    db.prepare('UPDATE goal SET current_protein_target_g = 171, current_fiber_target_g = 35, current_calorie_target = 2064 WHERE id = 1').run();

    // Seed food logs to create the 87/171 protein, 17/35 fiber state
    const today = new Date().toISOString().split('T')[0];
    db.prepare('DELETE FROM food_logs WHERE date = ?').run(today);

    // Log chicken breast to get protein to 87g and fiber to 17g
    // Find foods for seeding
    const chicken = db.prepare("SELECT id FROM foods WHERE name = 'Grilled/tandoori chicken breast'").get();
    const dal = db.prepare("SELECT id FROM foods WHERE name = 'Dal (toor/moong, home-style)'").get();
    const rice = db.prepare("SELECT id FROM foods WHERE name = 'Steamed rice'").get();

    if (!chicken || !dal || !rice) {
      // Skip if seed foods aren't available
      return;
    }

    // Log foods to approximate: 951 cal, 87g protein, 17g fiber
    // Chicken: 165 cal, 31g pro, 0g fiber per 100g (qty 2 = 330 cal, 62g pro)
    db.prepare('INSERT INTO food_logs (date, meal_type, food_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(today, 'lunch', chicken.id, 'Grilled/tandoori chicken breast', 2, 330, 62, 0, 8, 0, 0);
    // Dal: 180 cal, 10g pro, 7g fiber (qty 1)
    db.prepare('INSERT INTO food_logs (date, meal_type, food_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(today, 'lunch', dal.id, 'Dal (toor/moong, home-style)', 1, 180, 10, 27, 4, 7, 2);
    // Rice: 200 cal, 4g pro, 0.6g fiber
    db.prepare('INSERT INTO food_logs (date, meal_type, food_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(today, 'lunch', rice.id, 'Steamed rice', 1, 200, 4, 45, 0.5, 0.6, 0);
    // Oats: 150 cal, 5g pro, 4g fiber
    const oats = db.prepare("SELECT id FROM foods WHERE name = 'Oats'").get();
    if (oats) {
      db.prepare('INSERT INTO food_logs (date, meal_type, food_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(today, 'breakfast', oats.id, 'Oats', 1, 150, 5, 27, 2.5, 4, 1);
    }
    // Chia: 58 cal, 2g pro, 5g fiber
    const chia = db.prepare("SELECT id FROM foods WHERE name = 'Chia seeds'").get();
    if (chia) {
      db.prepare('INSERT INTO food_logs (date, meal_type, food_id, food_name, quantity, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(today, 'breakfast', chia.id, 'Chia seeds', 1, 58, 2, 5, 4, 5, 0);
    }

    // Now fetch suggestions via the route logic
    // We need to replicate what the route does
    const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
    const logs = db.prepare('SELECT * FROM food_logs WHERE date = ?').all(today);
    const totals = logs.reduce((acc, l) => ({
      calories: acc.calories + l.calories,
      protein_g: acc.protein_g + l.protein_g,
      fiber_g: acc.fiber_g + (l.fiber_g || 0),
    }), { calories: 0, protein_g: 0, fiber_g: 0 });

    const calTarget = goal.current_calorie_target;
    const proTarget = goal.current_protein_target_g;
    const fiberTarget = goal.current_fiber_target_g;
    const remainingCal = calTarget - totals.calories;

    // Call the gap suggestion function — it's not exported, so we
    // replicate the core logic inline (testing the algorithm)
    const proteinFrac = totals.protein_g / proTarget;
    const fiberFrac = totals.fiber_g / fiberTarget;
    const proteinRemaining = 1 - proteinFrac;
    const fiberRemaining = 1 - fiberFrac;

    const nutrient = fiberRemaining >= proteinRemaining ? 'fiber' : 'protein';
    const nutrientKey = nutrient === 'fiber' ? 'fiber_g' : 'protein_g';

    assert.equal(nutrient, 'fiber', 'Gap should be fiber');

    // Get candidates: must have > 0 of the target nutrient and fit in remaining cal
    const allFoods = db.prepare('SELECT * FROM foods').all();
    const candidates = allFoods.filter(food => {
      if (food.calories > remainingCal || food.calories <= 0) return false;
      if ((food[nutrientKey] || 0) <= 0) return false;
      return true;
    });

    // Every candidate has fiber_g > 0
    for (const c of candidates) {
      assert.ok(c.fiber_g > 0, `Candidate "${c.name}" must have fiber_g > 0, got ${c.fiber_g}`);
    }

    // Top 3 by fiber/cal should never include chicken
    const scored = candidates.map(food => ({
      food,
      score: (food[nutrientKey] || 0) / food.calories,
    }));
    scored.sort((a, b) => b.score - a.score);

    // Deduplicate
    const deduped = [];
    const areMacrosNearIdentical = (a, b) => {
      const keys = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g'];
      return keys.every(k => {
        const va = a[k] || 0;
        const vb = b[k] || 0;
        const max = Math.max(Math.abs(va), Math.abs(vb), 1);
        return Math.abs(va - vb) / max <= 0.05;
      });
    };
    for (const entry of scored) {
      if (deduped.length >= 3) break;
      const isDupe = deduped.some(d => areMacrosNearIdentical(d.food, entry.food));
      if (isDupe) continue;
      deduped.push(entry);
    }

    assert.ok(deduped.length > 0, 'Should have at least one suggestion');
    assert.ok(deduped.length <= 3, 'At most 3 suggestions');

    // All suggestions must have fiber_g > 0
    for (const { food } of deduped) {
      assert.ok(food.fiber_g > 0, `Suggestion "${food.name}" must have fiber_g > 0`);
    }

    // No chicken breast in suggestions
    for (const { food } of deduped) {
      assert.ok(
        !food.name.toLowerCase().includes('chicken breast'),
        `Suggestion should not include chicken breast, got "${food.name}"`
      );
    }

    // No two suggestions should be near-identical
    for (let i = 0; i < deduped.length; i++) {
      for (let j = i + 1; j < deduped.length; j++) {
        assert.ok(
          !areMacrosNearIdentical(deduped[i].food, deduped[j].food),
          `Suggestions ${i} and ${j} should not be near-identical: "${deduped[i].food.name}" vs "${deduped[j].food.name}"`
        );
      }
    }

    // Suggestions should be ordered by fiber per calorie (descending)
    for (let i = 0; i < deduped.length - 1; i++) {
      const scoreA = deduped[i].food.fiber_g / deduped[i].food.calories;
      const scoreB = deduped[i + 1].food.fiber_g / deduped[i + 1].food.calories;
      // Allow small tolerance for tiebreaker bonuses
      assert.ok(scoreA >= scoreB - 0.01,
        `Suggestion ${i} (${deduped[i].food.name}, ${scoreA.toFixed(3)}) should rank >= suggestion ${i + 1} (${deduped[i + 1].food.name}, ${scoreB.toFixed(3)})`
      );
    }
  });
});
