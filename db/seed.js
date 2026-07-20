function toSeedKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// [name, category, serving_unit, serving_size, cal, pro, carbs, fat, fiber, sugar, units_json, default_unit]
const SEED_FOODS = [
  // ── Daily rotation staples ─────────────────────────────────────
  ['Steamed rice',                  'staple', '1 cup (150g)',  150, 200, 4,    45,   0.5,  0.6,  0,   JSON.stringify([{unit:'1 cup (150g)',multiplier:1},{unit:'100g',multiplier:0.667},{unit:'1/2 cup',multiplier:0.5}]), null],
  ['Roti (whole wheat, plain)',     'staple', '1 piece',         1,  85, 3,    15,   1.5,  2.5,  0.5, JSON.stringify([{unit:'1 piece',multiplier:1},{unit:'grams',multiplier:0.025}]), null],
  ['Dal (toor/moong, home-style)',  'staple', '1 cup',         240, 180, 10,   27,   4,    7,    2,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}]), null],
  ['Chicken curry (home-style)',    'staple', '1 cup',         240, 280, 28,    8,  15,    1,    2,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}]), null],
  ['Grilled/tandoori chicken breast','staple','100g',          100, 165, 31,    0,   4,    0,    0,   JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5},{unit:'200g',multiplier:2}]), null],
  ['Chicken tikka',                 'staple', '100g',          100, 200, 25,    4,  10,    0,    1,   JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5}]), null],
  ['Prawn curry (home-style)',      'staple', '1 cup',         240, 230, 22,    8,  13,    1,    2,   null, null],
  ['Grilled/sauteed prawns (plain)','staple', '100g',          100, 120, 24,    1,   1.5,  0,    0,   JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5}]), null],
  ['Prawn masala/fry',              'staple', '100g',          100, 180, 20,    6,   8,    0.5,  1,   null, null],
  ['Flour tortilla (plain, medium)','staple', '1 piece',         1, 140,  4,   24,   3.5,  1.5,  1,   JSON.stringify([{unit:'1 piece',multiplier:1}]), null],
  ['Chicken burrito/wrap',          'staple', '1 wrap',          1, 450, 30,   45,  15,    3,    3,   null, null],
  ['Chicken tortilla tacos',        'staple', '1 serving',       1, 350, 25,   30,  14,    2.5,  2,   null, null],
  ['Curd/yogurt (plain)',           'staple', '1 cup',         240, 150,  8,   11,   8,    0,    8,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}]), null],
  ['Boiled eggs',                   'staple', '1 large',         1,  78, 6.5,  0.5,  5.5,  0,    0.5, JSON.stringify([{unit:'1 large',multiplier:1},{unit:'2 large',multiplier:2}]), null],
  ['Plain omelette (2 eggs)',       'staple', '1 serving',       1, 180, 13,    2,  14,    0,    0.5, null, null],

  // ── Home-cooked Indian ─────────────────────────────────────────
  ['Rajma curry',            'home-cooked', '1 cup',  240, 220, 12, 30,  6,   11,   3,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}]), null],
  ['Chole (chickpea curry)', 'home-cooked', '1 cup',  240, 260, 11, 35,  9,   12,   5,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}]), null],
  ['Paneer curry',           'home-cooked', '1 cup',  240, 350, 16, 12, 26,    1,   3,   null, null],
  ['Egg curry (2 eggs)',     'home-cooked', '1 serving', 1, 260, 16,  8, 18,    1,   2,   null, null],
  ['Mixed vegetable sabzi',  'home-cooked', '1 cup',  240, 140,  4, 18,  6,    4,   4,   null, null],
  ['Bhindi masala',          'home-cooked', '1 cup',  240, 160,  3, 14, 10,    3.5, 3,   null, null],
  ['Palak paneer',           'home-cooked', '1 cup',  240, 300, 14, 10, 22,    3,   2,   null, null],
  ['Sambar',                 'home-cooked', '1 cup',  240, 130,  6, 20,  3,    5,   3,   null, null],
  ['Rasam',                  'home-cooked', '1 cup',  240,  60,  2, 10,  1.5,  1,   2,   null, null],
  ['Aloo sabzi (dry)',       'home-cooked', '1 cup',  240, 200,  3, 30,  8,    3,   2,   null, null],
  ['Khichdi',                'home-cooked', '1 cup',  240, 220,  7, 38,  5,    4,   1,   null, null],
  ['Poha',                   'home-cooked', '1 cup',  240, 250,  5, 42,  7,    2,   2,   null, null],
  ['Upma',                   'home-cooked', '1 cup',  240, 230,  6, 35,  8,    2,   1,   null, null],
  ['Idli',                   'home-cooked', '2 pieces', 2,  78,  2, 16,  0.3,  1,   0.5, JSON.stringify([{unit:'2 pieces',multiplier:1},{unit:'1 piece',multiplier:0.5}]), null],
  ['Dosa (plain)',            'home-cooked', '1 piece',  1, 120,  3, 20,  3.5,  1,   0.5, null, null],
  ['Masala dosa',            'home-cooked', '1 piece',  1, 250,  5, 35, 10,    2,   1,   null, null],
  ['Paratha (plain)',        'home-cooked', '1 piece',  1, 150,  3, 20,  6,    1.5, 0.5, null, null],
  ['Aloo paratha',           'home-cooked', '1 piece',  1, 220,  5, 30,  9,    2,   1,   null, null],

  // ── Restaurant / street food ───────────────────────────────────
  ['Butter chicken',         'restaurant', '1 cup',    240, 490, 25, 12, 38,   1,   4,   null, null],
  ['Biryani (chicken)',      'restaurant', '1 plate',    1, 550, 22, 65, 22,   2,   3,   null, null],
  ['Biryani (veg)',          'restaurant', '1 plate',    1, 450,  8, 70, 15,   3,   3,   null, null],
  ['Pav bhaji',              'restaurant', '1 plate',    1, 500, 10, 60, 24,   4,   5,   null, null],
  ['Samosa',                 'restaurant', '1 piece',    1, 260,  4, 30, 14,   2,   2,   null, null],
  ['Vada pav',               'restaurant', '1 piece',    1, 290,  6, 40, 12,   2,   3,   null, null],
  ['Pani puri',              'restaurant', '6 pieces',   6, 200,  4, 30,  7,   1.5, 3,   null, null],
  ['Chicken shawarma roll',  'restaurant', '1 roll',     1, 450, 25, 40, 20,   2,   3,   null, null],
  ['Margherita pizza',       'restaurant', '2 slices',   2, 400, 16, 45, 16,   1.5, 3,   null, null],
  ['Veg fried rice',         'restaurant', '1 plate',    1, 430,  8, 65, 14,   2,   2,   null, null],
  ['Chicken fried rice',     'restaurant', '1 plate',    1, 480, 20, 60, 15,   1.5, 2,   null, null],
  ['Gulab jamun',            'restaurant', '1 piece',    1, 150,  2, 20,  7,   0.3, 18,  null, null],
  ['Jalebi',                 'restaurant', '100g',     100, 300,  3, 50, 10,   0,   30,  null, null],
  ['Ice cream (regular scoop)','restaurant','1 scoop',   1, 200,  3, 24, 10,   0.5, 16,  null, null],

  // ── Snacks / packaged ──────────────────────────────────────────
  ['Banana',                    'snack', '1 medium',   1, 105, 1.3, 27,  0.4, 3.1, 14,  null, null],
  ['Almonds',                   'snack', '10 pieces', 10,  70, 2.5,2.5,  6,   1.5, 0.5, JSON.stringify([{unit:'10 pieces',multiplier:1},{unit:'20 pieces',multiplier:2},{unit:'30g',multiplier:1.8}]), null],
  ['Peanuts (roasted)',         'snack', '30g',       30, 170, 7,   5,  14,   2.5, 1,   null, null],
  ['Protein shake (whey, water)','snack','1 scoop',    1, 120, 24,  3,  1.5,  0,   1,   null, null],
  ['Greek yogurt (plain)',      'snack', '1 tbsp',    15,  17, 2.5, 1.1, 0.1, 0,   1.1, JSON.stringify([{unit:'1 tbsp',multiplier:1},{unit:'2 tbsp',multiplier:2},{unit:'1/2 cup',multiplier:8},{unit:'1 cup',multiplier:16}]), null],
  ['Digestive biscuits',        'snack', '2 pieces',   2, 140, 2,  20,  6,   0.5, 5,   null, null],
  ['Namkeen mixture',           'snack', '30g',       30, 150, 4,  15,  9,   1,   1.5, null, null],
  ['Dark chocolate (70%+)',     'snack', '20g',       20, 110, 1.5, 8,  8,   2,   5,   null, null],
  ['Oats',                      'snack', '40g',       40, 150, 5,  27,  2.5, 4,   1,   JSON.stringify([{unit:'40g',multiplier:1},{unit:'1/2 cup',multiplier:1},{unit:'1 cup',multiplier:2}]), null],
  ['Honey',                     'snack', '1 tbsp',     1,  64, 0,  17,  0,   0,   17,  null, null],
  ['Chia seeds',                'snack', '1 tbsp',     1,  58, 2,   5,  4,   5,   0,   JSON.stringify([{unit:'1 tbsp',multiplier:1},{unit:'2 tbsp',multiplier:2}]), null],
  ['Almond milk (unsweetened)', 'snack', '1 cup',    240,  40, 1,   2,  3,   0.5, 0,   null, null],
  ['Blueberries',               'snack', '1/2 cup',    1,  42, 0.5,11,  0.2, 1.8, 7,   JSON.stringify([{unit:'1/2 cup',multiplier:1},{unit:'1 cup',multiplier:2}]), null],
  ['Whey protein powder',       'snack', '24g',       24,  90, 20,  2,  1,   0,   1,   null, null],

  // ── Fruits ─────────────────────────────────────────────────────
  ['Apple',                     'snack', '1 medium',   1,  95, 0.5, 25,  0.3, 4.4, 19,  null, null],
  ['Orange',                    'snack', '1 medium',   1,  62, 1.2, 15,  0.2, 3.1, 12,  null, null],
  ['Grapes',                    'snack', '1 cup',      1,  62, 0.6, 16,  0.3, 0.8, 15,  null, null],
  ['Guava',                     'snack', '1 fruit',    1,  68, 2.6, 14,  1,   9,   9,   null, null],

  // ── Additional proteins ────────────────────────────────────────
  ['Chicken thigh (cooked, skinless)', 'staple', '100g', 100, 209, 26, 0, 11, 0, 0, JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5}]), null],
  ['Prawns (cooked, plain)',    'staple', '100g',     100, 120, 24,  1,  1.5, 0,   0,   JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5}]), null],
  ['Eggs (boiled)',             'staple', '1 large',    1,  78, 6.5, 0.5, 5.5, 0,   0.5, JSON.stringify([{unit:'1 large',multiplier:1},{unit:'2 large',multiplier:2}]), null],

  // ── Staples & vegetables ───────────────────────────────────────
  ['Potato (boiled)',           'staple', '1 medium',   1, 130, 3,  30,  0.1, 3,   1.5, null, null],
  ['Cucumber',                  'snack',  '1 cup sliced', 1, 16, 0.7, 4,  0.1, 0.5, 1.7, null, null],
  ['Tomato',                    'snack',  '1 medium',   1,  22, 1.1, 4.8, 0.2, 1.5, 3.2, null, null],
  ['Onion (raw)',               'staple', '1 medium',   1,  44, 1.2, 10,  0.1, 1.9, 4.7, null, null],

  // ── Indulgent / restaurant ─────────────────────────────────────
  ['Sandwich (chicken, standard)', 'restaurant', '1 sandwich', 1, 350, 22, 38, 12, 3, 5, null, null],
  ['Pasta (red/white sauce)',      'restaurant', '1 plate',    1, 480, 14, 65, 17, 4, 8, null, null],
  ['Pizza (2 slices, regular)',    'restaurant', '2 slices',   2, 400, 16, 45, 16, 3, 6, null, null],
  ['Burger (chicken)',             'restaurant', '1 burger',   1, 450, 22, 42, 21, 2.5, 8, null, null],
  ['Chicken biryani',             'restaurant', '1 plate',    1, 550, 22, 65, 22, 2, 3, null, null],
  ['Fried chicken',               'restaurant', '2 pieces',   2, 490, 32, 18, 32, 1, 0.5, null, null],

  // ── Beverages (non-alcoholic) ──────────────────────────────────
  ['Diet coke',                       'beverage', '1 can (300 ml)',    1,   1,   0,    0,   0,   0,    0,   null, null],
  ['Regular cola',                    'beverage', '1 can (300 ml)',    1, 130,   0,   35,   0,   0,   35,   null, null],
  ['Masala chai (with sugar)',        'beverage', '1 cup',           240,  90,   2,   12,   3,   0,   10,   null, null],
  ['Filter coffee (with sugar)',     'beverage', '1 cup',           240,  70, 1.5,   10, 2.5,   0,    8,   null, null],
  ['Black coffee (no sugar)',        'beverage', '1 cup',           240,   2, 0.3,    0,   0,   0,    0,   null, null],
  ['Lassi (sweet)',                   'beverage', '1 glass (250 ml)', 250, 180,  6,   28,   5,   0,   26,   null, null],
  ['Buttermilk/chaas (salted)',      'beverage', '1 glass (250 ml)', 250,  45,   3,    4, 1.5,   0,    3,   null, null],
  ['Fresh lime soda (sweet)',        'beverage', '1 glass',            1,  95,   0,   24,   0,   0,   22,   null, null],
  ['Orange juice (fresh)',           'beverage', '1 glass (250 ml)', 250, 110, 1.7,   26, 0.5, 0.5,   21,   null, null],
  ['Coconut water',                  'beverage', '1 glass (250 ml)', 250,  46, 1.7,    9, 0.5, 2.6,    6,   null, null],

  // ── Alcohol — single-ingredient (per 100ml base, scale by volume) ──
  ['Beer (regular, 5% ABV)',    'alcohol', '100ml', 100,  42, 0.5, 3.7,  0, 0, 0,
    JSON.stringify([
      {unit:'Small bottle (330ml)',multiplier:3.3},
      {unit:'Can (355ml)',multiplier:3.55},
      {unit:'Large bottle (650ml)',multiplier:6.5},
      {unit:'Custom ml',multiplier:0.01}
    ]), 'Can (355ml)'],
  ['Beer (light)',              'alcohol', '100ml', 100,  29, 0.3, 1.7,  0, 0, 0,
    JSON.stringify([
      {unit:'Small bottle (330ml)',multiplier:3.3},
      {unit:'Can (355ml)',multiplier:3.55},
      {unit:'Large bottle (650ml)',multiplier:6.5},
      {unit:'Custom ml',multiplier:0.01}
    ]), 'Can (355ml)'],
  ['Whisky/rum/vodka (neat)',   'alcohol', '100ml', 100, 217,   0,   0,  0, 0, 0,
    JSON.stringify([
      {unit:'Small peg (30ml)',multiplier:0.3},
      {unit:'Large peg (60ml)',multiplier:0.6},
      {unit:'Triple (90ml)',multiplier:0.9},
      {unit:'Custom ml',multiplier:0.01}
    ]), 'Small peg (30ml)'],
  ['Wine (red or white)',       'alcohol', '100ml', 100,  83, 0.1, 2.7,  0, 0, 0.7,
    JSON.stringify([
      {unit:'Small glass (100ml)',multiplier:1},
      {unit:'Standard glass (150ml)',multiplier:1.5},
      {unit:'Large glass (200ml)',multiplier:2},
      {unit:'Custom ml',multiplier:0.01}
    ]), 'Standard glass (150ml)'],

  // ── Alcohol — combo drinks (per-peg/drink base, scale by count) ──
  ['Whisky/rum/vodka + regular cola or soda', 'alcohol', '1 peg', 1, 115, 0, 13, 0, 0, 13,
    JSON.stringify([
      {unit:'1 peg',multiplier:1},
      {unit:'2 pegs',multiplier:2},
      {unit:'3 pegs',multiplier:3}
    ]), '1 peg'],
  ['Whisky/rum/vodka + diet soda/diet coke',  'alcohol', '1 peg', 1,  66, 0, 0.5, 0, 0, 0,
    JSON.stringify([
      {unit:'1 peg',multiplier:1},
      {unit:'2 pegs',multiplier:2},
      {unit:'3 pegs',multiplier:3}
    ]), '1 peg'],
  ['Cocktail (standard, mixed)',               'alcohol', '1 drink (~250ml)', 1, 200, 0.2, 18, 0.1, 0, 15,
    JSON.stringify([
      {unit:'1 drink',multiplier:1},
      {unit:'2 drinks',multiplier:2}
    ]), '1 drink'],
];

/**
 * Idempotent per-item food seeding. Runs on every startup.
 * Inserts only if no row with that seed_key exists yet.
 * Never overwrites existing rows (user may have customized defaults).
 */
function seedFoods(db) {
  const upsert = db.prepare(`
    INSERT OR IGNORE INTO foods
      (seed_key, name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, units, default_unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const inserted = [];
  db.transaction(() => {
    for (const [name, category, serving_unit, serving_size, cal, pro, carbs, fat, fiber, sugar, units, default_unit] of SEED_FOODS) {
      const seed_key = toSeedKey(name);
      const result = upsert.run(seed_key, name, category, serving_unit, serving_size, cal, pro, carbs, fat, fiber, sugar, units, default_unit);
      if (result.changes > 0) inserted.push(name);
    }

    // Fix categories for items that were previously seeded under a different category
    db.prepare(`UPDATE foods SET category = 'beverage' WHERE seed_key = 'diet_coke' AND category != 'beverage'`).run();
    db.prepare(`UPDATE foods SET category = 'beverage' WHERE seed_key = 'masala_chai_with_sugar' AND category != 'beverage'`).run();
    db.prepare(`UPDATE foods SET category = 'beverage' WHERE seed_key = 'filter_coffee_with_sugar' AND category != 'beverage'`).run();
  })();

  if (inserted.length > 0) {
    console.log(`Seed audit: ${inserted.length} new foods inserted: ${inserted.join(', ')}`);
  } else {
    console.log('Seed audit: all seed foods already present.');
  }
}

/**
 * First-run-only seeding: saved meals, goal, milestones.
 * Called only when the foods table was empty before seedFoods ran.
 */
function seedInitialData(db) {
  const today = new Date().toISOString().split('T')[0];

  // ── Standard Breakfast saved meal ─────────────────────────────
  const getFood = db.prepare('SELECT id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g FROM foods WHERE name = ?');

  const breakfastComponents = [
    { name: 'Oats',                      qty: 1 },
    { name: 'Honey',                     qty: 1 },
    { name: 'Chia seeds',                qty: 1 },
    { name: 'Greek yogurt (plain)',      qty: 2 },
    { name: 'Whey protein powder',       qty: 1 },
    { name: 'Almond milk (unsweetened)', qty: 1 },
    { name: 'Blueberries',              qty: 1 },
    { name: 'Boiled eggs',              qty: 2 },
  ];

  let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0, totalFiber = 0, totalSugar = 0;
  const items = [];

  for (const comp of breakfastComponents) {
    const food = getFood.get(comp.name);
    if (food) {
      totalCal   += food.calories  * comp.qty;
      totalPro   += food.protein_g * comp.qty;
      totalCarb  += food.carbs_g   * comp.qty;
      totalFat   += food.fat_g     * comp.qty;
      totalFiber += food.fiber_g   * comp.qty;
      totalSugar += food.sugar_g   * comp.qty;
      items.push({ food_id: food.id, quantity: comp.qty });
    }
  }

  db.prepare(`
    INSERT INTO saved_meals (name, items, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_sugar_g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Standard Breakfast',
    JSON.stringify(items),
    Math.round(totalCal),
    Math.round(totalPro * 10) / 10,
    Math.round(totalCarb * 10) / 10,
    Math.round(totalFat * 10) / 10,
    Math.round(totalFiber * 10) / 10,
    Math.round(totalSugar * 10) / 10,
  );

  // ── Goal ──────────────────────────────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO goal
      (id, start_weight_kg, goal_weight_kg, start_date, height_cm, age, activity_multiplier,
       current_calorie_target, current_protein_target_g, current_fat_target_g, current_carb_target_g,
       current_fiber_target_g, current_sugar_limit_g, water_target_ml,
       last_recalibration_date, weekly_point_threshold)
    VALUES (1, 90, 78, ?, 183, 25, 1.45, 2240, 180, 62, 240, 32, 50, 3000, ?, 350)
  `).run(today, today);

  // ── Milestones ────────────────────────────────────────────────
  const insertMilestone = db.prepare('INSERT OR IGNORE INTO milestones (weight_kg_threshold) VALUES (?)');
  [87, 84, 81, 78].forEach(w => insertMilestone.run(w));

  console.log('Initial data seeded (saved meal, goal, milestones).');
}

module.exports = { seedFoods, seedInitialData, toSeedKey };
