// Fixed 4-day Upper/Lower rotation: Upper A → Lower A → Upper B → Lower B
// Hard cap: 5 exercise slots per session (paired block = 1 slot).
// Cardio sits outside the 5 slots.

const UPPER_A = {
  type: 'upper_a',
  label: 'Upper A',
  subtitle: 'Bench & row focus',
  exercises: [
    { name: 'Barbell Bench Press', sets: 4, reps: '6-8' },
    { name: 'Barbell Row', sets: 4, reps: '8-10' },
    { name: 'Standing Overhead Press', sets: 3, reps: '8-10' },
    { name: 'Lat Pulldown', sets: 3, reps: '10-12' },
    { name: 'Cable Bicep Curl', sets: 3, reps: '10-12', paired: true },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: '10-12', paired: true },
  ],
};

const LOWER_A = {
  type: 'lower_a',
  label: 'Lower A',
  subtitle: 'Squat & RDL focus',
  exercises: [
    { name: 'Barbell Back Squat', sets: 4, reps: '6-8' },
    { name: 'Romanian Deadlift', sets: 3, reps: '8-10' },
    { name: 'Leg Press', sets: 3, reps: '10-12' },
    { name: 'Standing Calf Raise', sets: 4, reps: '12-15' },
    { name: 'Cable Crunch', sets: 3, reps: '12-15', paired: true },
    { name: 'Hanging Leg Raise', sets: 3, reps: '12-15', paired: true },
  ],
};

const UPPER_B = {
  type: 'upper_b',
  label: 'Upper B',
  subtitle: 'Incline & pull-up focus',
  exercises: [
    { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10' },
    { name: 'Pull-Up', sets: 4, reps: '6-10' },
    { name: 'Seated Dumbbell Shoulder Press', sets: 3, reps: '8-10' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12' },
    { name: 'Face Pull', sets: 3, reps: '15', paired: true },
    { name: 'Dumbbell Hammer Curl', sets: 3, reps: '10-12', paired: true },
  ],
};

const LOWER_B = {
  type: 'lower_b',
  label: 'Lower B',
  subtitle: 'Deadlift & split squat focus',
  exercises: [
    { name: 'Conventional Deadlift', sets: 3, reps: '5-6' },
    { name: 'Bulgarian Split Squat', sets: 3, reps: '8-10/leg' },
    { name: 'Hip Thrust', sets: 3, reps: '10-12' },
    { name: 'Leg Extension', sets: 3, reps: '12-15', paired: true },
    { name: 'Seated Leg Curl', sets: 3, reps: '12-15', paired: true },
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
