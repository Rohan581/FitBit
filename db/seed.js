function seedDatabase(db) {
  const today = new Date().toISOString().split('T')[0];

  // ── Foods ──────────────────────────────────────────────────────────────────

  const insertFood = db.prepare(`
    INSERT INTO foods (name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, units)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedMany = db.transaction((foods) => {
    for (const f of foods) insertFood.run(...f);
  });

  // [name, category, serving_unit, serving_size, cal, pro, carb, fat, fiber, sugar, units_json]
  seedMany([
    // ── Daily rotation staples ─────────────────────────────────────
    ['Steamed rice',                  'staple', '1 cup (150g)',  150, 200, 4,    45,   0.5,  0.6,  0,   JSON.stringify([{unit:'1 cup (150g)',multiplier:1},{unit:'100g',multiplier:0.667},{unit:'1/2 cup',multiplier:0.5}])],
    ['Roti (whole wheat, plain)',     'staple', '1 piece',         1,  85, 3,    15,   1.5,  2.5,  0.5, JSON.stringify([{unit:'1 piece',multiplier:1},{unit:'grams',multiplier:0.025}])],
    ['Dal (toor/moong, home-style)',  'staple', '1 cup',         240, 180, 10,   27,   4,    7,    2,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}])],
    ['Chicken curry (home-style)',    'staple', '1 cup',         240, 280, 28,    8,  15,    1,    2,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}])],
    ['Grilled/tandoori chicken breast','staple','100g',          100, 165, 31,    0,   4,    0,    0,   JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5},{unit:'200g',multiplier:2}])],
    ['Chicken tikka',                 'staple', '100g',          100, 200, 25,    4,  10,    0,    1,   JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5}])],
    ['Prawn curry (home-style)',      'staple', '1 cup',         240, 230, 22,    8,  13,    1,    2,   null],
    ['Grilled/sauteed prawns (plain)','staple', '100g',          100, 120, 24,    1,   1.5,  0,    0,   JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5}])],
    ['Prawn masala/fry',              'staple', '100g',          100, 180, 20,    6,   8,    0.5,  1,   null],
    ['Flour tortilla (plain, medium)','staple', '1 piece',         1, 140,  4,   24,   3.5,  1.5,  1,   JSON.stringify([{unit:'1 piece',multiplier:1}])],
    ['Chicken burrito/wrap',          'staple', '1 wrap',          1, 450, 30,   45,  15,    3,    3,   null],
    ['Chicken tortilla tacos',        'staple', '1 serving',       1, 350, 25,   30,  14,    2.5,  2,   null],
    ['Curd/yogurt (plain)',           'staple', '1 cup',         240, 150,  8,   11,   8,    0,    8,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}])],
    ['Boiled eggs',                   'staple', '1 large',         1,  78, 6.5,  0.5,  5.5,  0,    0.5, JSON.stringify([{unit:'1 large',multiplier:1},{unit:'2 large',multiplier:2}])],
    ['Plain omelette (2 eggs)',       'staple', '1 serving',       1, 180, 13,    2,  14,    0,    0.5, null],

    // ── Home-cooked Indian ─────────────────────────────────────────
    ['Rajma curry',            'home-cooked', '1 cup',  240, 220, 12, 30,  6,   11,   3,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}])],
    ['Chole (chickpea curry)', 'home-cooked', '1 cup',  240, 260, 11, 35,  9,   12,   5,   JSON.stringify([{unit:'1 cup',multiplier:1},{unit:'1/2 cup',multiplier:0.5}])],
    ['Paneer curry',           'home-cooked', '1 cup',  240, 350, 16, 12, 26,    1,   3,   null],
    ['Egg curry (2 eggs)',     'home-cooked', '1 serving', 1, 260, 16,  8, 18,    1,   2,   null],
    ['Mixed vegetable sabzi',  'home-cooked', '1 cup',  240, 140,  4, 18,  6,    4,   4,   null],
    ['Bhindi masala',          'home-cooked', '1 cup',  240, 160,  3, 14, 10,    3.5, 3,   null],
    ['Palak paneer',           'home-cooked', '1 cup',  240, 300, 14, 10, 22,    3,   2,   null],
    ['Sambar',                 'home-cooked', '1 cup',  240, 130,  6, 20,  3,    5,   3,   null],
    ['Rasam',                  'home-cooked', '1 cup',  240,  60,  2, 10,  1.5,  1,   2,   null],
    ['Aloo sabzi (dry)',       'home-cooked', '1 cup',  240, 200,  3, 30,  8,    3,   2,   null],
    ['Khichdi',                'home-cooked', '1 cup',  240, 220,  7, 38,  5,    4,   1,   null],
    ['Poha',                   'home-cooked', '1 cup',  240, 250,  5, 42,  7,    2,   2,   null],
    ['Upma',                   'home-cooked', '1 cup',  240, 230,  6, 35,  8,    2,   1,   null],
    ['Idli',                   'home-cooked', '2 pieces', 2,  78,  2, 16,  0.3,  1,   0.5, JSON.stringify([{unit:'2 pieces',multiplier:1},{unit:'1 piece',multiplier:0.5}])],
    ['Dosa (plain)',            'home-cooked', '1 piece',  1, 120,  3, 20,  3.5,  1,   0.5, null],
    ['Masala dosa',            'home-cooked', '1 piece',  1, 250,  5, 35, 10,    2,   1,   null],
    ['Paratha (plain)',        'home-cooked', '1 piece',  1, 150,  3, 20,  6,    1.5, 0.5, null],
    ['Aloo paratha',           'home-cooked', '1 piece',  1, 220,  5, 30,  9,    2,   1,   null],

    // ── Restaurant / street food ───────────────────────────────────
    ['Butter chicken',         'restaurant', '1 cup',    240, 490, 25, 12, 38,   1,   4,   null],
    ['Biryani (chicken)',      'restaurant', '1 plate',    1, 550, 22, 65, 22,   2,   3,   null],
    ['Biryani (veg)',          'restaurant', '1 plate',    1, 450,  8, 70, 15,   3,   3,   null],
    ['Pav bhaji',              'restaurant', '1 plate',    1, 500, 10, 60, 24,   4,   5,   null],
    ['Samosa',                 'restaurant', '1 piece',    1, 260,  4, 30, 14,   2,   2,   null],
    ['Vada pav',               'restaurant', '1 piece',    1, 290,  6, 40, 12,   2,   3,   null],
    ['Pani puri',              'restaurant', '6 pieces',   6, 200,  4, 30,  7,   1.5, 3,   null],
    ['Masala chai (with sugar)','restaurant','1 cup',    240,  90,  2, 12,  3,   0,   10,  null],
    ['Filter coffee (with sugar)','restaurant','1 cup',  240,  70,1.5, 10,2.5,   0,   8,   null],
    ['Chicken shawarma roll',  'restaurant', '1 roll',     1, 450, 25, 40, 20,   2,   3,   null],
    ['Margherita pizza',       'restaurant', '2 slices',   2, 400, 16, 45, 16,   1.5, 3,   null],
    ['Veg fried rice',         'restaurant', '1 plate',    1, 430,  8, 65, 14,   2,   2,   null],
    ['Chicken fried rice',     'restaurant', '1 plate',    1, 480, 20, 60, 15,   1.5, 2,   null],
    ['Gulab jamun',            'restaurant', '1 piece',    1, 150,  2, 20,  7,   0.3, 18,  null],
    ['Jalebi',                 'restaurant', '100g',     100, 300,  3, 50, 10,   0,   30,  null],
    ['Ice cream (regular scoop)','restaurant','1 scoop',   1, 200,  3, 24, 10,   0.5, 16,  null],

    // ── Snacks / packaged ──────────────────────────────────────────
    ['Banana',                    'snack', '1 medium',   1, 105, 1.3, 27,  0.4, 3.1, 14,  null],
    ['Almonds',                   'snack', '10 pieces', 10,  70, 2.5,2.5,  6,   1.5, 0.5, JSON.stringify([{unit:'10 pieces',multiplier:1},{unit:'20 pieces',multiplier:2},{unit:'30g',multiplier:1.8}])],
    ['Peanuts (roasted)',         'snack', '30g',       30, 170, 7,   5,  14,   2.5, 1,   null],
    ['Protein shake (whey, water)','snack','1 scoop',    1, 120, 24,  3,  1.5,  0,   1,   null],
    ['Greek yogurt (plain)',      'snack', '1 tbsp',    15,  17, 2.5, 1.1, 0.1, 0,   1.1, JSON.stringify([{unit:'1 tbsp',multiplier:1},{unit:'2 tbsp',multiplier:2},{unit:'1/2 cup',multiplier:8},{unit:'1 cup',multiplier:16}])],
    ['Digestive biscuits',        'snack', '2 pieces',   2, 140, 2,  20,  6,   0.5, 5,   null],
    ['Namkeen mixture',           'snack', '30g',       30, 150, 4,  15,  9,   1,   1.5, null],
    ['Dark chocolate (70%+)',     'snack', '20g',       20, 110, 1.5, 8,  8,   2,   5,   null],
    ['Oats',                      'snack', '40g',       40, 150, 5,  27,  2.5, 4,   1,   JSON.stringify([{unit:'40g',multiplier:1},{unit:'1/2 cup',multiplier:1},{unit:'1 cup',multiplier:2}])],
    ['Honey',                     'snack', '1 tbsp',     1,  64, 0,  17,  0,   0,   17,  null],
    ['Chia seeds',                'snack', '1 tbsp',     1,  58, 2,   5,  4,   5,   0,   JSON.stringify([{unit:'1 tbsp',multiplier:1},{unit:'2 tbsp',multiplier:2}])],
    ['Almond milk (unsweetened)', 'snack', '1 cup',    240,  40, 1,   2,  3,   0.5, 0,   null],
    ['Blueberries',               'snack', '1/2 cup',    1,  42, 0.5,11,  0.2, 1.8, 7,   JSON.stringify([{unit:'1/2 cup',multiplier:1},{unit:'1 cup',multiplier:2}])],
    ['Whey protein powder',       'snack', '24g',       24,  90, 20,  2,  1,   0,   1,   null],

    // ── Fruits ─────────────────────────────────────────────────────
    ['Apple',                     'snack', '1 medium',   1,  95, 0.5, 25,  0.3, 4.4, 19,  null],
    ['Orange',                    'snack', '1 medium',   1,  62, 1.2, 15,  0.2, 3.1, 12,  null],
    ['Grapes',                    'snack', '1 cup',      1,  62, 0.6, 16,  0.3, 0.8, 15,  null],
    ['Guava',                     'snack', '1 fruit',    1,  68, 2.6, 14,  1,   9,   9,   null],

    // ── Additional proteins ────────────────────────────────────────
    ['Chicken thigh (cooked, skinless)', 'staple', '100g', 100, 209, 26, 0, 11, 0, 0, JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5}])],
    ['Prawns (cooked, plain)',    'staple', '100g',     100, 120, 24,  1,  1.5, 0,   0,   JSON.stringify([{unit:'100g',multiplier:1},{unit:'150g',multiplier:1.5}])],
    ['Eggs (boiled)',             'staple', '1 large',    1,  78, 6.5, 0.5, 5.5, 0,   0.5, JSON.stringify([{unit:'1 large',multiplier:1},{unit:'2 large',multiplier:2}])],

    // ── Staples & vegetables ───────────────────────────────────────
    ['Potato (boiled)',           'staple', '1 medium',   1, 130, 3,  30,  0.1, 3,   1.5, null],
    ['Cucumber',                  'snack',  '1 cup sliced', 1, 16, 0.7, 4,  0.1, 0.5, 1.7, null],
    ['Tomato',                    'snack',  '1 medium',   1,  22, 1.1, 4.8, 0.2, 1.5, 3.2, null],
    ['Onion (raw)',               'staple', '1 medium',   1,  44, 1.2, 10,  0.1, 1.9, 4.7, null],

    // ── Drinks ─────────────────────────────────────────────────────
    ['Diet coke',                 'snack',  '1 can (300 ml)', 1, 1, 0,  0,   0,   0,   0,   null],

    // ── Indulgent / restaurant ─────────────────────────────────────
    ['Sandwich (chicken, standard)', 'restaurant', '1 sandwich', 1, 350, 22, 38, 12, 3, 5, null],
    ['Pasta (red/white sauce)',      'restaurant', '1 plate',    1, 480, 14, 65, 17, 4, 8, null],
    ['Pizza (2 slices, regular)',    'restaurant', '2 slices',   2, 400, 16, 45, 16, 3, 6, null],
    ['Burger (chicken)',             'restaurant', '1 burger',   1, 450, 22, 42, 21, 2.5, 8, null],
    ['Chicken biryani',             'restaurant', '1 plate',    1, 550, 22, 65, 22, 2, 3, null],
    ['Fried chicken',               'restaurant', '2 pieces',   2, 490, 32, 18, 32, 1, 0.5, null],
  ]);

  // ── Standard Breakfast saved meal ─────────────────────────────────────────

  const getFood = db.prepare('SELECT id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g FROM foods WHERE name = ?');

  const breakfastComponents = [
    { name: 'Oats',                      qty: 1 },
    { name: 'Honey',                     qty: 1 },
    { name: 'Chia seeds',                qty: 1 },
    { name: 'Greek yogurt (plain)',      qty: 2 },  // 2 tbsp
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

  // ── Goal ──────────────────────────────────────────────────────────────────

  db.prepare(`
    INSERT OR IGNORE INTO goal
      (id, start_weight_kg, goal_weight_kg, start_date, height_cm, age, activity_multiplier,
       current_calorie_target, current_protein_target_g, current_fat_target_g, current_carb_target_g,
       current_fiber_target_g, current_sugar_limit_g, water_target_ml,
       last_recalibration_date, weekly_point_threshold)
    VALUES (1, 90, 78, ?, 183, 25, 1.45, 2240, 180, 62, 240, 32, 50, 3000, ?, 350)
  `).run(today, today);

  // ── Milestones ────────────────────────────────────────────────────────────

  const insertMilestone = db.prepare('INSERT OR IGNORE INTO milestones (weight_kg_threshold) VALUES (?)');
  [87, 84, 81, 78].forEach(w => insertMilestone.run(w));

  console.log('Database seeded successfully.');
}

module.exports = { seedDatabase };
