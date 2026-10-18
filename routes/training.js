const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST, daysAgoIST, getMondayIST, getDaysOfWeek } = require('../dateUtils');
const { getNextWorkoutType, getWorkoutByType, ROTATION, SUCCESSOR_MAP, BANNED_EQUIPMENT, EQUIPMENT_SUBSTITUTIONS } = require('../db/workoutTemplates');
const { EQUIPMENT_CATALOG } = require('../db/equipmentData');

// ─── Constants ───────────────────────────────────────────────
const SESSION_CAP = 5; // hard cap: 5 exercises per session, no exceptions

// Fine-grained muscle → coarse volume-readout group.
// Every primary_muscles value in the exercises table must resolve here.
const MUSCLE_GROUP_MAP = {
  chest: 'chest',
  back: 'back', lats: 'back', upper_back: 'back', traps: 'back',
  front_delts: 'shoulders', side_delts: 'shoulders', rear_delts: 'shoulders', shoulders: 'shoulders',
  triceps: 'triceps',
  biceps: 'biceps',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'quads',            // glute work credited to quads group (compound overlap)
  calves: 'calves',
  abs: 'abs',
  lower_back: 'lower_back',
  forearms: 'biceps',          // hammer curl forearm work → biceps group
  hip_flexors: 'abs',          // hanging leg raise hip flexor work → abs group
};

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
  lats: 'Lat Pulldown', upper_back: 'Seated Cable Row', chest: 'Pec Fly Machine (Pec Deck)',
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
// skip muscles already covered by the upcoming template;
// equipment-aware (only pick servable exercises);
// least-sets-this-week priority, muscle-size as tie-break.
function computeCatchUp(db, weekDays, templateExercises, weekSessionOrdinal, nextWorkoutType, availableEquipment, pendingExerciseIds) {
  if (weekSessionOrdinal < 3) return { substitutions: [], notes: {}, debug: [] };

  const sessionRegion = workoutRegion(nextWorkoutType);

  // Find all completed sessions this week
  const completedSessions = db.prepare(`
    SELECT ws.id, ws.workout_type FROM workout_sessions ws
    WHERE ws.completed = 1 AND ws.date >= ? AND ws.date <= ?
    ORDER BY ws.date ASC
  `).all(weekDays[0], weekDays[6]);

  if (completedSessions.length === 0) return { substitutions: [], notes: {}, debug: [] };

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

  // Find muscles with zero logged sets — use session_exercises for slot-based satisfaction
  const missedMuscles = new Map(); // muscle -> { reason, skipped_exercise, source_session_id, source_session_type }
  for (const session of completedSessions) {
    // Prefer session_exercises for slot-based checking (swap-aware)
    const sessionSlots = db.prepare('SELECT * FROM session_exercises WHERE session_id = ?').all(session.id);

    if (sessionSlots.length > 0) {
      // Slot-based: a slot is satisfied if actual_exercise_id has logged sets
      for (const slot of sessionSlots) {
        if (slot.is_bonus) continue; // Bonus exercises never generate catch-ups

        const loggedSets = db.prepare(
          'SELECT COUNT(*) as cnt FROM workout_sets WHERE session_id = ? AND exercise_id = ?'
        ).get(session.id, slot.actual_exercise_id)?.cnt || 0;
        const hasPending = pendingExerciseIds && pendingExerciseIds.has(slot.actual_exercise_id);

        if (loggedSets === 0 && !hasPending) {
          // Also check if the planned exercise was logged (swap-back edge case)
          const plannedSets = slot.was_swapped ? db.prepare(
            'SELECT COUNT(*) as cnt FROM workout_sets WHERE session_id = ? AND exercise_id = ?'
          ).get(session.id, slot.planned_exercise_id)?.cnt || 0 : 0;
          const hasPendingPlanned = pendingExerciseIds && pendingExerciseIds.has(slot.planned_exercise_id);

          if (plannedSets === 0 && !hasPendingPlanned) {
            const plannedEx = db.prepare('SELECT name, primary_muscles FROM exercises WHERE id = ?').get(slot.planned_exercise_id);
            if (!plannedEx) continue;
            for (const m of JSON.parse(plannedEx.primary_muscles)) {
              if (!missedMuscles.has(m)) {
                missedMuscles.set(m, {
                  reason: `${plannedEx.name} skipped in ${session.workout_type.replace(/_/g, ' ')}`,
                  skipped_exercise: plannedEx.name,
                  source_session_id: session.id,
                  source_session_type: session.workout_type,
                });
              }
            }
          }
        }
      }
    } else {
      // Fallback: template-based checking for legacy sessions without session_exercises
      const templateWorkout = ROTATION.find(w => w.type === session.workout_type);
      if (!templateWorkout) continue;
      for (const templateEx of templateWorkout.exercises) {
        if (templateEx.is_bonus) continue;
        const dbEx = db.prepare('SELECT id, primary_muscles FROM exercises WHERE name = ?').get(templateEx.name);
        if (!dbEx) continue;
        const loggedSets = db.prepare(
          'SELECT COUNT(*) as cnt FROM workout_sets WHERE session_id = ? AND exercise_id = ?'
        ).get(session.id, dbEx.id)?.cnt || 0;
        const hasPending = pendingExerciseIds && pendingExerciseIds.has(dbEx.id);
        if (loggedSets === 0 && !hasPending) {
          for (const m of JSON.parse(dbEx.primary_muscles)) {
            if (!missedMuscles.has(m)) {
              missedMuscles.set(m, {
                reason: `${templateEx.name} skipped in ${session.workout_type.replace(/_/g, ' ')}`,
                skipped_exercise: templateEx.name,
                source_session_id: session.id,
                source_session_type: session.workout_type,
              });
            }
          }
        }
      }
    }
  }

  if (missedMuscles.size === 0) return { substitutions: [], notes: {}, debug: [] };

  // Filter to muscles whose region matches the next session
  const regionMatched = [...missedMuscles.keys()].filter(m => muscleRegion(m) === sessionRegion);
  if (regionMatched.length === 0) return { substitutions: [], notes: {}, debug: [] };

  // Filter out muscles already covered by the upcoming template's primary muscles.
  // If the template already trains hamstrings (via Smith RDL), don't insert a hamstring catch-up.
  const templateMuscles = new Set();
  for (const ex of templateExercises) {
    const muscles = Array.isArray(ex.primary_muscles) ? ex.primary_muscles
      : (typeof ex.primary_muscles === 'string' ? JSON.parse(ex.primary_muscles) : []);
    for (const m of muscles) templateMuscles.add(m);
  }
  const needsCatchUp = regionMatched.filter(m => !templateMuscles.has(m));
  if (needsCatchUp.length === 0) return { substitutions: [], notes: {}, debug: [] };

  // Sort by least sets this week (ascending), then by muscle-size tie-break
  const sizePriority = MUSCLE_PRIORITY.reduce((acc, m, i) => { acc[m] = i; return acc; }, {});
  needsCatchUp.sort((a, b) => {
    const setsA = setsPerMuscle[a] || 0;
    const setsB = setsPerMuscle[b] || 0;
    if (setsA !== setsB) return setsA - setsB; // least sets first
    return (sizePriority[a] ?? 99) - (sizePriority[b] ?? 99); // larger muscle first
  });

  const toSubstitute = needsCatchUp.slice(0, 2);

  // Build substitution exercises
  const substitutions = [];
  const notes = {};
  const debug = [];
  const templateNames = new Set(templateExercises.map(e => e.name));

  for (const muscle of toSubstitute) {
    const exName = CATCH_UP_EXERCISES[muscle];
    if (!exName || templateNames.has(exName)) continue;
    const dbEx = db.prepare('SELECT id, name, primary_muscles, secondary_muscles, rest_seconds, equipment_type, required_equipment, substitutes FROM exercises WHERE name = ?').get(exName);
    if (!dbEx) continue;

    let finalEx = dbEx;
    // Only pick exercises that are servable with current equipment
    if (!isExerciseServable({ required_equipment: JSON.parse(dbEx.required_equipment || '[]') }, availableEquipment)) {
      const sub = findAvailableSubstitute(db, {
        ...dbEx,
        primary_muscles: dbEx.primary_muscles,
        substitutes: dbEx.substitutes,
        required_equipment: JSON.parse(dbEx.required_equipment || '[]'),
      }, availableEquipment, templateNames);
      if (!sub) continue; // No servable alternative, skip this muscle
      finalEx = sub;
    }

    const missed = missedMuscles.get(muscle);
    substitutions.push({
      name: finalEx.name, exercise_id: finalEx.id, sets: 3, reps: '8-12',
      primary_muscles: JSON.parse(finalEx.primary_muscles),
      secondary_muscles: JSON.parse(finalEx.secondary_muscles),
      rest_seconds: finalEx.rest_seconds || 75,
      required_equipment: JSON.parse(finalEx.required_equipment || '[]'),
      equipment_type: finalEx.equipment_type || null,
      is_catchup: true, catchup_reason: missed.reason,
    });
    templateNames.add(finalEx.name);
    notes[muscle] = missed.reason;
    debug.push({
      muscle,
      catch_up_exercise: finalEx.name,
      skipped_exercise: missed.skipped_exercise,
      source_session_id: missed.source_session_id,
      source_session_type: missed.source_session_type,
      session_ordinal: weekSessionOrdinal,
    });
  }

  return { substitutions, notes, debug };
}

// Apply catch-up: insert at slot 1 (ahead of existing exercises), shift down.
// Catch-ups for bonus exercises are never generated (filtered upstream).
// A session may run to 5 core exercises while carrying a catch-up.
function applySubstitutions(exercises, substitutions) {
  if (substitutions.length === 0) return exercises;

  // Separate core and bonus
  const core = exercises.filter(e => !e.is_bonus);
  const bonus = exercises.filter(e => e.is_bonus);

  // Insert catch-ups at the front (slot 1), shift existing core down
  const merged = [...substitutions.map((s, i) => ({
    ...s, slot: i + 1, is_bonus: false, is_catchup: true,
  })), ...core.map((e, i) => ({
    ...e, slot: substitutions.length + i + 1,
  }))];

  // Re-add bonus at the end
  return [...merged, ...bonus.map(b => ({ ...b, slot: merged.length + 1 }))];
}

// ─── Variation refresh mappings ──────────────────────────────
// Machine/cable exercises swap within the same equipment category.
const VARIATION_MAP = {
  'Lat Pulldown': ['Assisted Pull-Up Machine'],
  'Assisted Pull-Up Machine': ['Lat Pulldown'],
  'Cable Tricep Pushdown': ['Overhead Cable Tricep Extension'],
  'Overhead Cable Tricep Extension': ['Cable Tricep Pushdown'],
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
    const dbEx = db.prepare('SELECT id, name, primary_muscles, secondary_muscles, rest_seconds, equipment_type, required_equipment, load_type FROM exercises WHERE name = ?').get(ex.name);
    return {
      ...ex,
      exercise_id: dbEx?.id || null,
      primary_muscles: dbEx ? JSON.parse(dbEx.primary_muscles) : [],
      secondary_muscles: dbEx ? JSON.parse(dbEx.secondary_muscles) : [],
      rest_seconds: dbEx?.rest_seconds || 75,
      required_equipment: dbEx ? JSON.parse(dbEx.required_equipment || '[]') : [],
      equipment_type: dbEx?.equipment_type || null,
      load_type: dbEx?.load_type || 'resistance',
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
        'SELECT set_number, weight_kg, reps, effective_load_kg FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number'
      ).all(lastSession.id, ex.exercise_id);
    }
  }

  // ─── Stalled-load detection ────────────────────────────────
  // For each exercise: check last 3 completed sessions for stalls/regressions.
  // Assistance exercises (counterweight machines): progress = lower displayed weight,
  // so stall/regression directions are inverted.
  const loadSuggestions = {};
  for (const ex of exercises) {
    if (!ex.exercise_id) continue;
    const isAssist = ex.load_type === 'assistance';
    // Get last 3 sessions with this exercise
    const sessions = db.prepare(`
      SELECT DISTINCT ws.id, ws.date FROM workout_sessions ws
      JOIN workout_sets wset ON wset.session_id = ws.id
      WHERE wset.exercise_id = ? AND ws.completed = 1
      ORDER BY ws.date DESC LIMIT 3
    `).all(ex.exercise_id);
    if (sessions.length < 2) continue;

    // Parse rep range from template (e.g., "6-8" → [6, 8])
    const repRange = (ex.reps || '').match(/(\d+)\s*-\s*(\d+)/);
    if (!repRange) continue;
    const [, repLo, repHi] = repRange.map(Number);

    // Get sets from each session
    const sessionData = sessions.map(s => {
      const sets = db.prepare('SELECT weight_kg, reps FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number').all(s.id, ex.exercise_id);
      return { date: s.date, sets };
    });

    // Smallest weight increment observed in this exercise's history
    function smallestDelta() {
      let inc = 2.5;
      if (ex.equipment_type === 'machine' || ex.equipment_type === 'cable') {
        const allWeights = db.prepare(`
          SELECT DISTINCT weight_kg FROM workout_sets WHERE exercise_id = ? AND weight_kg IS NOT NULL ORDER BY weight_kg
        `).all(ex.exercise_id).map(r => r.weight_kg);
        if (allWeights.length >= 2) {
          const deltas = [];
          for (let i = 1; i < allWeights.length; i++) {
            const d = Math.abs(allWeights[i] - allWeights[i - 1]);
            if (d > 0) deltas.push(d);
          }
          if (deltas.length > 0) inc = Math.min(...deltas);
        }
      }
      return inc;
    }

    const latest = sessionData[0];
    const prev = sessionData[1];
    if (latest.sets.length > 0 && prev.sets.length > 0) {
      const latestWeight = latest.sets[0]?.weight_kg;
      const prevWeight = prev.sets[0]?.weight_kg;
      const latestAllAtTop = latestWeight && latest.sets.every(s => s.weight_kg === latestWeight && s.reps >= repHi);
      const prevAllAtTop = prevWeight && prev.sets.every(s => s.weight_kg === prevWeight && s.reps >= repHi);

      if (latestAllAtTop && prevAllAtTop && latestWeight === prevWeight) {
        const inc = smallestDelta();
        if (isAssist) {
          // Assistance: progress = reduce counterweight
          const suggestedWeight = Math.max(0, latestWeight - inc);
          loadSuggestions[ex.exercise_id] = {
            type: 'increase', load_type: 'assistance',
            currentWeight: latestWeight, suggestedWeight,
            message: `You've finished every set at ${latestWeight} kg assist — dropping to ${suggestedWeight} kg today.`,
          };
        } else {
          const suggestedWeight = latestWeight + inc;
          loadSuggestions[ex.exercise_id] = {
            type: 'increase',
            currentWeight: latestWeight, suggestedWeight,
            message: `You've finished every set at ${latestWeight} kg — going to ${suggestedWeight} kg today.`,
          };
        }
        continue;
      }

      // Check for regression: failing bottom of rep range on 2 consecutive sessions
      const latestAllBelow = latestWeight && latest.sets.every(s => s.weight_kg === latestWeight && s.reps < repLo);
      const prevAllBelow = prevWeight && prev.sets.every(s => s.weight_kg === prevWeight && s.reps < repLo);
      if (latestAllBelow && prevAllBelow && latestWeight === prevWeight) {
        const dec = smallestDelta();
        if (isAssist) {
          // Assistance: regression = need more counterweight (higher number)
          const suggestedWeight = latestWeight + dec;
          loadSuggestions[ex.exercise_id] = {
            type: 'decrease', load_type: 'assistance',
            currentWeight: latestWeight, suggestedWeight,
            message: `Struggling at ${latestWeight} kg assist for two sessions — try ${suggestedWeight} kg assist today.`,
          };
        } else {
          const suggestedWeight = Math.max(0, latestWeight - dec);
          loadSuggestions[ex.exercise_id] = {
            type: 'decrease',
            currentWeight: latestWeight, suggestedWeight,
            message: `Struggling at ${latestWeight} kg for two sessions — try ${suggestedWeight} kg today.`,
          };
        }
      }
    }
  }

  // ─── next_weight_kg override (one-time seed) ────────────────
  // If an exercise has next_weight_kg set, use it as the suggested weight
  for (const ex of exercises) {
    if (!ex.exercise_id) continue;
    const override = db.prepare('SELECT next_weight_kg FROM exercises WHERE id = ? AND next_weight_kg IS NOT NULL').get(ex.exercise_id);
    if (override?.next_weight_kg != null && !loadSuggestions[ex.exercise_id]) {
      loadSuggestions[ex.exercise_id] = {
        type: 'increase',
        currentWeight: null,
        suggestedWeight: override.next_weight_kg,
        message: `Pre-filled at ${override.next_weight_kg} kg — you've hit this weight before.`,
      };
    }
  }

  // ─── Stalled lifts (Train home) ───────────────────────────
  // Any exercise at the same working weight for 3+ consecutive sessions
  const stalledLifts = [];
  const allTemplateExercises = ROTATION.flatMap(w => w.exercises);
  const seenExIds = new Set();
  for (const tex of allTemplateExercises) {
    const dbEx = db.prepare('SELECT id, name, load_type FROM exercises WHERE name = ?').get(tex.name);
    if (!dbEx || seenExIds.has(dbEx.id)) continue;
    seenExIds.add(dbEx.id);
    const recentSess = db.prepare(`
      SELECT DISTINCT ws.id, ws.date FROM workout_sessions ws
      JOIN workout_sets wset ON wset.session_id = ws.id
      WHERE wset.exercise_id = ? AND ws.completed = 1
      ORDER BY ws.date DESC LIMIT 5
    `).all(dbEx.id);
    if (recentSess.length < 3) continue;
    // Get working weight (mode of first set weight) for each session
    const weights = recentSess.map(s => {
      const firstSet = db.prepare('SELECT weight_kg FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number LIMIT 1').get(s.id, dbEx.id);
      return firstSet?.weight_kg;
    }).filter(w => w != null);
    if (weights.length < 3) continue;
    // Count consecutive same weight from most recent
    let streak = 1;
    for (let i = 1; i < weights.length; i++) {
      if (weights[i] === weights[0]) streak++;
      else break;
    }
    if (streak >= 3) {
      stalledLifts.push({
        exercise_id: dbEx.id,
        name: dbEx.name,
        weight_kg: weights[0],
        sessions: streak,
        load_type: dbEx.load_type || 'resistance',
      });
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

  // Parse pending exercise IDs from client (unsynced sets in IndexedDB)
  const pendingExerciseIds = req.query.pending_exercises
    ? new Set(req.query.pending_exercises.split(',').map(Number).filter(Boolean))
    : null;

  // Catch-up (equipment-aware, template-coverage-aware, pending-aware)
  const catchUp = computeCatchUp(db, weekDays, exercises, weekSessionOrdinal, nextWorkout.type, availableEquipment, pendingExerciseIds);

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
        'SELECT set_number, weight_kg, reps, effective_load_kg FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number'
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
    next_workout: { ...nextWorkout, exercises: finalExercises, subtitle, bench_swap_options: nextWorkout.bench_swap_options || null },
    last_numbers: lastNumbers,
    load_suggestions: loadSuggestions,
    stalled_lifts: stalledLifts.length > 0 ? stalledLifts : null,
    recent_sessions: recentSessions,
    week_gym_sessions: weekGymSessions,
    week_swim_sessions: weekSwimSessions,
    swim_note: swimNote,
    rotation: ROTATION.map(w => ({ type: w.type, label: w.label, subtitle: w.subtitle })),
    week_strip: weekStrip,
    catch_up: catchUpCount > 0 ? { count: catchUpCount, notes: catchUp.notes, debug: catchUp.debug } : null,
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

  const sessionId = result.lastInsertRowid;

  // Populate session_exercises from template — tracks planned vs actual per slot
  const insertSE = db.prepare(
    'INSERT INTO session_exercises (session_id, slot, planned_exercise_id, actual_exercise_id, was_swapped, is_bonus) VALUES (?, ?, ?, ?, 0, ?)'
  );
  for (const ex of workout.exercises) {
    const dbEx = db.prepare('SELECT id FROM exercises WHERE name = ?').get(ex.name);
    if (dbEx) insertSE.run(sessionId, ex.slot, dbEx.id, dbEx.id, ex.is_bonus ? 1 : 0);
  }

  res.json({ session_id: sessionId, workout_type: workout.type, date: today });
});

// POST /api/training/sessions/:id/swap — record an in-session exercise swap
router.post('/sessions/:id/swap', (req, res) => {
  const db = getDB();
  const sessionId = req.params.id;
  const { slot, actual_exercise_id } = req.body;
  if (slot == null || !actual_exercise_id) return res.status(400).json({ error: 'slot and actual_exercise_id required' });

  const se = db.prepare('SELECT * FROM session_exercises WHERE session_id = ? AND slot = ?').get(sessionId, slot);
  if (!se) return res.status(404).json({ error: 'Slot not found for this session' });

  const wasSwapped = actual_exercise_id !== se.planned_exercise_id ? 1 : 0;
  db.prepare('UPDATE session_exercises SET actual_exercise_id = ?, was_swapped = ? WHERE session_id = ? AND slot = ?')
    .run(actual_exercise_id, wasSwapped, sessionId, slot);

  res.json({ ok: true, was_swapped: !!wasSwapped });
});

// Compute effective load for assistance exercises: bodyweight − assist
function computeEffectiveLoad(db, exerciseId, assistWeight) {
  const exInfo = db.prepare('SELECT load_type FROM exercises WHERE id = ?').get(exerciseId);
  if (exInfo?.load_type !== 'assistance' || assistWeight == null) return null;
  // 7-day rolling average body weight
  const avgBw = db.prepare(`
    SELECT AVG(weight_kg) as avg_bw FROM weight_logs
    WHERE date >= date('now', '-7 days')
  `).get()?.avg_bw;
  if (!avgBw) return null;
  return Math.round((avgBw - assistWeight) * 10) / 10;
}

// POST /api/training/sessions/:id/sets — log a set (idempotent via client_uuid)
router.post('/sessions/:id/sets', (req, res) => {
  const db = getDB();
  const sessionId = req.params.id;
  const { exercise_id, set_number, weight_kg, reps, client_uuid, created_at, slot } = req.body;

  const effectiveLoad = computeEffectiveLoad(db, exercise_id, weight_kg);

  // Primary path: upsert on client_uuid (local-first clients)
  if (client_uuid) {
    const existing = db.prepare('SELECT id FROM workout_sets WHERE client_uuid = ?').get(client_uuid);
    if (existing) {
      db.prepare('UPDATE workout_sets SET weight_kg = ?, reps = ?, set_number = ?, effective_load_kg = ? WHERE id = ?')
        .run(weight_kg, reps, set_number, effectiveLoad, existing.id);
      return res.json({ id: existing.id, updated: true });
    }
    const result = db.prepare(
      'INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, client_uuid, created_at, slot, effective_load_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(sessionId, exercise_id, set_number, weight_kg, reps, client_uuid, created_at || new Date().toISOString(), slot || null, effectiveLoad);
    return res.json({ id: result.lastInsertRowid, updated: false });
  }

  // Fallback: legacy upsert on (session_id, exercise_id, set_number)
  const existing = db.prepare(
    'SELECT id FROM workout_sets WHERE session_id = ? AND exercise_id = ? AND set_number = ?'
  ).get(sessionId, exercise_id, set_number);

  if (existing) {
    db.prepare('UPDATE workout_sets SET weight_kg = ?, reps = ?, effective_load_kg = ? WHERE id = ?')
      .run(weight_kg, reps, effectiveLoad, existing.id);
    res.json({ id: existing.id, updated: true });
  } else {
    const result = db.prepare(
      'INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, created_at, slot, effective_load_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(sessionId, exercise_id, set_number, weight_kg, reps, new Date().toISOString(), slot || null, effectiveLoad);
    res.json({ id: result.lastInsertRowid, updated: false });
  }
});

// POST /api/training/sessions/:id/backfill — add a missed set after session completion
router.post('/sessions/:id/backfill', (req, res) => {
  const db = getDB();
  const sessionId = req.params.id;
  const session = db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { exercise_id, set_number, weight_kg, reps } = req.body;
  const result = db.prepare(
    'INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, created_at, backfilled) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(sessionId, exercise_id, set_number, weight_kg, reps, new Date().toISOString());
  res.json({ id: result.lastInsertRowid, backfilled: true });
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

  // Slot-based completion: use session_exercises (planned vs actual per slot)
  const slots = db.prepare('SELECT * FROM session_exercises WHERE session_id = ?').all(req.params.id);
  const coreSlots = slots.filter(s => !s.is_bonus);
  const corePlanned = coreSlots.length;
  let coreCompleted = 0;
  let swapCount = 0;
  const missedExNames = [];

  for (const slot of coreSlots) {
    // A slot is satisfied when its actual_exercise_id has ≥1 logged set
    const logged = db.prepare('SELECT COUNT(*) as cnt FROM workout_sets WHERE session_id = ? AND exercise_id = ?')
      .get(req.params.id, slot.actual_exercise_id)?.cnt || 0;
    if (logged > 0) {
      coreCompleted++;
    } else {
      // Also check if ANY set was logged for any exercise for this slot (double-swap edge case)
      const anySlotSets = db.prepare('SELECT COUNT(*) as cnt FROM workout_sets WHERE session_id = ? AND slot = ?')
        .get(req.params.id, slot.slot)?.cnt || 0;
      if (anySlotSets > 0) {
        coreCompleted++;
      } else {
        // Truly missed — report the planned exercise name
        const plannedEx = db.prepare('SELECT name FROM exercises WHERE id = ?').get(slot.planned_exercise_id);
        if (plannedEx) missedExNames.push(plannedEx.name);
      }
    }
    if (slot.was_swapped) swapCount++;
  }

  // Fallback: if no session_exercises rows exist (legacy session), use template matching
  if (slots.length === 0) {
    const template = getWorkoutByType(session.workout_type);
    const coreExNames = template.exercises.filter(e => !e.is_bonus).map(e => e.name);
    const planned = coreExNames.length;
    let completed = 0;
    for (const name of coreExNames) {
      const dbEx = db.prepare('SELECT id FROM exercises WHERE name = ?').get(name);
      if (!dbEx) continue;
      const logged = db.prepare('SELECT COUNT(*) as cnt FROM workout_sets WHERE session_id = ? AND exercise_id = ?').get(req.params.id, dbEx.id)?.cnt || 0;
      if (logged > 0) completed++;
      else missedExNames.push(name);
    }
    return finishCompletion(db, session, req.params.id, duration, planned, completed, 0, missedExNames, res);
  }

  finishCompletion(db, session, req.params.id, duration, corePlanned, coreCompleted, swapCount, missedExNames, res);
});

function finishCompletion(db, session, sessionId, duration, corePlanned, coreCompleted, swapCount, missedExNames, res) {
  const completionRatio = corePlanned > 0 ? coreCompleted / corePlanned : 1;

  db.prepare('UPDATE workout_sessions SET completed = 1, duration_min = ?, core_exercises_planned = ?, core_exercises_completed = ?, completion_ratio = ? WHERE id = ?')
    .run(duration, corePlanned, coreCompleted, completionRatio, sessionId);

  // Clear next_weight_kg overrides for exercises that were logged in this session
  const loggedExIds = db.prepare('SELECT DISTINCT exercise_id FROM workout_sets WHERE session_id = ?').all(sessionId);
  for (const { exercise_id } of loggedExIds) {
    db.prepare('UPDATE exercises SET next_weight_kg = NULL WHERE id = ? AND next_weight_kg IS NOT NULL').run(exercise_id);
  }

  // Double-count guard
  const existingGymLog = db.prepare(
    "SELECT id, notes FROM exercise_logs WHERE date = ? AND LOWER(type) = 'gym'"
  ).get(session.date);

  let exercise_log_action = 'created';
  if (existingGymLog) {
    db.prepare('UPDATE exercise_logs SET duration_min = ?, notes = ? WHERE id = ?')
      .run(duration || 60, `Gym session: ${session.workout_type} (session:${sessionId})`, existingGymLog.id);
    exercise_log_action = 'replaced_existing';
  } else {
    db.prepare(
      'INSERT INTO exercise_logs (date, type, duration_min, intensity, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(session.date, 'Gym', duration || 60, 'moderate', `Gym session: ${session.workout_type} (session:${sessionId})`);
  }

  const nextType = SUCCESSOR_MAP[session.workout_type] || 'upper_a';
  res.json({
    ok: true, next_type: nextType, exercise_log_action,
    core_planned: corePlanned, core_completed: coreCompleted,
    swap_count: swapCount,
    missed_exercises: missedExNames,
  });
}

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

  const exInfo = db.prepare('SELECT load_type FROM exercises WHERE id = ?').get(exerciseId);
  const isAssist = exInfo?.load_type === 'assistance';

  const sessions = db.prepare(`
    SELECT ws.date, ws.workout_type, wset.set_number, wset.weight_kg, wset.reps, wset.effective_load_kg
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
    if (isAssist) {
      // For assistance exercises, chart effective load (bodyweight − assist).
      // "Top" = highest effective load = lowest assist weight.
      const withEffective = sets.filter(s => s.effective_load_kg != null);
      if (withEffective.length > 0) {
        const topSet = withEffective.reduce((best, s) => (s.effective_load_kg > best.effective_load_kg ? s : best), withEffective[0]);
        return {
          date, top_weight: topSet.effective_load_kg, assist_weight: topSet.weight_kg,
          top_reps: topSet.reps, e1rm: null, total_sets: sets.length, load_type: 'assistance',
        };
      }
    }
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
      if (isAssist) {
        // For assistance: rising effective load = progress. Dropping assistance = getting stronger.
        if (weightDiff > 0) {
          progression_note = `Effective load is trending up — you're getting stronger.`;
        }
      } else if (latestWeight && fourWeeksAgoWeight) {
        const bodyWeightDrop = fourWeeksAgoWeight.weight_kg - latestWeight.weight_kg;
        if (bodyWeightDrop > 1 && Math.abs(weightDiff) < 2.5) {
          progression_note = `Same weight at ${Math.round(bodyWeightDrop * 10) / 10} kg lighter — that's relative strength going up.`;
        } else if (weightDiff < -5) {
          progression_note = 'Load has dropped noticeably over recent sessions. Consider checking recovery, sleep, and protein intake.';
        }
      }
    }
  }

  res.json({ exercise_id: parseInt(exerciseId), history, progression_note, load_type: isAssist ? 'assistance' : 'resistance' });
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

  // Sets per muscle — map fine-grained muscles to coarse volume groups via MUSCLE_GROUP_MAP
  const setsPerMuscle = {};
  const unmappedExercises = {}; // { exercise_name: set_count }
  function countSetsForSessions(sessions) {
    const result = {};
    for (const session of sessions) {
      const sets = db.prepare(`
        SELECT wset.exercise_id, COUNT(*) as set_count, e.primary_muscles, e.name as exercise_name
        FROM workout_sets wset
        JOIN exercises e ON e.id = wset.exercise_id
        WHERE wset.session_id = ?
        GROUP BY wset.exercise_id
      `).all(session.id);
      for (const s of sets) {
        const muscles = JSON.parse(s.primary_muscles);
        const primary = muscles[0]; // first muscle is primary
        const group = primary ? MUSCLE_GROUP_MAP[primary] : null;
        if (group) {
          result[group] = (result[group] || 0) + s.set_count;
        } else if (primary) {
          console.warn(`[VOLUME] Unmapped muscle "${primary}" for exercise "${s.exercise_name}" (id ${s.exercise_id})`);
          unmappedExercises[s.exercise_name] = (unmappedExercises[s.exercise_name] || 0) + s.set_count;
        }
      }
    }
    return result;
  }
  Object.assign(setsPerMuscle, countSetsForSessions(gymSessions));

  // 4-week average per muscle
  const fourWeeksAgo = new Date(new Date(monday + 'T12:00:00Z').getTime() - 21 * 86400000).toISOString().split('T')[0];
  const priorSessions = db.prepare(`
    SELECT id FROM workout_sessions
    WHERE completed = 1 AND date >= ? AND date < ?
  `).all(fourWeeksAgo, weekDays[0]);
  const priorSetsPerMuscle = countSetsForSessions(priorSessions);
  // Average over 3 prior weeks (the 4th is current)
  const avgPerMuscle = {};
  for (const [m, count] of Object.entries(priorSetsPerMuscle)) {
    avgPerMuscle[m] = Math.round(count / 3 * 10) / 10;
  }

  // Target bands per muscle group
  const TARGET_BANDS = {
    chest: [8, 12], back: [8, 12], shoulders: [5, 8], triceps: [5, 8],
    biceps: [3, 6], quads: [8, 12], hamstrings: [6, 10], calves: [6, 10], abs: [3, 6],
    lower_back: [3, 6],
  };

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

  // Muscle volume readout: per-muscle sets, target bands, 4-week avg
  const muscleVolume = ['chest', 'back', 'shoulders', 'triceps', 'biceps', 'quads', 'hamstrings', 'calves', 'abs', 'lower_back'].map(m => ({
    muscle: m,
    sets: setsPerMuscle[m] || 0,
    avg4w: avgPerMuscle[m] || 0,
    target: TARGET_BANDS[m] || [0, 0],
  }));

  res.json({
    week_start: monday,
    gym_sessions: gymSessions.length,
    swim_sessions: swimSessions.length,
    total_exercise_sessions: allExercise.length,
    sets_per_muscle: setsPerMuscle,
    muscle_volume: muscleVolume,
    unmapped_exercises: Object.keys(unmappedExercises).length > 0 ? unmappedExercises : null,
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

// ─── Startup assertion: muscle mapping coverage ─────────────
// Every exercise in every template must resolve to a volume group.
(function assertMuscleMapping() {
  for (const w of ROTATION) {
    for (const ex of w.exercises) {
      const group = MUSCLE_GROUP_MAP[ex.primary_muscle];
      if (!group) {
        console.error(`[MUSCLE ASSERT] Template exercise "${ex.name}" has primary_muscle "${ex.primary_muscle}" which is not in MUSCLE_GROUP_MAP`);
      }
    }
  }
})();

module.exports = router;
