// Workout programme templates
// 3-day: Full Body A / B / C rotation
// 4-day: Upper A / Lower A / Upper B / Lower B rotation
//
// Each template has 5 exercise slots (~45-55 min with cardio).
// The last slot is always a PAIRED block (superset with 45-60s shared rest).
// Paired exercises are marked with paired: true.

const FULL_BODY_A = {
  type: 'fullbody_a',
  label: 'Full Body A',
  subtitle: 'Squat emphasis',
  exercises: [
    { name: 'Barbell Back Squat', sets: 4, reps: '6-8' },
    { name: 'Barbell Bench Press', sets: 3, reps: '6-8' },
    { name: 'Lat Pulldown', sets: 3, reps: '8-10' },
    { name: 'Romanian Deadlift', sets: 3, reps: '8-10' },
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', paired: true },
    { name: 'Rear Delt Fly', sets: 3, reps: '15', paired: true },
  ],
};

const FULL_BODY_B = {
  type: 'fullbody_b',
  label: 'Full Body B',
  subtitle: 'Hinge emphasis',
  exercises: [
    { name: 'Conventional Deadlift', sets: 3, reps: '5-6' },
    { name: 'Standing Overhead Press', sets: 3, reps: '6-8' },
    { name: 'Barbell Row', sets: 3, reps: '8-10' },
    { name: 'Leg Press', sets: 3, reps: '10-12' },
    { name: 'Cable Bicep Curl', sets: 2, reps: '10-12', paired: true },
    { name: 'Cable Tricep Pushdown', sets: 2, reps: '10-12', paired: true },
  ],
};

const FULL_BODY_C = {
  type: 'fullbody_c',
  label: 'Full Body C',
  subtitle: 'Single-leg emphasis',
  exercises: [
    { name: 'Bulgarian Split Squat', sets: 3, reps: '8-10/leg' },
    { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10' },
    { name: 'Seated Cable Row', sets: 3, reps: '10-12' },
    { name: 'Lying Leg Curl', sets: 3, reps: '10-12' },
    { name: 'Cable Crunch', sets: 3, reps: '12-15', paired: true },
    { name: 'Standing Calf Raise', sets: 3, reps: '12-15', paired: true },
  ],
};

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
    { name: 'Standing Calf Raise', sets: 4, reps: '12-15', paired: true },
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

const THREE_DAY_ROTATION = [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C];
const FOUR_DAY_ROTATION = [UPPER_A, LOWER_A, UPPER_B, LOWER_B];

function getRotation(frequency) {
  return frequency === 4 ? FOUR_DAY_ROTATION : THREE_DAY_ROTATION;
}

function getNextWorkout(frequency, index) {
  const rotation = getRotation(frequency);
  const safeIndex = index % rotation.length;
  return rotation[safeIndex];
}

module.exports = {
  FULL_BODY_A, FULL_BODY_B, FULL_BODY_C,
  UPPER_A, LOWER_A, UPPER_B, LOWER_B,
  THREE_DAY_ROTATION, FOUR_DAY_ROTATION,
  getRotation, getNextWorkout,
};
