const test = require('node:test');
const assert = require('node:assert');
const { dayReview, dayVerdict, contributors, totalsFor, rate, targetsFrom } = require('../lib/dayReview');

const GOAL = {
  current_calorie_target: 2173,
  current_protein_target_g: 166,
  current_carb_target_g: 236,
  current_fat_target_g: 63,
  current_fiber_target_g: 35,
  current_sugar_limit_g: 50,
};

const item = (food_name, calories, protein_g = 0, carbs_g = 0, fat_g = 0, fiber_g = 0, sugar_g = 0) =>
  ({ food_name, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g });

const noteFor = (notes, metric) => notes.find((n) => n.metric === metric);

test('totalsFor sums and flags a partial day', () => {
  const t = totalsFor([item('A', 100, 10), item('B', 200, 20)]);
  assert.strictEqual(t.calories, 300);
  assert.strictEqual(t.protein_g, 30);
  assert.strictEqual(t.partial, false);

  const p = totalsFor([{ food_name: 'X', calories: 100, protein_g: null }]);
  assert.strictEqual(p.partial, true, 'a null macro must mark the day partial');
  assert.strictEqual(p.protein_g, 0, 'but still count as 0 in the total');
});

test('an empty day produces no notes at all', () => {
  assert.deepStrictEqual(dayReview([], GOAL), []);
  assert.strictEqual(dayVerdict([]).status, 'todo');
});

test('contributors rank by the metric and carry their share', () => {
  const entries = [item('Mandi', 1050, 63), item('Guava', 68, 1), item('Soup', 420, 48)];
  const c = contributors(entries, 'calories');
  assert.strictEqual(c.total, 1538);
  assert.deepStrictEqual(c.rows.map((r) => r.entry.food_name), ['Mandi', 'Soup', 'Guava']);
  assert.ok(Math.abs(c.rows[0].share - 1050 / 1538) < 1e-9);

  // ranking changes with the metric
  assert.strictEqual(contributors(entries, 'protein').rows[0].entry.food_name, 'Mandi');
  // zero-value rows are dropped
  assert.strictEqual(contributors([item('Water', 0, 0)], 'calories').rows.length, 0);
});

test('rate applies the right shape per metric', () => {
  const t = targetsFrom(GOAL);
  assert.strictEqual(rate('calories', 2173, t), 'good');
  assert.strictEqual(rate('calories', 2500, t), 'warn');   // inside 20%
  assert.strictEqual(rate('calories', 3200, t), 'bad');
  assert.strictEqual(rate('protein', 166, t), 'good');
  assert.strictEqual(rate('protein', 140, t), 'warn');     // >= 80%
  assert.strictEqual(rate('protein', 90, t), 'bad');
  assert.strictEqual(rate('fat', 63, t), 'good');          // a ceiling: at the line is fine
  assert.strictEqual(rate('fat', 70, t), 'warn');
  assert.strictEqual(rate('fat', 100, t), 'bad');
  assert.strictEqual(rate('sugar', 50, t), 'good');
  assert.strictEqual(rate('sugar', 100, t), 'bad');
  assert.strictEqual(rate('carbs', 500, t), null, 'carbs are never rated');
});

test('a day in progress says "to go", never "short"', () => {
  const entries = [item('Breakfast', 478, 40, 30, 15, 5, 3)];
  const live = dayReview(entries, GOAL, { inProgress: true });
  assert.strictEqual(noteFor(live, 'protein').status, 'todo');
  assert.match(noteFor(live, 'protein').title, /to go/);
  assert.match(noteFor(live, 'calories').title, /left today/);

  const done = dayReview(entries, GOAL, { inProgress: false });
  assert.strictEqual(noteFor(done, 'protein').status, 'bad');
  assert.match(noteFor(done, 'protein').title, /short of/);
});

test('going over is flagged even on a day in progress', () => {
  // calories and sugar over are facts at any hour, unlike protein being unfinished
  const entries = [item('Cake', 2600, 20, 300, 90, 2, 180)];
  const notes = dayReview(entries, GOAL, { inProgress: true });
  // 2600 vs 2173 is +19.6% — inside twice the 10% band, so 'warn', not 'bad'
  assert.strictEqual(noteFor(notes, 'calories').status, 'warn');
  assert.match(noteFor(notes, 'calories').title, /over/, 'must say over, not "left today"');
  assert.strictEqual(noteFor(notes, 'sugar').status, 'bad');
  assert.strictEqual(noteFor(notes, 'fat').status, 'bad');

  // well past twice the band is 'bad' even mid-day
  const blowout = dayReview([item('Feast', 3200, 20, 300, 90, 2, 180)], GOAL, { inProgress: true });
  assert.strictEqual(noteFor(blowout, 'calories').status, 'bad');
});

test('a missed protein target names the calories that brought little protein', () => {
  const entries = [
    item('Biryani rice', 600, 8),     // 1.3 g/100 kcal -> empty
    item('Thekua', 180, 2),           // 1.1 g/100 kcal -> empty
    item('Grilled chicken', 300, 55), // 18 g/100 kcal  -> not empty
    item('Dal', 200, 12),             // 6 g/100 kcal   -> not empty
  ];
  const n = noteFor(dayReview(entries, GOAL), 'protein');
  assert.strictEqual(n.status, 'bad');
  assert.strictEqual(n.lead, 'Calories that brought little protein');
  assert.strictEqual(n.valueMetric, 'calories', 'these are listed by their calorie cost');
  const named = n.items.map((r) => r.entry.food_name);
  assert.deepStrictEqual(named, ['Biryani rice', 'Thekua']);
  assert.ok(!named.includes('Dal'), 'dal is 6 g per 100 kcal and must not be called empty');
});

test('with no empty calories, a short protein day shows where protein did come from', () => {
  const entries = [item('Egg whites', 100, 20), item('Curd', 120, 10)];
  const n = noteFor(dayReview(entries, GOAL), 'protein');
  assert.strictEqual(n.lead, 'Protein came from');
  assert.strictEqual(n.valueMetric, 'protein');
  assert.strictEqual(n.items[0].entry.food_name, 'Egg whites');
});

test('a hit protein target lists the best sources instead', () => {
  const entries = [item('Chicken', 600, 120), item('Whey', 120, 24), item('Curd', 120, 25)];
  const n = noteFor(dayReview(entries, GOAL), 'protein');
  assert.strictEqual(n.status, 'good');
  assert.strictEqual(n.lead, 'Best sources');
  assert.strictEqual(n.items[0].entry.food_name, 'Chicken');
});

test('notes are ordered worst first', () => {
  const entries = [item('Fried everything', 3000, 30, 200, 180, 2, 120)];
  const notes = dayReview(entries, GOAL);
  const order = notes.map((n) => n.status);
  const rank = { bad: 0, warn: 1, todo: 2, good: 3 };
  for (let i = 1; i < order.length; i++) {
    assert.ok(rank[order[i - 1]] <= rank[order[i]], `out of order: ${order.join(',')}`);
  }
  assert.strictEqual(notes[0].status, 'bad');
});

test('sugar under the limit produces no note, over produces one', () => {
  assert.strictEqual(noteFor(dayReview([item('X', 300, 30, 10, 5, 2, 10)], GOAL), 'sugar'), undefined);
  assert.ok(noteFor(dayReview([item('X', 300, 30, 10, 5, 2, 90)], GOAL), 'sugar'));
});

test('a target that is not set produces no note for that metric', () => {
  const partial = { current_calorie_target: 2000 };
  const notes = dayReview([item('X', 500, 20)], partial);
  assert.ok(noteFor(notes, 'calories'));
  assert.strictEqual(noteFor(notes, 'protein'), undefined);
  assert.strictEqual(noteFor(notes, 'fiber'), undefined);
});

test('dayVerdict summarises the worst status present', () => {
  assert.strictEqual(dayVerdict(dayReview([item('Bad', 4000, 10, 300, 200, 1, 200)], GOAL)).status, 'bad');
  const good = dayReview([item('Perfect', 2173, 170, 236, 60, 36, 20)], GOAL);
  assert.strictEqual(dayVerdict(good).status, 'good');
  assert.strictEqual(dayVerdict(good).text, 'All targets met');
});

test("Rohan's actual Sunday: 806 kcal by 7pm reads as in progress, not failure", () => {
  const entries = [item('Breakfast', 478, 40, 35, 18, 6, 4), item('Chicken bites', 205, 30, 12, 5, 1, 1), item('Thekua', 123, 2, 18, 5, 1, 10)];
  const notes = dayReview(entries, GOAL, { inProgress: true });
  assert.strictEqual(dayVerdict(notes).status, 'todo');
  assert.ok(notes.every((n) => n.status !== 'bad'), 'an unfinished day must not report failures');
  assert.match(noteFor(notes, 'protein').title, /to go/);
});
