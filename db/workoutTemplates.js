// Fixed 4-day Upper/Lower rotation: Upper A → Lower A → Upper B → Lower B
// Deterministic successor map — no stored counter. Derives next workout
// from the last completed session's workout_type.
// 4 core exercises per session. No bonus slot.
// Cardio sits outside the slots.

// ─── Normal Templates ──────────────────────────────────────
const UPPER_A = {
  type: 'upper_a',
  label: 'Upper A',
  subtitle: 'Bench press & pulldown',
  exercises: [
    { name: 'Barbell Bench Press', sets: 4, reps: '6-8', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Lat Pulldown', sets: 3, reps: '8-10', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'back' },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-12', slot: 4, is_bonus: false, primary_muscle: 'triceps' },
  ],
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
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', slot: 4, is_bonus: false, primary_muscle: 'shoulders' },
  ],
};

const LOWER_A = {
  type: 'lower_a',
  label: 'Lower A',
  subtitle: 'Squat & leg curl',
  exercises: [
    { name: 'Smith Machine Squat', sets: 4, reps: '6-8', slot: 1, is_bonus: false, primary_muscle: 'quads' },
    { name: 'Leg Press', sets: 3, reps: '10-12', slot: 2, is_bonus: false, primary_muscle: 'quads' },
    { name: 'Seated Leg Curl', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'hamstrings' },
    { name: 'Cable Crunch', sets: 3, reps: '12-15', slot: 4, is_bonus: false, primary_muscle: 'abs' },
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

// ─── Knee Block Templates (3 upper + 1 lower) ─────────────
// Active while knee_block_active = 1 in goal table.
// Quads get nothing — that's the deliberate cost.
// Weekly upper volume: chest 11, back 9, shoulders 6, triceps 6, biceps 6.

const KB_UPPER_A = {
  type: 'upper_a',
  label: 'Upper A',
  subtitle: 'Heavy bench & pulldown',
  exercises: [
    { name: 'Barbell Bench Press', sets: 4, reps: '6-8', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Lat Pulldown', sets: 3, reps: '8-10', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Shoulder Press Machine', sets: 3, reps: '8-10', slot: 3, is_bonus: false, primary_muscle: 'shoulders' },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-12', slot: 4, is_bonus: false, primary_muscle: 'triceps' },
  ],
  bench_swap_options: ['Standing Cable Chest Press', 'Pec Fly Machine (Pec Deck)'],
};

const KB_UPPER_B = {
  type: 'upper_b',
  label: 'Upper B',
  subtitle: 'Pec fly & cable row',
  exercises: [
    { name: 'Pec Fly Machine (Pec Deck)', sets: 4, reps: '10-12', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', slot: 3, is_bonus: false, primary_muscle: 'shoulders' },
    { name: 'Cable Curl', sets: 3, reps: '10-12', slot: 4, is_bonus: false, primary_muscle: 'biceps' },
  ],
};

const KB_UPPER_C = {
  type: 'upper_c',
  label: 'Upper C',
  subtitle: 'Volume bench & pull-up',
  exercises: [
    { name: 'Barbell Bench Press (Volume)', sets: 3, reps: '8-10', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Assisted Pull-Up Machine', sets: 3, reps: '6-10', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Overhead Cable Tricep Extension', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'triceps' },
    { name: 'Preacher Curl (EZ Bar)', sets: 3, reps: '10-12', slot: 4, is_bonus: false, primary_muscle: 'biceps' },
  ],
};

const KB_LOWER = {
  type: 'lower',
  label: 'Lower',
  subtitle: 'RDL & calves (knee block)',
  exercises: [
    { name: 'Smith Machine Romanian Deadlift', sets: 4, reps: '8-10', slot: 1, is_bonus: false, primary_muscle: 'hamstrings' },
    { name: 'Seated Calf Raise', sets: 4, reps: '12-15', slot: 2, is_bonus: false, primary_muscle: 'calves' },
    { name: 'Back Extension', sets: 3, reps: '12-15', slot: 3, is_bonus: false, primary_muscle: 'lower_back' },
    { name: 'Cable Crunch', sets: 3, reps: '10-12', slot: 4, is_bonus: false, primary_muscle: 'abs' },
  ],
};

const KB_ROTATION = [KB_UPPER_A, KB_UPPER_B, KB_UPPER_C, KB_LOWER];

// Rotation: A → B → Lower → C (bench days A and C separated by B and Lower)
const KB_SUCCESSOR_MAP = {
  upper_a: 'upper_b',
  upper_b: 'lower',
  lower: 'upper_c',
  upper_c: 'upper_a',
};

const KB_TYPE_MAP = {};
for (const w of KB_ROTATION) KB_TYPE_MAP[w.type] = w;

// Exercises excluded during knee block, with reasons
const KB_EXCLUDED_EXERCISES = {
  'Leg Extension': 'Loads the patellar tendon directly at full knee extension',
  'Seated Leg Curl': 'User reports anterior knee pain during this movement',
  'Leg Press': 'Deep knee flexion under load aggravates the knee',
  'Smith Machine Squat': 'Squatting pattern causes anterior knee pain below kneecap',
};

// Derive the next workout from the last completed session's type.
// If no prior session, returns upper_a (the rotation start for both modes).
function getNextWorkoutType(lastCompletedType, kneeBlockActive) {
  if (!lastCompletedType) return 'upper_a';
  const map = kneeBlockActive ? KB_SUCCESSOR_MAP : SUCCESSOR_MAP;
  const next = map[lastCompletedType];
  // If transitioning between modes (e.g., last was lower_a in knee block), restart
  if (!next) return 'upper_a';
  return next;
}

function getWorkoutByType(type, kneeBlockActive) {
  if (kneeBlockActive) return KB_TYPE_MAP[type] || KB_UPPER_A;
  return TYPE_MAP[type] || UPPER_A;
}

// Equipment never programmed (banned list)
const BANNED_EQUIPMENT = new Set([
  'chest_press_machine', 'incline_chest_press_machine', 'hack_squat',
  'lying_leg_curl',
  'hip_thrust_machine', 'glute_kickback_machine', 'chest_supported_row_machine',
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
  KB_UPPER_A, KB_UPPER_B, KB_UPPER_C, KB_LOWER,
  KB_ROTATION,
  KB_SUCCESSOR_MAP,
  KB_TYPE_MAP,
  KB_EXCLUDED_EXERCISES,
  BANNED_EQUIPMENT,
  EQUIPMENT_SUBSTITUTIONS,
  getNextWorkoutType,
  getWorkoutByType,
};
