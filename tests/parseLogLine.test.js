const test = require('node:test');
const assert = require('node:assert');
const { parseLog, parseNutrientField, cleanLines, guessMeal } = require('../lib/parseLogLine');

// A fixed hour keeps meal-guessing deterministic.
const at = (hour) => ({ now: hour });
const one = (text, opts = {}) => {
  const { entries, errors } = parseLog(text, { ...at(20), ...opts });
  assert.deepStrictEqual(errors, [], `unexpected errors: ${JSON.stringify(errors)}`);
  assert.strictEqual(entries.length, 1, 'expected exactly one entry');
  return entries[0];
};

test('parses the canonical line', () => {
  const e = one('Dinner | Chicken 65, half plate | 350 kcal | 21g P | 11g C | 23g F | 1g Fib');
  assert.strictEqual(e.food_name, 'Chicken 65, half plate');
  assert.strictEqual(e.meal_type, 'dinner');
  assert.strictEqual(e.mealGuessed, false);
  assert.strictEqual(e.calories, 350);
  assert.strictEqual(e.protein_g, 21);
  assert.strictEqual(e.carbs_g, 11);
  assert.strictEqual(e.fat_g, 23);
  assert.strictEqual(e.fiber_g, 1);
  assert.strictEqual(e.sugar_g, null, 'unstated sugar must be null, not 0');
  assert.strictEqual(e.source, 'paste');
});

test('accepts label-first fields and any order', () => {
  const e = one('Lunch | Dal rice | Protein 28g | 720 kcal | Fat: 22g | carbs 95g');
  assert.strictEqual(e.calories, 720);
  assert.strictEqual(e.protein_g, 28);
  assert.strictEqual(e.carbs_g, 95);
  assert.strictEqual(e.fat_g, 22);
});

test('f is fat and fib is fibre, despite the shared prefix', () => {
  const e = one('Snack | Nuts | 200 kcal | 8g F | 3g Fib');
  assert.strictEqual(e.fat_g, 8);
  assert.strictEqual(e.fiber_g, 3);
});

test('both fibre spellings and sugar work', () => {
  const e = one('Snack | Guava | 68 kcal | 9g fiber | 15g sugar');
  assert.strictEqual(e.fiber_g, 9);
  assert.strictEqual(e.sugar_g, 15);
  const uk = one('Snack | Guava | 68 kcal | 9g fibre');
  assert.strictEqual(uk.fiber_g, 9);
});

test('a range becomes its midpoint', () => {
  assert.strictEqual(one('Snack | Chops | 500-560 kcal | 40g P').calories, 530);
  assert.strictEqual(one('Snack | Chops | 500 to 560 kcal | 40g P').calories, 530);
});

test('strips markdown noise, bullets, numbering and thousands separators', () => {
  const e = one('- **Dinner** | `Mandi` | 1,050 kcal | ~63g P');
  assert.strictEqual(e.food_name, 'Mandi');
  assert.strictEqual(e.calories, 1050);
  assert.strictEqual(e.protein_g, 63);
});

test('drops code fences and markdown table rules', () => {
  assert.deepStrictEqual(cleanLines('```\nx\n```'), ['x']);
  assert.deepStrictEqual(cleanLines('| --- | --- |\nLunch | X | 10 kcal'), ['Lunch | X | 10 kcal']);
});

test('guesses the meal from the hour and flags that it guessed', () => {
  assert.strictEqual(guessMeal(8), 'breakfast');
  assert.strictEqual(guessMeal(13), 'lunch');
  assert.strictEqual(guessMeal(17), 'snack');
  assert.strictEqual(guessMeal(21), 'dinner');
  const e = one('Paneer tikka | 400 kcal | 30g P', at(13));
  assert.strictEqual(e.meal_type, 'lunch');
  assert.strictEqual(e.mealGuessed, true);
});

test('meal aliases resolve', () => {
  assert.strictEqual(one('bf | Oats | 300 kcal').meal_type, 'breakfast');
  assert.strictEqual(one('snk | Nuts | 100 kcal').meal_type, 'snack');
  assert.strictEqual(one('Drinks | Coffee | 20 kcal').meal_type, 'drinks');
});

test('a bare saved-food name logs that food', () => {
  const foods = [{ id: 7, name: 'Whey Scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1, fiber_g: 0, sugar_g: 1 }];
  const e = one('whey scoop', { foods });
  assert.strictEqual(e.food_id, 7);
  assert.strictEqual(e.protein_g, 24);
  assert.strictEqual(e.source, 'saved');
  // ...and still honours an explicit meal
  assert.strictEqual(one('Breakfast | Whey Scoop', { foods }).meal_type, 'breakfast');
});

test('protein may be absent; calories may not', () => {
  const e = one('Snack | Black coffee | 5 kcal');
  assert.strictEqual(e.calories, 5);
  assert.strictEqual(e.protein_g, null);

  const { errors } = parseLog('Snack | Mystery | 20g P', at(20));
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0].error, /calorie/);
});

test('a line with no name is rejected', () => {
  const { errors } = parseLog('| 300 kcal | 20g P', at(20));
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0].error, /name/);
});

test('one bad line does not block the good ones', () => {
  const { entries, errors } = parseLog(
    ['Dinner | Mandi | 1050 kcal | 63g P', 'total nonsense here', 'Snack | Guava | 68 kcal | 9g Fib'].join('\n'),
    at(20)
  );
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].line, 2);
  assert.strictEqual(errors[0].raw, 'total nonsense here');
});

test('a repeated nutrient keeps the first and warns', () => {
  const e = one('Snack | X | 300 kcal | 20g P | 25g P');
  assert.strictEqual(e.protein_g, 20);
  assert.strictEqual(e.warnings.length, 1);
  assert.match(e.warnings[0], /second protein/);
});

test('an unrecognised extra field is kept as a warning, not silently dropped', () => {
  const e = one('Snack | X | 300 kcal | 20g P | served hot');
  assert.strictEqual(e.food_name, 'X');
  assert.match(e.warnings[0], /served hot/);
});

test('parseNutrientField rejects plain text', () => {
  assert.strictEqual(parseNutrientField('Chicken 65'), null);
  assert.strictEqual(parseNutrientField('half plate'), null);
  assert.deepStrictEqual(parseNutrientField('350 kcal'), { key: 'calories', value: 350 });
});

test('a real multi-line paste out of a chat', () => {
  const pasted = `
| | kcal | Protein | Carbs | Fat | Fibre |
|---|---|---|---|---|---|
Dinner | Chicken 65, half plate | 350 kcal | 21g P | 11g C | 23g F | 1g Fib
Dinner | Chicken soup | 420 kcal | 48g P | 16g C | 18g F | 3g Fib
  `;
  const { entries, errors } = parseLog(pasted, at(21));
  assert.strictEqual(entries.length, 2, `errors: ${JSON.stringify(errors)}`);
  assert.strictEqual(entries[0].calories + entries[1].calories, 770);
  assert.strictEqual(entries[0].protein_g + entries[1].protein_g, 69);
});
