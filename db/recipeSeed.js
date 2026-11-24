const path = require('path');
const fs = require('fs');

const ICON_MAP = {
  'korean-chicken-popcorn': '🍗',
  'garlic-herb-wedges': '🥔',
  'spiced-panko-chicken': '🍗',
  'bihari-village-chicken': '🍗',
  'iffa-chicken': '🍗',
  'lighter-chicken-sukka': '🍗',
  'kimchi': '🥬',
  'standard-breakfast-oats': '🥣',
  'garlic-yogurt-dip': '🫙',
  'mint-curd-chutney': '🫙',
  'air-fryer-tandoori-tikka': '🍗',
  'garlic-pepper-prawns': '🦐',
  'air-fryer-fish-tikka': '🐟',
  'chicken-keema-matar': '🍗',
  'palak-moong-dal': '🥬',
  'egg-white-veggie-bhurji': '🥚',
  'sprouts-chana-chaat': '🥗',
  'kachumber-salad': '🥗',
  'chicken-tikka-wrap': '🌯',
  'soya-chunk-masala': '🥬',
  'air-fryer-paneer-tikka': '🧀',
  'light-kerala-fish-curry': '🐟',
  'nashville-hot-chicken': '🍗',
  'masala-omelette': '🥚',
  'dhaba-egg-curry': '🥚',
  'shakshuka': '🥚',
  'gyeran-mari': '🥚',
  'mayak-eggs': '🥚',
  'air-fryer-egg-muffins': '🥚',
  'protein-pancakes': '🥞',
  'caramelised-onion-chicken-pasta': '🍝',
  'air-fried-soya-chunks': '🫘',
  'air-fried-paneer-tikka': '🧀',
  'crispy-air-fried-tofu': '🍢',
  'rice-paper-chicken-bites': '🥟',
  'bang-bang-chicken-tenders': '🍗',
};

function seedRecipes(db) {
  const seedPath = path.join(__dirname, '..', 'seed', 'recipes-seed.json');
  if (!fs.existsSync(seedPath)) return;

  const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  if (!data.recipes || !Array.isArray(data.recipes)) return;

  // Upsert rather than INSERT OR IGNORE. Previously a seeded recipe was frozen
  // at whatever shipped first: fixing a macro error or a bad instruction in this
  // file never reached a database that had already seeded it. Now a corrected
  // recipe propagates on the next boot.
  //
  // The DO UPDATE is guarded on user_edited = 0, which routes/recipes.js sets to
  // 1 on any PUT. So a recipe edited in the app is never overwritten — the
  // conflict is swallowed and the row left alone. my_notes, is_favourite and
  // is_hidden are user state and are not in the update list either, so they
  // survive a content refresh.
  const insert = db.prepare(`
    INSERT INTO recipes
      (seed_key, title, source, icon, servings, cooked_yield_g, total_time_min,
       tags, per_serving, ingredients, steps, notes, pairs_with_keys, portion_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(seed_key) DO UPDATE SET
      title            = excluded.title,
      icon             = excluded.icon,
      servings         = excluded.servings,
      cooked_yield_g   = excluded.cooked_yield_g,
      total_time_min   = excluded.total_time_min,
      tags             = excluded.tags,
      per_serving      = excluded.per_serving,
      ingredients      = excluded.ingredients,
      steps            = excluded.steps,
      notes            = excluded.notes,
      pairs_with_keys  = excluded.pairs_with_keys,
      portion_mode     = excluded.portion_mode,
      updated_at       = datetime('now')
    WHERE recipes.user_edited = 0
  `);

  const tx = db.transaction(() => {
    for (const r of data.recipes) {
      insert.run(
        r.seed_key,
        r.title,
        r.source || 'new',
        ICON_MAP[r.seed_key] || '🍽️',
        r.servings || 1,
        r.cooked_yield_g || null,
        r.total_time_min || null,
        JSON.stringify(r.tags || []),
        JSON.stringify(r.per_serving || {}),
        JSON.stringify(r.ingredients || []),
        JSON.stringify(r.steps || []),
        r.notes || null,
        JSON.stringify(r.pairs_with || []),
        r.portion_mode || 'grams'
      );
    }
  });
  tx();

  // Resolve pairs_with seed_keys → recipe ids
  const all = db.prepare('SELECT id, seed_key, pairs_with_keys FROM recipes WHERE seed_key IS NOT NULL').all();
  const keyToId = {};
  for (const row of all) keyToId[row.seed_key] = row.id;

  const updatePairs = db.prepare('UPDATE recipes SET pairs_with = ? WHERE id = ?');
  const txPairs = db.transaction(() => {
    for (const row of all) {
      const keys = JSON.parse(row.pairs_with_keys || '[]');
      const ids = keys.map(k => keyToId[k]).filter(Boolean);
      updatePairs.run(JSON.stringify(ids), row.id);
    }
  });
  txPairs();
}

module.exports = { seedRecipes };
