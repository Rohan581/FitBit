// Exercise seeding — runs on every startup, idempotent via UNIQUE name
// The actual exercise data is in exerciseData.js (generated separately)

function seedExercises(db) {
  let EXERCISE_DATA;
  try {
    EXERCISE_DATA = require('./exerciseData').EXERCISE_DATA;
  } catch (e) {
    console.warn('exerciseData.js not found, skipping exercise seeding');
    return;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO exercises (name, primary_muscles, secondary_muscles, form_cues, common_mistakes, substitutes, youtube_search_term)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const update = db.prepare(`
    UPDATE exercises SET primary_muscles = ?, secondary_muscles = ?, form_cues = ?, common_mistakes = ?, substitutes = ?, youtube_search_term = ?
    WHERE name = ? AND (primary_muscles = '[]' OR form_cues = '[]')
  `);

  const tx = db.transaction(() => {
    for (const ex of EXERCISE_DATA) {
      const pm = JSON.stringify(ex.primary_muscles);
      const sm = JSON.stringify(ex.secondary_muscles);
      const fc = JSON.stringify(ex.form_cues);
      const cm = JSON.stringify(ex.common_mistakes);
      const sub = JSON.stringify(ex.substitutes);

      insert.run(ex.name, pm, sm, fc, cm, sub, ex.youtube_search_term);
      // Update if row existed but had empty data
      update.run(pm, sm, fc, cm, sub, ex.youtube_search_term, ex.name);
    }
  });

  tx();
}

module.exports = { seedExercises };
