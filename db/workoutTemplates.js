// Fixed 4-day Upper/Lower rotation: Upper A → Lower A → Upper B → Lower B
// Deterministic successor map — no stored counter. Derives next workout
// from the last completed session's workout_type.
// Hard cap: 5 exercises per session. Every exercise is a standalone slot.
// Cardio sits outside the 5 slots.

const UPPER_A = {
  type: 'upper_a',
  label: 'Upper A',
  subtitle: 'Bench & pulldown focus',
  exercises: [
    { name: 'Smith Machine Bench Press', sets: 4, reps: '6-8' },
    { name: 'Lat Pulldown', sets: 4, reps: '8-10' },
    { name: 'Shoulder Press Machine', sets: 3, reps: '8-10' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12' },
    { name: 'Preacher Curl (EZ Bar)', sets: 3, reps: '10-12' },
  ],
};

const LOWER_A = {
  type: 'lower_a',
  label: 'Lower A',
  subtitle: 'Squat & leg curl focus',
  exercises: [
    { name: 'Smith Machine Squat', sets: 4, reps: '6-8' },
    { name: 'Leg Press', sets: 3, reps: '10-12' },
    { name: 'Lying Leg Curl', sets: 3, reps: '10-12' },
    { name: 'Seated Calf Raise', sets: 4, reps: '12-15' },
    { name: 'Cable Crunch', sets: 3, reps: '12-15' },
  ],
};

const UPPER_B = {
  type: 'upper_b',
  label: 'Upper B',
  subtitle: 'Incline & pull-up focus',
  exercises: [
    { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10' },
    { name: 'Assisted Pull-Up Machine', sets: 4, reps: '6-10' },
    { name: 'T-Bar Row', sets: 3, reps: '10-12' },
    { name: 'Cable Lateral Raise', sets: 3, reps: '12-15' },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-12' },
  ],
};

const LOWER_B = {
  type: 'lower_b',
  label: 'Lower B',
  subtitle: 'RDL & single-leg focus',
  exercises: [
    { name: 'Smith Machine Romanian Deadlift', sets: 4, reps: '8-10' },
    { name: 'Single-Leg Leg Press', sets: 3, reps: '8-10/leg' },
    { name: 'Leg Extension', sets: 3, reps: '12-15' },
    { name: 'Back Extension', sets: 3, reps: '12-15' },
    { name: 'Seated Calf Raise', sets: 4, reps: '12-15' },
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

module.exports = {
  UPPER_A, LOWER_A, UPPER_B, LOWER_B,
  ROTATION,
  SUCCESSOR_MAP,
  getNextWorkoutType,
  getWorkoutByType,
};
