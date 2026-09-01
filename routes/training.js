const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST, daysAgoIST, getMondayIST, getDaysOfWeek } = require('../dateUtils');
const { getNextWorkoutType, getWorkoutByType, ROTATION, SUCCESSOR_MAP } = require('../db/workoutTemplates');
const { EQUIPMENT_CATALOG } = require('../db/equipmentData');

// ─── Constants ───────────────────────────────────────────────
const SESSION_CAP = 5; // hard cap: 5 exercises per session, no exceptions

const COMPOUND_SET = new Set([
  'Barbell Back Squat', 'Smith Machine Squat', 'Barbell Bench Press', 'Conventional Deadlift',
  'Romanian Deadlift', 'Standing Overhead Press', 'Barbell Row',
  'Leg Press', 'Bulgarian Split Squat', 'Incline Dumbbell Press',
  'Pull-Up', 'Hip Thrust', 'Dips', 'Shoulder Press Machine',
  'Assisted Pull-Up Machine', 'Smith Machine Bench Press',
  'Smith Machine Romanian Deadlift', 'T-Bar Row', 'Single-Leg Leg Press',
]);

// Muscle group priority for catch-up (largest first)
const MUSCLE_PRIORITY = ['quads', 'hamstrings', 'glutes', 'lats', 'upper_back', 'chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'abs', 'calves', 'lower_back', 'traps'];

// Exercise to use when catching up a muscle group — machine/cable preferred
const CATCH_UP_EXERCISES = {
  quads: 'Leg Press', hamstrings: 'Lying Leg Curl', glutes: 'Back Extension',
  lats: 'Lat Pulldown', upper_back: 'Seated Cable Row', chest: 'Pec Deck',
  front_delts: 'Shoulder Press Machine', side_delts: 'Cable Lateral Raise', rear_delts: 'Face Pull',
  biceps: 'Cable Bicep Curl', triceps: 'Cable Tricep Pushdown', abs: 'Cable Crunch',
  calves: 'Seated Calf Raise', lower_back: 'Back Extension', traps: 'Face Pull',
};

// ─── Slot counting ─────────────────────────────────────────
// One exercise = one slot. No pairing.
function countSlots(exercises) {
  return exercises.length;
}

// Hard-truncate to SESSION_CAP — last step in the pipeline.
function enforceSlotCap(exercises) {
  if (exercises.length <= SESSION_CAP) return exercises;
  console.warn(`[SLOT CAP] Session generated with ${exercises.length} exercises (cap: ${SESSION_CAP}). Truncating. Exercises: ${exercises.map(e => e.name).join(', ')}`);
  return exercises.slice(0, SESSION_CAP);
}

// ─── Equipment availability ─────────────────────────────────
// Seed all equipment as available if table is empty (first run).
function ensureEquipmentSeeded(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM gym_equipment').get().c;
  if (count === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO gym_equipment (equipment_key, available) VALUES (?, 1)');
    for (const eq of EQUIPMENT_CATALOG) {
      insert.run(eq.key);
    }
  }
}

// Get set of available equipment keys.
function getAvailableEquipment(db) {
  ensureEquipmentSeeded(db);
  const rows = db.prepare('SELECT equipment_key FROM gym_equipment WHERE available = 1').all();
  return new Set(rows.map(r => r.equipment_key));
}

// Check if an exercise is servable given available equipment.
function isExerciseServable(exercise, availableEquipment) {
  const required = exercise.required_equipment;
  if (!required || required.length === 0) return true;
  const reqArr = typeof required === 'string' ? JSON.parse(required) : required;
  if (reqArr.length === 0) return true;
  return reqArr.every(key => availableEquipment.has(key));
}

// Find the best available substitute for an unavailable exercise.
// Priority: substitutes chain → same primary muscle group fallback.
function findAvailableSubstitute(db, exercise, availableEquipment, usedNames) {
  // 1. Try the exercise's own substitutes list
  const subs = exercise.substitutes || [];
  const subArr = typeof subs === 'string' ? JSON.parse(subs) : subs;
  for (const subName of subArr) {
    if (usedNames.has(subName)) continue;
    const subEx = db.prepare('SELECT id, name, primary_muscles, secondary_muscles, rest_seconds, equipment_type, required_equipment, substitutes FROM exercises WHERE name = ?').get(subName);
    if (subEx && isExerciseServable(subEx, availableEquipment)) {
      return subEx;
    }
  }

  // 2. Fallback: any exercise for the same primary muscle group, preferring machine/cable
  const primaryMuscles = typeof exercise.primary_muscles === 'string' ? JSON.parse(exercise.primary_muscles) : exercise.primary_muscles;
  if (primaryMuscles && primaryMuscles.length > 0) {
    const eqRank = { machine: 0, cable: 1, bodyweight: 2, dumbbell: 3, barbell: 4 };
    const allExercises = db.prepare('SELECT id, name, primary_muscles, secondary_muscles, rest_seconds, equipment_type, required_equipment, substitutes FROM exercises').all();
    const candidates = [];
    for (const candidate of allExercises) {
      if (usedNames.has(candidate.name)) continue;
      if (candidate.name === exercise.name) continue;
      const candMuscles = JSON.parse(candidate.primary_muscles);
      const overlap = primaryMuscles.some(m => candMuscles.includes(m));
      if (overlap && isExerciseServable(candidate, availableEquipment)) {
        candidates.push(candidate);
      }
    }
    // Sort machine/cable first
    candidates.sort((a, b) => (eqRank[a.equipment_type] ?? 2) - (eqRank[b.equipment_type] ?? 2));
    if (candidates.length > 0) return candidates[0];
  }

  return null; // No substitute available
}

// Apply equipment filtering to a list of template exercises.
// Returns { exercises, equipmentNotes }.
function applyEquipmentFilter(db, exercises, availableEquipment) {
  const usedNames = new Set(exercises.map(e => e.name));
  const result = [];
  const notes = [];

  for (const ex of exercises) {
    if (isExerciseServable(ex, availableEquipment)) {
      result.push(ex);
      continue;
    }

    // Special handling: squat slot is always preserved if any squat variant is available
    const isSquatSlot = ['Barbell Back Squat', 'Smith Machine Squat', 'Front Squat'].includes(ex.name);
    if (isSquatSlot) {
      // Try Smith Machine Squat first (user default), then other squat variants
      const squatVariants = ['Smith Machine Squat', 'Barbell Back Squat', 'Front Squat', 'Leg Press', 'Bulgarian Split Squat'];
      let found = false;
      for (const variant of squatVariants) {
        if (variant === ex.name) continue;
        if (usedNames.has(variant)) continue;
        const varEx = db.prepare('SELECT id, name, primary_muscles, secondary_muscles, rest_seconds, equipment_type, required_equipment, substitutes FROM exercises WHERE name = ?').get(variant);
        if (varEx && isExerciseServable(varEx, availableEquipment)) {
          result.push({
            ...ex,
            name: varEx.name,
            exercise_id: varEx.id,
            primary_muscles: JSON.parse(varEx.primary_muscles),
            secondary_muscles: JSON.parse(varEx.secondary_muscles),
            rest_seconds: varEx.rest_seconds || ex.rest_seconds,
          });
          usedNames.add(varEx.name);
          found = true;
          break;
        }
      }
      if (!found) {
        notes.push(`No available equipment for a squat movement today`);
      }
      continue;
    }

    // Find substitute
    const sub = findAvailableSubstitute(db, ex, availableEquipment, usedNames);
    if (sub) {
      result.push({
        ...ex,
        name: sub.name,
        exercise_id: sub.id,
        primary_muscles: JSON.parse(sub.primary_muscles),
        secondary_muscles: JSON.parse(sub.secondary_muscles),
        rest_seconds: sub.rest_seconds || ex.rest_seconds,
      });
      usedNames.add(sub.name);
    } else {
      // Drop the slot with a note
      const primaryMuscles = typeof ex.primary_muscles === 'string' ? JSON.parse(ex.primary_muscles) : ex.primary_muscles;
      const muscleLabel = primaryMuscles?.[0]?.replace(/_/g, ' ') || 'this muscle group';
      notes.push(`No available equipment for a ${muscleLabel} movement today`);
    }
  }

  return { exercises: result, equipmentNotes: notes };
}


// Estimate session duration in minutes
function estimateDuration(exercises) {
  const SET_TIME = 40;
  const TRANSITION = 60;
  let totalSecs = 0;
  for (const ex of exercises) {
    const sets = ex.sets || 3;
    const rest = ex.rest_seconds || (COMPOUND_SET.has(ex.name) ? 150 : 75);
    totalSecs += sets * (SET_TIME + rest) + TRANSITION;
  }
  return Math.round(totalSecs / 60);
}

// ─── Region mapping ─────────────────────────────────────────
const LOWER_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'calves']);
const UPPER_MUSCLES = new Set(['chest', 'lats', 'upper_back', 'traps', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps']);
// abs can go in either, but prefer lower
function muscleRegion(muscle) {
  if (LOWER_MUSCLES.has(muscle)) return 'lower';
  if (UPPER_MUSCLES.has(muscle)) return 'upper';
  return 'lower'; // abs, lower_back → lower
}
function workoutRegion(workoutType) {
  return workoutType.includes('lower') ? 'lower' : 'upper';
}

// ─── Catch-up logic ─────────────────────────────────────────
// Rules: only from skipped exercises in completed sessions this week;
// only in sessions 3-4; substitutes within 5-slot cap (max 2);
// region-matched (lower catch-ups into lower workouts only);
// least-sets-this-week priority, muscle-size as tie-break.
function computeCatchUp(db, weekDays, templateExercises, weekSessionOrdinal, nextWorkoutType) {
  if (weekSessionOrdinal < 3) return { substitutions: [], notes: {} };

  const sessionRegion = workoutRegion(nextWorkoutType);

  // Find all completed sessions this week
  const completedSessions = db.prepare(`
    SELECT ws.id, ws.workout_type FROM workout_sessions ws
    WHERE ws.completed = 1 AND ws.date >= ? AND ws.date <= ?
    ORDER BY ws.date ASC
  `).all(weekDays[0], weekDays[6]);

  if (completedSessions.length === 0) return { substitutions: [], notes: {} };

  // Tally total sets per muscle this week (for least-hit ordering)
  const setsPerMuscle = {};
  for (const session of completedSessions) {
    const sets = db.prepare(`
      SELECT e.primary_muscles, COUNT(*) as cnt
      FROM workout_sets wset JOIN exercises e ON e.id = wset.exercise_id
      WHERE wset.session_id = ? GROUP BY wset.exercise_id
    `).all(session.id);
    for (const row of sets) {
      for (const m of JSON.parse(row.primary_muscles)) {
        setsPerMuscle[m] = (setsPerMuscle[m] || 0) + row.cnt;
      }
    }
  }

  // Find muscles with zero logged sets from exercises in completed session templates
  const missedMuscles = new Map(); // muscle -> reason
  for (const session of completedSessions) {
    const templateWorkout = ROTATION.find(w => w.type === session.workout_type);
    if (!templateWorkout) continue;

    for (const templateEx of templateWorkout.exercises) {
      const dbEx = db.prepare('SELECT id, primary_muscles FROM exercises WHERE name = ?').get(templateEx.name);
      if (!dbEx) continue;
      const loggedSets = db.prepare(
        'SELECT COUNT(*) as cnt FROM workout_sets WHERE session_id = ? AND exercise_id = ?'
      ).get(session.id, dbEx.id)?.cnt || 0;

      if (loggedSets === 0) {
        for (const m of JSON.parse(dbEx.primary_muscles)) {
          if (!missedMuscles.has(m)) {
            missedMuscles.set(m, `${templateEx.name} skipped in ${session.workout_type.replace(/_/g, ' ')}`);
          }
        }
      }
    }
  }

  if (missedMuscles.size === 0) return { substitutions: [], notes: {} };

  // Filter to muscles whose region matches the next session
  const regionMatched = [...missedMuscles.keys()].filter(m => muscleRegion(m) === sessionRegion);
  if (regionMatched.length === 0) return { substitutions: [], notes: {} };

  // Sort by least sets this week (ascending), then by muscle-size tie-break
  const sizePriority = MUSCLE_PRIORITY.reduce((acc, m, i) => { acc[m] = i; return acc; }, {});
  regionMatched.sort((a, b) => {
    const setsA = setsPerMuscle[a] || 0;
    const setsB = setsPerMuscle[b] || 0;
    if (setsA !== setsB) return setsA - setsB; // least sets first
    return (sizePriority[a] ?? 99) - (sizePriority[b] ?? 99); // larger muscle first
  });

  const toSubstitute = regionMatched.slice(0, 2);

  // Build substitution exercises
  const substitutions = [];
  const notes = {};
  const templateNames = new Set(templateExercises.map(e => e.name));

  for (const muscle of toSubstitute) {
    const exName = CATCH_UP_EXERCISES[muscle];
    if (!exName || templateNames.has(exName)) continue;
    const dbEx = db.prepare('SELECT id, name, primary_muscles, secondary_muscles, rest_seconds FROM exercises WHERE name = ?').get(exName);
    if (dbEx) {
      substitutions.push({
        name: dbEx.name, exercise_id: dbEx.id, sets: 3, reps: '8-12',
        primary_muscles: JSON.parse(dbEx.primary_muscles),
        secondary_muscles: JSON.parse(dbEx.secondary_muscles),
        rest_seconds: dbEx.rest_seconds || 75,
        is_catchup: true, catchup_reason: missedMuscles.get(muscle),
      });
      notes[muscle] = missedMuscles.get(muscle);
    }
  }

  return { substitutions, notes };
}

// Apply catch-up substitutions to a template's exercises (substitute, never add)
function applySubstitutions(exercises, substitutions) {
  if (substitutions.length === 0) return exercises;

  const result = [...exercises];
  // Find lowest-priority slots to replace (non-compound accessories from the end)
  const replaceable = [];
  for (let i = result.length - 1; i >= 0; i--) {
    if (!COMPOUND_SET.has(result[i].name)) {
      replaceable.push(i);
    }
  }

  for (let s = 0; s < substitutions.length && s < replaceable.length; s++) {
    result[replaceable[s]] = substitutions[s];
  }

  return result;
}

// ─── Variation refresh mappings ──────────────────────────────
// Machine/cable exercises swap within the same equipment category.
const VARIATION_MAP = {
  'Smith Machine Bench Press': ['Incline Dumbbell Press', 'Pec Deck'],
  'Incline Dumbbell Press': ['Smith Machine Bench Press', 'Pec Deck'],
  'Lat Pulldown': ['Assisted Pull-Up Machine'],
  'Assisted Pull-Up Machine': ['Lat Pulldown'],
  'Seated Cable Row': ['T-Bar Row'],
  'T-Bar Row': ['Seated Cable Row'],
  'Shoulder Press Machine': ['Cable Lateral Raise'],
  'Cable Lateral Raise': ['Shoulder Press Machine'],
  'Smith Machine Romanian Deadlift': ['Back Extension'],
  'Back Extension': ['Smith Machine Romanian Deadlift'],
};

// ─── Deterministic rotation lookup ──────────────────────────
// Query the most recent completed session to derive the next workout.
function resolveNextWorkout(db) {
  const lastCompleted = db.prepare(`
    SELECT workout_type, date, logged_at FROM workout_sessions
    WHERE completed = 1 ORDER BY logged_at DESC LIMIT 1
  `).get();
  const lastType = lastCompleted?.workout_type || null;
  const nextType = getNextWorkoutType(lastType);
  return {
    workout: getWorkoutByType(nextType),
    lastCompleted: lastCompleted || null,
  };
}

// GET /api/training — current state
router.get('/', (req, res) => {
  const db = getDB();
  const goal = db.prepare('SELECT template_start_date, refresh_snoozed_until, gym_equipment_set FROM goal WHERE id = 1').get();
  const { workout: nextWorkout, lastCompleted } = resolveNextWorkout(db);

  // Get available equipment
  const availableEquipment = getAvailableEquipment(db);

  // Resolve exercise IDs for the template
  const exercises = nextWorkout.exercises.map(ex => {
    const dbEx = db.prepare('SELECT id, name, primary_muscles, secondary_muscles, rest_seconds, equipment_type, required_equipment FROM exercises WHERE name = ?').get(ex.name);
    return {
      ...ex,
      exercise_id: dbEx?.id || null,
      primary_muscles: dbEx ? JSON.parse(dbEx.primary_muscles) : [],
      secondary_muscles: dbEx ? JSON.parse(dbEx.secondary_muscles) : [],
      rest_seconds: dbEx?.rest_seconds || 75,
      required_equipment: dbEx ? JSON.parse(dbEx.required_equipment || '[]') : [],
      equipment_type: dbEx?.equipment_type || null,
    };
  });

  // Last session numbers for each exercise
  const lastNumbers = {};
  for (const ex of exercises) {
    if (!ex.exercise_id) continue;
    const lastSession = db.prepare(`
      SELECT ws.id FROM workout_sessions ws
      JOIN workout_sets wset ON wset.session_id = ws.id
      WHERE wset.exercise_id = ? AND ws.completed = 1
      ORDER BY ws.date DESC LIMIT 1
    `).get(ex.exercise_id);
    if (lastSession) {
      lastNumbers[ex.exercise_id] = db.prepare(
        'SELECT set_number, weight_kg, reps FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number'
      ).all(lastSession.id, ex.exercise_id);
    }
  }

  // Recent completed sessions
  const recentSessions = db.prepare(`
    SELECT id, date, workout_type, duration_min, logged_at
    FROM workout_sessions WHERE completed = 1
    ORDER BY date DESC LIMIT 10
  `).all();

  // This week's stats
  const today = todayIST();
  const monday = getMondayIST(today);
  const weekDays = getDaysOfWeek(monday);
  const weekGymSessions = db.prepare(`
    SELECT COUNT(*) as cnt FROM workout_sessions
    WHERE completed = 1 AND date >= ? AND date <= ?
  `).get(weekDays[0], weekDays[6])?.cnt || 0;

  const weekSwimSessions = db.prepare(`
    SELECT COUNT(*) as cnt FROM exercise_logs
    WHERE LOWER(type) = 'swimming' AND date >= ? AND date <= ?
  `).get(weekDays[0], weekDays[6])?.cnt || 0;

  // Session ordinal = completed this week + 1 (the next session)
  const weekSessionOrdinal = weekGymSessions + 1;

  // Catch-up (new logic)
  const catchUp = computeCatchUp(db, weekDays, exercises, weekSessionOrdinal, nextWorkout.type);

  // Apply substitutions to template (within the 5-slot cap)
  let finalExercises = applySubstitutions(exercises, catchUp.substitutions);

  // Equipment filtering: replace unavailable exercises with available substitutes
  const equipmentResult = applyEquipmentFilter(db, finalExercises, availableEquipment);
  finalExercises = equipmentResult.exercises;
  const equipmentNotes = equipmentResult.equipmentNotes;

  // Dev assertion: log if generation produced >5 slots before truncation
  const preTruncSlots = countSlots(finalExercises);
  if (preTruncSlots > SESSION_CAP) {
    console.warn(`[SLOT CAP VIOLATION] ${nextWorkout.type} produced ${preTruncSlots} slots before enforceSlotCap. Exercises: ${finalExercises.map(e => e.name).join(', ')}`);
  }
  // Hard-truncate — no code path bypasses this
  finalExercises = enforceSlotCap(finalExercises);

  // Fetch last numbers for any substituted exercises (catch-up + equipment swaps)
  for (const ex of finalExercises) {
    if (!ex.exercise_id || lastNumbers[ex.exercise_id]) continue;
    const lastSession = db.prepare(`
      SELECT ws.id FROM workout_sessions ws
      JOIN workout_sets wset ON wset.session_id = ws.id
      WHERE wset.exercise_id = ? AND ws.completed = 1
      ORDER BY ws.date DESC LIMIT 1
    `).get(ex.exercise_id);
    if (lastSession) {
      lastNumbers[ex.exercise_id] = db.prepare(
        'SELECT set_number, weight_kg, reps FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number'
      ).all(lastSession.id, ex.exercise_id);
    }
  }

  // Build subtitle
  const catchUpCount = catchUp.substitutions.length;
  const estMin = estimateDuration(finalExercises);
  const subtitle = catchUpCount > 0
    ? `${nextWorkout.subtitle} · ${catchUpCount} catch-up · ~${estMin} min`
    : `${nextWorkout.subtitle} · ~${estMin} min`;

  const weekStrip = weekDays.map(day => {
    const gymOnDay = db.prepare('SELECT id, workout_type FROM workout_sessions WHERE completed = 1 AND date = ?').get(day);
    const swimOnDay = db.prepare("SELECT id FROM exercise_logs WHERE LOWER(type) = 'swimming' AND date = ?").get(day);
    const d = new Date(day + 'T12:00:00Z');
    const dayLabel = ['M','T','W','T','F','S','S'][d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
    return { date: day, label: dayLabel, gym: !!gymOnDay, swim: !!swimOnDay, workout_type: gymOnDay?.workout_type || null };
  });

  // Check if there's a heavy lower-body session yesterday
  const yesterday = daysAgoIST(1);
  const yesterdayLower = db.prepare(`
    SELECT id, workout_type FROM workout_sessions
    WHERE completed = 1 AND date = ? AND workout_type LIKE '%lower%'
  `).get(yesterday);

  const todaySwim = db.prepare(`
    SELECT id FROM exercise_logs WHERE LOWER(type) = 'swimming' AND date = ?
  `).get(today);

  let swimNote = null;
  if (yesterdayLower && todaySwim) {
    swimNote = 'You had a heavy leg session yesterday — consider keeping today\'s swim easy on the legs, or adjust intensity.';
  }

  // Active (incomplete) session
  const activeSession = db.prepare(`
    SELECT id, date, workout_type, logged_at FROM workout_sessions
    WHERE completed = 0 ORDER BY logged_at DESC LIMIT 1
  `).get();

  let activeSessionInfo = null;
  if (activeSession) {
    const setsCompleted = db.prepare(
      'SELECT COUNT(*) as cnt FROM workout_sets WHERE session_id = ?'
    ).get(activeSession.id)?.cnt || 0;
    const startedAtMs = new Date(activeSession.logged_at + 'Z').getTime();
    const elapsedHours = (Date.now() - startedAtMs) / (1000 * 60 * 60);
    activeSessionInfo = {
      session_id: activeSession.id,
      date: activeSession.date,
      workout_type: activeSession.workout_type,
      started_at: activeSession.logged_at,
      sets_completed: setsCompleted,
      elapsed_hours: Math.round(elapsedHours * 10) / 10,
      stale: elapsedHours >= 12,
    };
  }

  // Variation refresh check
  let variation_refresh = null;
  const templateStart = goal?.template_start_date;
  const snoozedUntil = goal?.refresh_snoozed_until;
  if (templateStart) {
    const startDate = new Date(templateStart + 'T12:00:00Z');
    const nowDate = new Date(today + 'T12:00:00Z');
    const weeksOnTemplate = Math.floor((nowDate - startDate) / (7 * 24 * 60 * 60 * 1000));
    const snoozed = snoozedUntil && today < snoozedUntil;
    if (weeksOnTemplate >= 7 && !snoozed) {
      variation_refresh = { weeks_on_template: weeksOnTemplate, prompt: true };
    }
  }

  // Weekly cap: 4 completed gym sessions per Mon–Sun week
  const WEEKLY_GYM_CAP = 4;
  const weekComplete = weekGymSessions >= WEEKLY_GYM_CAP;

  // Compute next Monday for the "resumes from Monday" label
  let nextMonday = null;
  if (weekComplete) {
    const m = new Date(monday + 'T12:00:00Z');
    m.setUTCDate(m.getUTCDate() + 7);
    nextMonday = m.toISOString().split('T')[0];
  }

  res.json({
    last_completed: lastCompleted ? { type: lastCompleted.workout_type, date: lastCompleted.date } : null,
    next_workout: { ...nextWorkout, exercises: finalExercises, subtitle },
    last_numbers: lastNumbers,
    recent_sessions: recentSessions,
    week_gym_sessions: weekGymSessions,
    week_swim_sessions: weekSwimSessions,
    swim_note: swimNote,
    rotation: ROTATION.map(w => ({ type: w.type, label: w.label, subtitle: w.subtitle })),
    week_strip: weekStrip,
    catch_up: catchUpCount > 0 ? { count: catchUpCount, notes: catchUp.notes } : null,
    volume_notes: catchUp.notes,
    active_session: activeSessionInfo,
    variation_refresh,
    duration_estimate: estMin,
    equipment_notes: equipmentNotes,
    gym_equipment_set: !!goal?.gym_equipment_set,
    week_complete: weekComplete,
    next_monday: nextMonday,
  });
});

// POST /api/training/refresh — accept variation refresh
router.post('/refresh', (req, res) => {
  const db = getDB();
  const today = todayIST();

  const allExercises = db.prepare('SELECT id, name FROM exercises').all();
  const nameToId = {};
  for (const ex of allExercises) nameToId[ex.name] = ex.id;

  const swapped = [];
  for (const [original, variations] of Object.entries(VARIATION_MAP)) {
    if (!nameToId[original]) continue;
    const target = variations.find(v => nameToId[v]);
    if (target) swapped.push({ from: original, to: target });
  }

  db.prepare('UPDATE goal SET template_start_date = ?, refresh_snoozed_until = NULL WHERE id = 1').run(today);
  res.json({ ok: true, swapped });
});

// POST /api/training/refresh/snooze
router.post('/refresh/snooze', (req, res) => {
  const db = getDB();
  const snoozeUntil = new Date(Date.now() + 330 * 60000 + 21 * 86400000).toISOString().split('T')[0];
  db.prepare('UPDATE goal SET refresh_snoozed_until = ? WHERE id = 1').run(snoozeUntil);
  res.json({ ok: true, snoozed_until: snoozeUntil });
});

// POST /api/training/sessions — start a workout session
router.post('/sessions', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const { workout } = resolveNextWorkout(db);

  const result = db.prepare(`
    INSERT INTO workout_sessions (date, workout_type, completed) VALUES (?, ?, 0)
  `).run(today, workout.type);

  res.json({ session_id: result.lastInsertRowid, workout_type: workout.type, date: today });
});

// POST /api/training/sessions/:id/sets — log a set
router.post('/sessions/:id/sets', (req, res) => {
  const db = getDB();
  const sessionId = req.params.id;
  const { exercise_id, set_number, weight_kg, reps } = req.body;

  const existing = db.prepare(
    'SELECT id FROM workout_sets WHERE session_id = ? AND exercise_id = ? AND set_number = ?'
  ).get(sessionId, exercise_id, set_number);

  if (existing) {
    db.prepare('UPDATE workout_sets SET weight_kg = ?, reps = ? WHERE id = ?')
      .run(weight_kg, reps, existing.id);
    res.json({ id: existing.id, updated: true });
  } else {
    const result = db.prepare(
      'INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps) VALUES (?, ?, ?, ?, ?)'
    ).run(sessionId, exercise_id, set_number, weight_kg, reps);
    res.json({ id: result.lastInsertRowid, updated: false });
  }
});

// DELETE /api/training/sessions/:id/sets/:setId
router.delete('/sessions/:id/sets/:setId', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM workout_sets WHERE id = ? AND session_id = ?').run(req.params.setId, req.params.id);
  res.json({ ok: true });
});

// GET /api/training/sessions/:id
router.get('/sessions/:id', (req, res) => {
  const db = getDB();
  const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const sets = db.prepare('SELECT * FROM workout_sets WHERE session_id = ? ORDER BY exercise_id, set_number').all(req.params.id);
  res.json({ ...session, sets });
});

// POST /api/training/sessions/:id/complete — mark completed, advance queue
router.post('/sessions/:id/complete', (req, res) => {
  const db = getDB();
  const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const duration = req.body.duration_min || null;
  db.prepare('UPDATE workout_sessions SET completed = 1, duration_min = ? WHERE id = ?').run(duration, req.params.id);

  // Rotation is deterministic — no counter to advance.
  // The next workout is derived from this session's workout_type via SUCCESSOR_MAP.

  // Double-count guard
  const existingGymLog = db.prepare(
    "SELECT id, notes FROM exercise_logs WHERE date = ? AND LOWER(type) = 'gym'"
  ).get(session.date);

  let exercise_log_action = 'created';
  if (existingGymLog) {
    db.prepare('UPDATE exercise_logs SET duration_min = ?, notes = ? WHERE id = ?')
      .run(duration || 60, `Gym session: ${session.workout_type} (session:${req.params.id})`, existingGymLog.id);
    exercise_log_action = 'replaced_existing';
  } else {
    db.prepare(
      'INSERT INTO exercise_logs (date, type, duration_min, intensity, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(session.date, 'Gym', duration || 60, 'moderate', `Gym session: ${session.workout_type} (session:${req.params.id})`);
  }

  const nextType = SUCCESSOR_MAP[session.workout_type] || 'upper_a';
  res.json({ ok: true, next_type: nextType, exercise_log_action });
});

// GET /api/training/exercises — full exercise library
router.get('/exercises', (req, res) => {
  const db = getDB();
  const exercises = db.prepare('SELECT * FROM exercises ORDER BY name').all();
  res.json(exercises.map(ex => ({
    ...ex,
    primary_muscles: JSON.parse(ex.primary_muscles),
    secondary_muscles: JSON.parse(ex.secondary_muscles),
    form_cues: JSON.parse(ex.form_cues),
    common_mistakes: JSON.parse(ex.common_mistakes),
    substitutes: JSON.parse(ex.substitutes),
    required_equipment: JSON.parse(ex.required_equipment || '[]'),
  })));
});

// GET /api/training/exercises/:id
router.get('/exercises/:id', (req, res) => {
  const db = getDB();
  const ex = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Exercise not found' });
  res.json({
    ...ex,
    primary_muscles: JSON.parse(ex.primary_muscles),
    secondary_muscles: JSON.parse(ex.secondary_muscles),
    form_cues: JSON.parse(ex.form_cues),
    common_mistakes: JSON.parse(ex.common_mistakes),
    substitutes: JSON.parse(ex.substitutes),
    required_equipment: JSON.parse(ex.required_equipment || '[]'),
  });
});

// GET /api/training/exercises/:id/history
router.get('/exercises/:id/history', (req, res) => {
  const db = getDB();
  const exerciseId = req.params.id;

  const sessions = db.prepare(`
    SELECT ws.date, ws.workout_type, wset.set_number, wset.weight_kg, wset.reps
    FROM workout_sets wset
    JOIN workout_sessions ws ON ws.id = wset.session_id
    WHERE wset.exercise_id = ? AND ws.completed = 1
    ORDER BY ws.date ASC, wset.set_number ASC
  `).all(exerciseId);

  const byDate = {};
  for (const s of sessions) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }

  const history = Object.entries(byDate).map(([date, sets]) => {
    const topSet = sets.reduce((best, s) => (s.weight_kg > best.weight_kg ? s : best), sets[0]);
    const e1rm = topSet.weight_kg && topSet.reps
      ? Math.round(topSet.weight_kg * (1 + topSet.reps / 30) * 10) / 10
      : null;
    return { date, top_weight: topSet.weight_kg, top_reps: topSet.reps, e1rm, total_sets: sets.length };
  });

  const latestWeight = db.prepare('SELECT weight_kg FROM weight_logs ORDER BY date DESC LIMIT 1').get();
  const fourWeeksAgoWeight = db.prepare('SELECT weight_kg FROM weight_logs WHERE date <= ? ORDER BY date DESC LIMIT 1')
    .get(daysAgoIST(28));

  let progression_note = null;
  if (history.length >= 4) {
    const recent4 = history.slice(-4);
    const topWeights = recent4.map(h => h.top_weight).filter(Boolean);
    if (topWeights.length >= 3) {
      const avgRecent = topWeights.reduce((s, w) => s + w, 0) / topWeights.length;
      const firstWeight = topWeights[0];
      const weightDiff = avgRecent - firstWeight;
      if (latestWeight && fourWeeksAgoWeight) {
        const bodyWeightDrop = fourWeeksAgoWeight.weight_kg - latestWeight.weight_kg;
        if (bodyWeightDrop > 1 && Math.abs(weightDiff) < 2.5) {
          progression_note = `Same weight at ${Math.round(bodyWeightDrop * 10) / 10} kg lighter — that's relative strength going up.`;
        } else if (weightDiff < -5) {
          progression_note = 'Load has dropped noticeably over recent sessions. Consider checking recovery, sleep, and protein intake.';
        }
      }
    }
  }

  res.json({ exercise_id: parseInt(exerciseId), history, progression_note });
});

// GET /api/training/volume — weekly volume summary
router.get('/volume', (req, res) => {
  const db = getDB();
  const today = todayIST();
  const monday = getMondayIST(today);
  const weekDays = getDaysOfWeek(monday);

  const gymSessions = db.prepare(`
    SELECT ws.id, ws.date, ws.workout_type, ws.duration_min
    FROM workout_sessions ws
    WHERE ws.completed = 1 AND ws.date >= ? AND ws.date <= ?
    ORDER BY ws.date
  `).all(weekDays[0], weekDays[6]);

  const setsPerMuscle = {};
  for (const session of gymSessions) {
    const sets = db.prepare(`
      SELECT wset.exercise_id, COUNT(*) as set_count, e.primary_muscles
      FROM workout_sets wset
      JOIN exercises e ON e.id = wset.exercise_id
      WHERE wset.session_id = ?
      GROUP BY wset.exercise_id
    `).all(session.id);
    for (const s of sets) {
      const muscles = JSON.parse(s.primary_muscles);
      for (const m of muscles) {
        setsPerMuscle[m] = (setsPerMuscle[m] || 0) + s.set_count;
      }
    }
  }

  const swimSessions = db.prepare(`
    SELECT date, duration_min FROM exercise_logs
    WHERE LOWER(type) = 'swimming' AND date >= ? AND date <= ?
  `).all(weekDays[0], weekDays[6]);

  const allExercise = db.prepare(`
    SELECT date, type, duration_min FROM exercise_logs WHERE date >= ? AND date <= ?
  `).all(weekDays[0], weekDays[6]);

  const conditioning = db.prepare(`
    SELECT date, type, duration_min FROM exercise_logs
    WHERE date >= ? AND date <= ? AND LOWER(type) != 'gym'
    ORDER BY date DESC
  `).all(weekDays[0], weekDays[6]);

  const sessionCardio = db.prepare(`
    SELECT wc.type, wc.duration_min, ws.date
    FROM workout_cardio wc
    JOIN workout_sessions ws ON ws.id = wc.session_id
    WHERE ws.completed = 1 AND ws.date >= ? AND ws.date <= ?
    ORDER BY ws.date DESC
  `).all(weekDays[0], weekDays[6]);

  const allConditioning = [
    ...conditioning,
    ...sessionCardio.map(c => ({ date: c.date, type: c.type, duration_min: c.duration_min, in_session: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  res.json({
    week_start: monday,
    gym_sessions: gymSessions.length,
    swim_sessions: swimSessions.length,
    total_exercise_sessions: allExercise.length,
    sets_per_muscle: setsPerMuscle,
    gym_details: gymSessions,
    swim_details: swimSessions,
    conditioning: allConditioning,
  });
});

// GET /api/training/check-duplicate
router.get('/check-duplicate', (req, res) => {
  const db = getDB();
  const type = (req.query.type || '').toLowerCase();
  const date = req.query.date || todayIST();
  const existing = db.prepare(
    'SELECT id, type, duration_min, notes FROM exercise_logs WHERE date = ? AND LOWER(type) = ?'
  ).get(date, type);
  res.json({ exists: !!existing, existing: existing || null });
});

// POST /api/training/sessions/:id/cardio
router.post('/sessions/:id/cardio', (req, res) => {
  const db = getDB();
  const { type, duration_min } = req.body;
  if (!type || !duration_min) return res.status(400).json({ error: 'type and duration_min are required' });
  const result = db.prepare(
    'INSERT INTO workout_cardio (session_id, type, duration_min) VALUES (?, ?, ?)'
  ).run(req.params.id, type, duration_min);
  res.json({ id: result.lastInsertRowid });
});

// DELETE /api/training/sessions/:id/cardio/:cardioId
router.delete('/sessions/:id/cardio/:cardioId', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM workout_cardio WHERE id = ? AND session_id = ?').run(req.params.cardioId, req.params.id);
  res.json({ ok: true });
});

// GET /api/training/sessions/:id/cardio
router.get('/sessions/:id/cardio', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM workout_cardio WHERE session_id = ? ORDER BY id').all(req.params.id);
  res.json(rows);
});

// DELETE /api/training/sessions/:id — cancel/discard
router.delete('/sessions/:id', (req, res) => {
  const db = getDB();
  const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  db.prepare('DELETE FROM workout_sets WHERE session_id = ?').run(req.params.id);
  db.prepare('DELETE FROM workout_cardio WHERE session_id = ?').run(req.params.id);
  db.prepare('DELETE FROM workout_sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true, discarded: true });
});

// ─── Equipment API ──────────────────────────────────────────

// GET /api/training/equipment — get all equipment with availability
router.get('/equipment', (req, res) => {
  const db = getDB();
  ensureEquipmentSeeded(db);
  const rows = db.prepare('SELECT equipment_key, available FROM gym_equipment ORDER BY equipment_key').all();
  const byKey = {};
  for (const r of rows) byKey[r.equipment_key] = !!r.available;
  res.json({
    catalog: EQUIPMENT_CATALOG,
    availability: byKey,
  });
});

// PUT /api/training/equipment — update equipment availability
router.put('/equipment', (req, res) => {
  const db = getDB();
  ensureEquipmentSeeded(db);
  const { availability } = req.body; // { equipment_key: boolean }
  if (!availability || typeof availability !== 'object') {
    return res.status(400).json({ error: 'availability object required' });
  }

  const update = db.prepare('UPDATE gym_equipment SET available = ? WHERE equipment_key = ?');
  const insert = db.prepare('INSERT OR IGNORE INTO gym_equipment (equipment_key, available) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const [key, available] of Object.entries(availability)) {
      insert.run(key, available ? 1 : 0);
      update.run(available ? 1 : 0, key);
    }
  });
  tx();

  // Mark equipment as set (first-run flag)
  db.prepare('UPDATE goal SET gym_equipment_set = 1 WHERE id = 1').run();

  res.json({ ok: true });
});

// GET /api/training/rotation — deterministic queue state (for Settings debug)
router.get('/rotation', (req, res) => {
  const db = getDB();
  const { workout, lastCompleted } = resolveNextWorkout(db);

  // Build the upcoming queue starting from the resolved next workout
  const queue = [];
  let type = workout.type;
  for (let i = 0; i < ROTATION.length; i++) {
    const w = getWorkoutByType(type);
    queue.push({ type: w.type, label: w.label, subtitle: w.subtitle });
    type = SUCCESSOR_MAP[type] || 'upper_a';
  }

  res.json({
    last_completed: lastCompleted ? {
      type: lastCompleted.workout_type,
      date: lastCompleted.date,
      logged_at: lastCompleted.logged_at,
    } : null,
    next_type: workout.type,
    queue,
  });
});

module.exports = router;
