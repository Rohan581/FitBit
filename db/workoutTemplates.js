// Fixed 4-day Upper/Lower rotation: Upper A → Lower A → Upper B → Lower B
// Hard cap: 5 exercises per session. No pairing — every exercise is a standalone slot.
// Cardio sits outside the 5 slots.

const UPPER_A = {
  type: 'upper_a',
  label: 'Upper A',
  subtitle: 'Chest & row focus',
  exercises: [
    { name: 'Chest Press Machine', sets: 4, reps: '6-8' },
    { name: 'Chest-Supported Row Machine', sets: 4, reps: '8-10' },
    { name: 'Shoulder Press Machine', sets: 3, reps: '8-10' },
    { name: 'Lat Pulldown', sets: 3, reps: '10-12' },
    { name: 'Cable Bicep Curl', sets: 3, reps: '10-12' },
  ],
};

const LOWER_A = {
  type: 'lower_a',
  label: 'Lower A',
  subtitle: 'Squat & leg curl focus',
  exercises: [
    { name: 'Smith Machine Squat', sets: 4, reps: '6-8' },
    { name: 'Seated Leg Curl', sets: 3, reps: '10-12' },
    { name: 'Leg Press', sets: 3, reps: '10-12' },
    { name: 'Standing Calf Raise', sets: 4, reps: '12-15' },
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
    { name: 'Seated Cable Row', sets: 3, reps: '10-12' },
    { name: 'Cable Lateral Raise', sets: 3, reps: '12-15' },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-12' },
  ],
};

const LOWER_B = {
  type: 'lower_b',
  label: 'Lower B',
  subtitle: 'Hinge & single-leg focus',
  exercises: [
    { name: 'Cable Pull-Through', sets: 3, reps: '5-6' },
    { name: 'Leg Press', sets: 3, reps: '8-10/leg' },
    { name: 'Hip Thrust Machine', sets: 3, reps: '10-12' },
    { name: 'Leg Extension', sets: 3, reps: '12-15' },
    { name: 'Seated Calf Raise', sets: 4, reps: '15' },
  ],
};

const ROTATION = [UPPER_A, LOWER_A, UPPER_B, LOWER_B];

function getNextWorkout(index) {
  return ROTATION[index % ROTATION.length];
}

module.exports = {
  UPPER_A, LOWER_A, UPPER_B, LOWER_B,
  ROTATION,
  getNextWorkout,
};
