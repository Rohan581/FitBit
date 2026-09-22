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
};

function seedRecipes(db) {
  const seedPath = path.join(__dirname, '..', 'seed', 'recipes-seed.json');
  if (!fs.existsSync(seedPath)) return;

  const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  if (!data.recipes || !Array.isArray(data.recipes)) return;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO recipes
      (seed_key, title, source, icon, servings, cooked_yield_g, total_time_min,
       tags, per_serving, ingredients, steps, notes, pairs_with_keys)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(r.pairs_with || [])
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
