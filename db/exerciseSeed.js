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

  // Ensure equipment columns exist before seeding
  const exCols = db.prepare("PRAGMA table_info(exercises)").all().map(c => c.name);
  if (!exCols.includes('equipment_type')) {
    db.exec(`ALTER TABLE exercises ADD COLUMN equipment_type TEXT`);
  }
  if (!exCols.includes('required_equipment')) {
    db.exec(`ALTER TABLE exercises ADD COLUMN required_equipment TEXT NOT NULL DEFAULT '[]'`);
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO exercises (name, primary_muscles, secondary_muscles, form_cues, common_mistakes, substitutes, youtube_search_term, equipment_type, required_equipment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const update = db.prepare(`
    UPDATE exercises SET primary_muscles = ?, secondary_muscles = ?, form_cues = ?, common_mistakes = ?, substitutes = ?, youtube_search_term = ?, equipment_type = ?, required_equipment = ?
    WHERE name = ?
  `);

  const tx = db.transaction(() => {
    for (const ex of EXERCISE_DATA) {
      const pm = JSON.stringify(ex.primary_muscles);
      const sm = JSON.stringify(ex.secondary_muscles);
      const fc = JSON.stringify(ex.form_cues);
      const cm = JSON.stringify(ex.common_mistakes);
      const sub = JSON.stringify(ex.substitutes);
      const eqType = ex.equipment_type || null;
      const reqEq = JSON.stringify(ex.required_equipment || []);

      insert.run(ex.name, pm, sm, fc, cm, sub, ex.youtube_search_term, eqType, reqEq);
      // Always update to keep data in sync with seed
      update.run(pm, sm, fc, cm, sub, ex.youtube_search_term, eqType, reqEq, ex.name);
    }
  });

  tx();
}

module.exports = { seedExercises };
