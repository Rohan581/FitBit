function seedDatabase(db) {
  const today = new Date().toISOString().split('T')[0];

  // ── Foods ──────────────────────────────────────────────────────────────────

  const insertFood = db.prepare(`
    INSERT INTO foods (name, category, serving_unit, serving_size, calories, protein_g, carbs_g, fat_g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedMany = db.transaction((foods) => {
    for (const f of foods) insertFood.run(...f);
  });

  // [name, category, serving_unit, serving_size, cal, pro, carb, fat]
  seedMany([
    // ── Daily rotation staples ─────────────────────────────────────
    ['Steamed rice',                  'staple', '1 cup (150g)',  150, 200, 4,    45,   0.5 ],
    ['Roti (whole wheat, plain)',     'staple', '1 piece',         1,  85, 3,    15,   1.5 ],
    ['Dal (toor/moong, home-style)',  'staple', '1 cup',         240, 180, 10,   27,   4   ],
    ['Chicken curry (home-style)',    'staple', '1 cup',         240, 280, 28,    8,  15   ],
    ['Grilled/tandoori chicken breast','staple','100g',          100, 165, 31,    0,   4   ],
    ['Chicken tikka',                 'staple', '100g',          100, 200, 25,    4,  10   ],
    ['Prawn curry (home-style)',      'staple', '1 cup',         240, 230, 22,    8,  13   ],
    ['Grilled/sauteed prawns (plain)','staple', '100g',          100, 120, 24,    1,   1.5 ],
    ['Prawn masala/fry',              'staple', '100g',          100, 180, 20,    6,   8   ],
    ['Flour tortilla (plain, medium)','staple', '1 piece',         1, 140,  4,   24,   3.5 ],
    ['Chicken burrito/wrap',          'staple', '1 wrap',          1, 450, 30,   45,  15   ],
    ['Chicken tortilla tacos',        'staple', '1 serving',       1, 350, 25,   30,  14   ],
    ['Curd/yogurt (plain)',           'staple', '1 cup',         240, 150,  8,   11,   8   ],
    ['Boiled eggs',                   'staple', '2 large',         2, 155, 13,    1,  11   ],
    ['Plain omelette (2 eggs)',       'staple', '1 serving',       1, 180, 13,    2,  14   ],

    // ── Home-cooked Indian ─────────────────────────────────────────
    ['Rajma curry',            'home-cooked', '1 cup',  240, 220, 12, 30,  6   ],
    ['Chole (chickpea curry)', 'home-cooked', '1 cup',  240, 260, 11, 35,  9   ],
    ['Paneer curry',           'home-cooked', '1 cup',  240, 350, 16, 12, 26   ],
    ['Egg curry (2 eggs)',     'home-cooked', '1 serving', 1, 260, 16,  8, 18   ],
    ['Mixed vegetable sabzi',  'home-cooked', '1 cup',  240, 140,  4, 18,  6   ],
    ['Bhindi masala',          'home-cooked', '1 cup',  240, 160,  3, 14, 10   ],
    ['Palak paneer',           'home-cooked', '1 cup',  240, 300, 14, 10, 22   ],
    ['Sambar',                 'home-cooked', '1 cup',  240, 130,  6, 20,  3   ],
    ['Rasam',                  'home-cooked', '1 cup',  240,  60,  2, 10,  1.5 ],
    ['Aloo sabzi (dry)',       'home-cooked', '1 cup',  240, 200,  3, 30,  8   ],
    ['Khichdi',                'home-cooked', '1 cup',  240, 220,  7, 38,  5   ],
    ['Poha',                   'home-cooked', '1 cup',  240, 250,  5, 42,  7   ],
    ['Upma',                   'home-cooked', '1 cup',  240, 230,  6, 35,  8   ],
    ['Idli',                   'home-cooked', '2 pieces', 2,  78,  2, 16,  0.3 ],
    ['Dosa (plain)',            'home-cooked', '1 piece',  1, 120,  3, 20,  3.5 ],
    ['Masala dosa',            'home-cooked', '1 piece',  1, 250,  5, 35, 10   ],
    ['Paratha (plain)',        'home-cooked', '1 piece',  1, 150,  3, 20,  6   ],
    ['Aloo paratha',           'home-cooked', '1 piece',  1, 220,  5, 30,  9   ],

    // ── Restaurant / street food ───────────────────────────────────
    ['Butter chicken',         'restaurant', '1 cup',    240, 490, 25, 12, 38 ],
    ['Biryani (chicken)',      'restaurant', '1 plate',    1, 550, 22, 65, 22 ],
    ['Biryani (veg)',          'restaurant', '1 plate',    1, 450,  8, 70, 15 ],
    ['Pav bhaji',              'restaurant', '1 plate',    1, 500, 10, 60, 24 ],
    ['Samosa',                 'restaurant', '1 piece',    1, 260,  4, 30, 14 ],
    ['Vada pav',               'restaurant', '1 piece',    1, 290,  6, 40, 12 ],
    ['Pani puri',              'restaurant', '6 pieces',   6, 200,  4, 30,  7 ],
    ['Masala chai (with sugar)','restaurant','1 cup',    240,  90,  2, 12,  3 ],
    ['Filter coffee (with sugar)','restaurant','1 cup',  240,  70,1.5, 10,2.5 ],
    ['Chicken shawarma roll',  'restaurant', '1 roll',     1, 450, 25, 40, 20 ],
    ['Margherita pizza',       'restaurant', '2 slices',   2, 400, 16, 45, 16 ],
    ['Veg fried rice',         'restaurant', '1 plate',    1, 430,  8, 65, 14 ],
    ['Chicken fried rice',     'restaurant', '1 plate',    1, 480, 20, 60, 15 ],
    ['Gulab jamun',            'restaurant', '1 piece',    1, 150,  2, 20,  7 ],
    ['Jalebi',                 'restaurant', '100g',     100, 300,  3, 50, 10 ],
    ['Ice cream (regular scoop)','restaurant','1 scoop',   1, 200,  3, 24, 10 ],

    // ── Snacks / packaged ──────────────────────────────────────────
    ['Banana',                    'snack', '1 medium',   1, 105, 1.3, 27,  0.4],
    ['Almonds',                   'snack', '10 pieces', 10,  70, 2.5,2.5,  6  ],
    ['Peanuts (roasted)',         'snack', '30g',       30, 170, 7,   5,  14  ],
    ['Protein shake (whey, water)','snack','1 scoop',    1, 120, 24,  3,  1.5 ],
    ['Greek yogurt (plain)',      'snack', '1 cup',    240, 130, 20,  9,  0.5 ],
    ['Digestive biscuits',        'snack', '2 pieces',   2, 140, 2,  20,  6   ],
    ['Namkeen mixture',           'snack', '30g',       30, 150, 4,  15,  9   ],
    ['Dark chocolate (70%+)',     'snack', '20g',       20, 110, 1.5, 8,  8   ],
    ['Oats',                      'snack', '40g',       40, 150, 5,  27,  2.5 ],
    ['Honey',                     'snack', '1 tbsp',     1,  64, 0,  17,  0   ],
    ['Chia seeds',                'snack', '1 tbsp',     1,  58, 2,   5,  4   ],
    ['Almond milk (unsweetened)', 'snack', '1 cup',    240,  40, 1,   2,  3   ],
    ['Blueberries',               'snack', '1/2 cup',    1,  42, 0.5,11,  0.2 ],
    ['Whey protein powder',       'snack', '24g',       24,  90, 20,  2,  1   ],
  ]);

  // ── Standard Breakfast saved meal ─────────────────────────────────────────

  const getFood = db.prepare('SELECT id, calories, protein_g, carbs_g, fat_g FROM foods WHERE name = ?');

  const breakfastComponents = [
    { name: 'Oats',                      qty: 1 },
    { name: 'Honey',                     qty: 1 },
    { name: 'Chia seeds',                qty: 1 },
    { name: 'Greek yogurt (plain)',      qty: 1 },
    { name: 'Whey protein powder',       qty: 1 },
    { name: 'Almond milk (unsweetened)', qty: 1 },
    { name: 'Blueberries',              qty: 1 },
    { name: 'Boiled eggs',              qty: 2 }, // 2 × "2 large" = 4 large eggs
  ];

  let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
  const items = [];

  for (const comp of breakfastComponents) {
    const food = getFood.get(comp.name);
    if (food) {
      totalCal  += food.calories  * comp.qty;
      totalPro  += food.protein_g * comp.qty;
      totalCarb += food.carbs_g   * comp.qty;
      totalFat  += food.fat_g     * comp.qty;
      items.push({ food_id: food.id, quantity: comp.qty });
    }
  }

  db.prepare(`
    INSERT INTO saved_meals (name, items, total_calories, total_protein_g, total_carbs_g, total_fat_g)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'Standard Breakfast',
    JSON.stringify(items),
    Math.round(totalCal),
    Math.round(totalPro * 10) / 10,
    Math.round(totalCarb * 10) / 10,
    Math.round(totalFat * 10) / 10,
  );

  // ── Goal ──────────────────────────────────────────────────────────────────

  db.prepare(`
    INSERT OR IGNORE INTO goal
      (id, start_weight_kg, goal_weight_kg, start_date, height_cm, age, activity_multiplier,
       current_calorie_target, current_protein_target_g, current_fat_target_g, current_carb_target_g,
       last_recalibration_date, weekly_point_threshold)
    VALUES (1, 90, 78, ?, 183, 25, 1.45, 2240, 180, 62, 240, ?, 350)
  `).run(today, today);

  // ── Milestones ────────────────────────────────────────────────────────────

  const insertMilestone = db.prepare('INSERT OR IGNORE INTO milestones (weight_kg_threshold) VALUES (?)');
  [87, 84, 81, 78].forEach(w => insertMilestone.run(w));

  console.log('Database seeded successfully.');
}

module.exports = { seedDatabase };
