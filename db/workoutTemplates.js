// Fixed 4-day rotation: Upper A → Lower → Upper B → Upper C
// Deterministic successor map — no stored counter. Derives next workout
// from the last completed session's workout_type.
// 4 CORE exercises per session + 1 BONUS slot.
//
// Slot design (v49, evidence-led review Nov 2026):
//  - Core slots 1-4 carry all work on the named weak points (chest, back, arms).
//  - The bonus slot holds only work that costs little if skipped: abs, rear
//    delts, extra calves, extra quads. Never a weak-point exercise. The user
//    has a measured history of not completing a 5th exercise at the end of a
//    session, so nothing load-bearing may live there.
//  - Quads run as a pain-guided reload (Bulgarian split squat core, leg
//    extension bonus) while the knee settles. Squat/leg press return later.
//
// Selection rationale (see also KB notes):
//  - Overhead cable tricep extension replaces the pushdown: 19.9% vs 13.5%
//    triceps growth in direct 12-week comparison (Maeo 2023).
//  - Smith machine calf raise (straight knee, lengthened gastroc) replaces the
//    seated calf raise, which biases soleus in the shortened position.
//  - No shoulder press slot: pressing already grows the front delt as much as
//    the pec major (Brandão 2024).
//  - Incline DB press restored at the user's request for a proper 8-week trial.
// Cardio sits outside the slots.

// ─── Normal Templates ──────────────────────────────────────
const UPPER_A = {
  type: 'upper_a',
  label: 'Upper A',
  subtitle: 'Incline press & pulldown',
  exercises: [
    { name: 'Incline Dumbbell Press', sets: 4, reps: '6-8', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Lat Pulldown', sets: 3, reps: '8-10', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Overhead Cable Tricep Extension', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'triceps' },
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', slot: 4, is_bonus: false, primary_muscle: 'shoulders' },
    { name: 'Cable Crunch', sets: 3, reps: '10-12', slot: 5, is_bonus: true, primary_muscle: 'abs' },
  ],
  bench_swap_options: ['Barbell Bench Press', 'Pec Fly Machine (Pec Deck)'],
};

const LOWER_A = {
  type: 'lower_a',
  label: 'Lower',
  subtitle: 'RDL, split squat & calves',
  exercises: [
    { name: 'Smith Machine Romanian Deadlift', sets: 4, reps: '8-10', slot: 1, is_bonus: false, primary_muscle: 'hamstrings' },
    { name: 'Bulgarian Split Squat', sets: 3, reps: '8-12', slot: 2, is_bonus: false, primary_muscle: 'quads' },
    { name: 'Smith Machine Calf Raise', sets: 4, reps: '10-15', slot: 3, is_bonus: false, primary_muscle: 'calves' },
    { name: 'Back Extension', sets: 3, reps: '12-15', slot: 4, is_bonus: false, primary_muscle: 'lower_back' },
    { name: 'Leg Extension', sets: 3, reps: '12-15', slot: 5, is_bonus: true, primary_muscle: 'quads' },
  ],
};

const UPPER_B = {
  type: 'upper_b',
  label: 'Upper B',
  subtitle: 'Bench press & cable row',
  exercises: [
    { name: 'Barbell Bench Press', sets: 4, reps: '6-8', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Preacher Curl (EZ Bar)', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'biceps' },
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', slot: 4, is_bonus: false, primary_muscle: 'shoulders' },
    { name: 'Reverse Pec Deck', sets: 3, reps: '12-15', slot: 5, is_bonus: true, primary_muscle: 'rear_delts' },
  ],
  bench_swap_options: ['Standing Cable Chest Press', 'Pec Fly Machine (Pec Deck)'],
};

const LOWER_B = {
  type: 'upper_c',
  label: 'Upper C',
  subtitle: 'Pec deck & pull-up',
  exercises: [
    { name: 'Pec Fly Machine (Pec Deck)', sets: 4, reps: '10-12', slot: 1, is_bonus: false, primary_muscle: 'chest' },
    { name: 'Assisted Pull-Up Machine', sets: 3, reps: '6-10', slot: 2, is_bonus: false, primary_muscle: 'back' },
    { name: 'Overhead Cable Tricep Extension', sets: 3, reps: '10-12', slot: 3, is_bonus: false, primary_muscle: 'triceps' },
    { name: 'Cable Curl', sets: 3, reps: '10-12', slot: 4, is_bonus: false, primary_muscle: 'biceps' },
    { name: 'Smith Machine Calf Raise', sets: 3, reps: '10-15', slot: 5, is_bonus: true, primary_muscle: 'calves' },
  ],
};

const ROTATION = [UPPER_A, LOWER_A, UPPER_B, LOWER_B];

// Deterministic successor map — the only source of truth for rotation order.
const SUCCESSOR_MAP = {

  upper_a: 'lower_a',
  lower_a: 'upper_b',
  upper_b: 'upper_c',
  upper_c: 'upper_a',
};

const TYPE_MAP = {};
for (const w of ROTATION) TYPE_MAP[w.type] = w;

// ─── Knee Block Templates ─────────────────────────────────
// Active while knee_block_active = 1 in goal table.
// Same four type keys as the normal rotation, so exiting the block can never
// dead-end the successor map. Only the LOWER day's contents differ: all
// quad-loading work is removed, and the bonus slot holds abs instead of
// leg extension.
// Weekly: chest 11, back 9, shoulders 6, triceps 6, biceps 6, quads 0.

const KB_UPPER_A = { ...UPPER_A };
const KB_UPPER_B = { ...UPPER_B };
const KB_UPPER_C = { ...LOWER_B };

const KB_LOWER = {
  type: 'lower_a',
  label: 'Lower',
  subtitle: 'RDL & calves (knee block)',
  exercises: [
    { name: 'Smith Machine Romanian Deadlift', sets: 4, reps: '8-10', slot: 1, is_bonus: false, primary_muscle: 'hamstrings' },
    { name: 'Smith Machine Calf Raise', sets: 4, reps: '10-15', slot: 2, is_bonus: false, primary_muscle: 'calves' },
    { name: 'Back Extension', sets: 3, reps: '12-15', slot: 3, is_bonus: false, primary_muscle: 'lower_back' },
    { name: 'Cable Crunch', sets: 3, reps: '10-12', slot: 4, is_bonus: false, primary_muscle: 'abs' },
    { name: 'Reverse Pec Deck', sets: 3, reps: '12-15', slot: 5, is_bonus: true, primary_muscle: 'rear_delts' },
  ],
};

const KB_ROTATION = [KB_UPPER_A, KB_LOWER, KB_UPPER_B, KB_UPPER_C];

// Same order and same keys as SUCCESSOR_MAP — only the LOWER content changes.
const KB_SUCCESSOR_MAP = {
  upper_a: 'lower_a',
  lower_a: 'upper_b',
  upper_b: 'upper_c',
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
  'Bulgarian Split Squat': 'Loaded knee flexion — reintroduce as the reload progresses',
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

// Core slots are 1-4; the bonus slot (5) is optional by design.
function coreExercises(workout) {
  return (workout.exercises || []).filter(e => !e.is_bonus);
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
  coreExercises,
};
