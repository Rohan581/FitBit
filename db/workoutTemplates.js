// Fixed 4-day Upper/Lower rotation: Upper A → Lower A → Upper B → Lower B
// Deterministic successor map — no stored counter. Derives next workout
// from the last completed session's workout_type.
// 4 core exercises per session (slot 1–4) + 1 bonus.
// Cardio sits outside the slots.

// Upper A ordering rationale:
// - Back takes slot 2-3 (two exercises), triceps slot 4. v33 cut back to 2 exercises
//   which dropped weekly back volume below the 8-12 target band. Restoring Seated
//   Cable Row gives back 9 sets/week (lat pulldown 3 + cable row 3 + pull-up 3).
// - Triceps stay in a core slot: pushdown has progressed 15.9 → 18.1 kg and triceps
//   also get indirect work from bench press and pec deck.
// - Shoulder Press Machine moves to bonus: it was regressing in slot 4 due to fatigue
//   (36 kg → 26% volume drop). Front delts get work from bench; side delts from
//   cable lateral raise in Upper B. Shoulders at 3 core sets/week is a monitored
//   trade-off — if "Sets this week" shows shoulders below band for 3 consecutive
//   weeks, revisit.
const UPPER_A = {
  type: 'upper_a',
  label: 'Upper A',
  subtitle: 'Bench press & pulldown',
  exercises: [
    { name: 'Barbell Bench Press', sets: 4, reps: '6-8', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Lat Pulldown', sets: 3, reps: '8-10', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'back' },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-12', slot: 4, is_bonus: false, primary_muscle: 'triceps' },
    { name: 'Shoulder Press Machine', sets: 3, reps: '8-10', slot: 5, is_bonus: true, primary_muscle: 'shoulders' },
  ],
  // Bench-occupied swap: two options for slot 1 when the station is in use
  bench_swap_options: ['Standing Cable Chest Press', 'Pec Fly Machine (Pec Deck)'],
};

const UPPER_B = {
  type: 'upper_b',
  label: 'Upper B',
  subtitle: 'Pec fly & pull-up',
  exercises: [
    { name: 'Pec Fly Machine (Pec Deck)', sets: 4, reps: '10-12', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Assisted Pull-Up Machine', sets: 3, reps: '6-10', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Overhead Cable Tricep Extension', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'triceps' },
    { name: 'Cable Lateral Raise', sets: 3, reps: '12-15', slot: 4, is_bonus: false, primary_muscle: 'shoulders' },
    { name: 'Cable Curl', sets: 3, reps: '10-12', slot: 5, is_bonus: true, primary_muscle: 'biceps' },
  ],
};

const LOWER_A = {
  type: 'lower_a',
  label: 'Lower A',
  subtitle: 'Squat & leg curl',
  exercises: [
    { name: 'Smith Machine Squat', sets: 4, reps: '6-8', slot: 1, is_bonus: false, primary_muscle: 'quads' },
    { name: 'Leg Press', sets: 3, reps: '10-12', slot: 2, is_bonus: false, primary_muscle: 'quads' },
    { name: 'Lying Leg Curl', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'hamstrings' },
    // Abs in core slot so they don't get dropped when session runs short.
    // Standing calf moves to bonus — seated calf (soleus) in Lower B slot 4 gives weekly calf coverage.
    { name: 'Cable Crunch', sets: 3, reps: '12-15', slot: 4, is_bonus: false, primary_muscle: 'abs' },
    { name: 'Smith Machine Calf Raise', sets: 4, reps: '12-15', slot: 5, is_bonus: true, primary_muscle: 'calves' },
  ],
};

const LOWER_B = {
  type: 'lower_b',
  label: 'Lower B',
  subtitle: 'RDL & extensions',
  exercises: [
    { name: 'Smith Machine Romanian Deadlift', sets: 4, reps: '8-10', slot: 1, is_bonus: false, primary_muscle: 'hamstrings' },
    { name: 'Leg Extension', sets: 3, reps: '12-15', slot: 2, is_bonus: false, primary_muscle: 'quads' },
    { name: 'Back Extension', sets: 3, reps: '12-15', slot: 3, is_bonus: false, primary_muscle: 'lower_back' },
    { name: 'Seated Calf Raise', sets: 4, reps: '12-15', slot: 4, is_bonus: false, primary_muscle: 'calves' },
    { name: 'Lying Leg Raise', sets: 3, reps: '12-15', slot: 5, is_bonus: true, primary_muscle: 'abs' },
  ],
};

const ROTATION = [UPPER_A, LOWER_A, UPPER_B, LOWER_B];

// Deterministic successor map — the only source of truth for rotation order.
const SUCCESSOR_MAP = {
  upper_a: 'lower_a',
  lower_a: 'upper_b',
  upper_b: 'lower_b',
  lower_b: 'upper_a',
};

const TYPE_MAP = {};
for (const w of ROTATION) TYPE_MAP[w.type] = w;

// Derive the next workout from the last completed session's type.
// If no prior session, returns Upper A (the rotation start).
function getNextWorkoutType(lastCompletedType) {
  if (!lastCompletedType) return 'upper_a';
  return SUCCESSOR_MAP[lastCompletedType] || 'upper_a';
}

function getWorkoutByType(type) {
  return TYPE_MAP[type] || UPPER_A;
}

// Equipment never programmed (banned list)
const BANNED_EQUIPMENT = new Set([
  'chest_press_machine', 'incline_chest_press_machine', 'hack_squat',
  'seated_leg_curl', 'standing_calf_raise_machine', 'hip_thrust_machine',
  'glute_kickback_machine', 'chest_supported_row_machine',
]);

// Substitution rules for missing equipment
const EQUIPMENT_SUBSTITUTIONS = {
  'Overhead Cable Tricep Extension': ['Cable Tricep Pushdown', 'Dumbbell Overhead Extension'],
  'Pec Fly Machine (Pec Deck)': ['Cable Chest Fly'],
  'Barbell Bench Press': ['Standing Cable Chest Press', 'Pec Fly Machine (Pec Deck)'],
};

module.exports = {
  UPPER_A, LOWER_A, UPPER_B, LOWER_B,
  ROTATION,
  SUCCESSOR_MAP,
  BANNED_EQUIPMENT,
  EQUIPMENT_SUBSTITUTIONS,
  getNextWorkoutType,
  getWorkoutByType,
};
