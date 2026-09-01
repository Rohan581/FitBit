// Bundled exercise library — imported at build time for offline access.
// Zero network dependency for exercise detail sheets.

const EXERCISES = {
  'Barbell Back Squat': {
    name: 'Barbell Back Squat',
    primary_muscles: ['quads', 'glutes'],
    secondary_muscles: ['hamstrings', 'lower_back', 'abs'],
    form_cues: [
      'Place the bar across your upper traps (high bar) or rear delts (low bar), grip the bar just outside shoulder width, and unrack by standing up with both feet under the bar.',
      'Set your feet shoulder-width apart with toes turned out 15-30 degrees; brace your core by taking a deep breath into your belly and holding it throughout the rep.',
      'Initiate the descent by simultaneously breaking at the hips and knees, keeping your chest up and your knees tracking over your toes.',
      'Descend until your hip crease drops below the top of your knee (parallel or below), then drive up through your whole foot while exhaling past the sticking point.',
      'Keep your back flat and avoid rounding your lower back at the bottom; maintain a neutral head position by looking at a spot on the floor 6-8 feet ahead.'
    ],
    common_mistakes: [
      'Letting the knees cave inward (valgus collapse) during the ascent — actively push knees out over toes.',
      'Rising hips first out of the hole ("good-morning squat"), which shifts load onto the lower back instead of the legs.',
      'Cutting depth short of parallel, reducing quad and glute activation.'
    ],
    substitutes: ['Smith Machine Squat', 'Leg Press', 'Bulgarian Split Squat', 'Goblet Squat'],
    youtube_search_term: 'barbell back squat proper form',
    equipment_type: 'barbell',
    required_equipment: ['squat_rack', 'barbell'],
  },

  'Smith Machine Squat': {
    name: 'Smith Machine Squat',
    primary_muscles: ['quads', 'glutes'],
    secondary_muscles: ['hamstrings', 'abs'],
    form_cues: [
      'Position yourself under the Smith machine bar with it resting across your upper traps; set your feet slightly forward of the bar (about 6-12 inches) and shoulder-width apart with toes turned out 15-30 degrees.',
      'The bar path is fixed and vertical \u2014 use this to your advantage by placing feet forward enough to keep shins near-vertical, which shifts emphasis to the quads and glutes while reducing knee stress.',
      'Unrack by rotating the bar to release the hooks; brace your core, then descend by bending at the hips and knees simultaneously until your thighs reach parallel or below.',
      'Drive up through your whole foot, pressing your back firmly into the bar throughout; the guided path lets you focus on pushing hard without worrying about balance.',
      'Re-rack by rotating the bar into the nearest set of hooks at the top. Control the depth on every rep \u2014 the fixed path makes it easy to cut short, so consciously hit your target depth.'
    ],
    common_mistakes: [
      'Placing feet directly under the bar (as in a free squat) \u2014 on a Smith machine, feet should be slightly forward to accommodate the vertical bar path and protect the knees.',
      'Relying on the machine for balance and losing core engagement \u2014 brace as if you were squatting free.',
      'Cutting depth short because the guided bar path makes partial reps feel complete \u2014 always aim for at least parallel.'
    ],
    substitutes: ['Barbell Back Squat', 'Leg Press', 'Goblet Squat'],
    youtube_search_term: 'smith machine squat proper form',
    equipment_type: 'machine',
    required_equipment: ['smith_machine'],
  },

  'Barbell Bench Press': {
    name: 'Barbell Bench Press',
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps', 'front_delts'],
    form_cues: [
      'Lie on the bench with eyes directly under the bar; retract and depress your shoulder blades, pinching them together to create a stable shelf.',
      'Grip the bar slightly wider than shoulder width, wrap your thumbs around the bar, and unrack with straight arms.',
      'Lower the bar in a controlled arc to your lower chest/nipple line, tucking your elbows to roughly 45-75 degrees from your torso.',
      'Press the bar up and slightly back toward the rack in a reverse arc, driving through your palms and keeping your feet flat on the floor.',
      'Maintain a slight natural arch in your lower back throughout; exhale forcefully as you press through the sticking point.'
    ],
    common_mistakes: [
      'Flaring the elbows out to 90 degrees, which puts excessive stress on the shoulder joint.',
      'Bouncing the bar off the chest instead of pausing briefly for a controlled touch.',
      'Lifting the hips off the bench during the press, reducing stability and risking lower back strain.'
    ],
    substitutes: ['Incline Dumbbell Press', 'Dips', 'Dumbbell Bench Press'],
    youtube_search_term: 'barbell bench press proper form'
  },

  'Lat Pulldown': {
    name: 'Lat Pulldown',
    primary_muscles: ['lats'],
    secondary_muscles: ['biceps', 'upper_back', 'rear_delts'],
    form_cues: [
      'Sit with your thighs secured under the pad; grip the bar slightly wider than shoulder width with an overhand grip.',
      'Lean your torso back about 10-15 degrees, puff your chest up, and initiate the pull by driving your elbows down and back.',
      'Pull the bar to your upper chest, squeezing your shoulder blades together at the bottom of the movement.',
      'Return the bar to the top under control with arms fully extended, allowing a full stretch of the lats before the next rep.',
      'Exhale as you pull the bar down and inhale as you let it return to the top.'
    ],
    common_mistakes: [
      'Pulling the bar behind the neck, which places the shoulder in a vulnerable externally-rotated position.',
      'Using excessive momentum by leaning too far back and swinging the torso.',
      'Gripping too wide, which reduces range of motion and lat activation.'
    ],
    substitutes: ['Pull-Up', 'Seated Cable Row', 'Dumbbell Row'],
    youtube_search_term: 'lat pulldown proper form'
  },

  'Romanian Deadlift': {
    name: 'Romanian Deadlift',
    primary_muscles: ['hamstrings', 'glutes'],
    secondary_muscles: ['lower_back', 'traps', 'forearms'],
    form_cues: [
      'Stand with feet hip-width apart, holding the barbell at hip height with an overhand or mixed grip; pull your shoulders back and down.',
      'Hinge at the hips by pushing them straight back while maintaining a slight bend in the knees (about 15-20 degrees) — this is NOT a squat.',
      'Lower the bar close to your legs (it should skim your shins/thighs) until you feel a deep stretch in your hamstrings, typically around mid-shin level.',
      'Drive your hips forward to return to standing, squeezing your glutes hard at the top without hyperextending your lower back.',
      'Keep your back flat and chest up throughout; inhale before you descend and exhale as you drive your hips through.'
    ],
    common_mistakes: [
      'Rounding the lower back during the descent, which puts dangerous shear force on the lumbar spine.',
      'Bending the knees too much, turning the movement into a conventional deadlift rather than a hip hinge.',
      'Letting the bar drift away from the body, increasing the moment arm on the lower back.'
    ],
    substitutes: ['Lying Leg Curl', 'Seated Leg Curl', 'Stiff-Leg Deadlift'],
    youtube_search_term: 'romanian deadlift proper form'
  },

  'Dumbbell Lateral Raise': {
    name: 'Dumbbell Lateral Raise',
    primary_muscles: ['side_delts'],
    secondary_muscles: ['traps', 'front_delts'],
    form_cues: [
      'Stand with feet shoulder-width apart, holding dumbbells at your sides with a slight bend in your elbows.',
      'Raise the dumbbells out to the sides in a wide arc until your arms are roughly parallel with the floor (upper arms at shoulder height).',
      'Lead with your elbows, not your hands — think of pouring water out of a pitcher at the top of the movement.',
      'Lower the dumbbells slowly under control; do not let them drop or swing back down.',
      'Exhale as you lift and keep your torso still — avoid shrugging your traps to cheat the weight up.'
    ],
    common_mistakes: [
      'Using too much weight and compensating with momentum, swinging the torso, or shrugging the traps.',
      'Raising the arms too high above shoulder level, which shifts tension from the side delts to the traps.',
      'Keeping the arms perfectly straight, which stresses the elbow joint — maintain a slight bend.'
    ],
    substitutes: ['Cable Lateral Raise', 'Machine Lateral Raise'],
    youtube_search_term: 'dumbbell lateral raise proper form'
  },

  'Cable Bicep Curl': {
    name: 'Cable Bicep Curl',
    primary_muscles: ['biceps'],
    secondary_muscles: ['forearms'],
    form_cues: [
      'Attach a straight bar or EZ-bar to the low pulley; stand about one foot from the machine with feet shoulder-width apart.',
      'Keep your elbows pinned to your sides throughout the movement — only your forearms should move.',
      'Curl the handle up toward your shoulders, squeezing your biceps hard at the top of the contraction.',
      'Lower the weight slowly under control until your arms are fully extended, maintaining constant tension from the cable.',
      'Exhale on the way up, inhale on the way down; keep your knees slightly bent and avoid leaning back.'
    ],
    common_mistakes: [
      'Swinging the elbows forward or letting them drift away from the torso, which recruits the front delts.',
      'Using body momentum by rocking back and forth to curl the weight.',
      'Not fully extending the arms at the bottom, cutting the range of motion short.'
    ],
    substitutes: ['Dumbbell Hammer Curl', 'Barbell Curl', 'Incline Dumbbell Curl'],
    youtube_search_term: 'cable bicep curl proper form'
  },

  'Cable Tricep Pushdown': {
    name: 'Cable Tricep Pushdown',
    primary_muscles: ['triceps'],
    secondary_muscles: [],
    form_cues: [
      'Attach a straight bar, V-bar, or rope to the high pulley; stand facing the machine with feet shoulder-width apart and a slight forward lean.',
      'Pin your elbows tight to your sides and keep your upper arms stationary throughout the movement.',
      'Push the handle downward until your arms are fully extended, squeezing the triceps hard at lockout.',
      'Return the handle up slowly until your forearms are just past parallel to the floor — do not let the weight stack slam.',
      'Exhale as you push down; keep your core braced and avoid flaring your elbows outward.'
    ],
    common_mistakes: [
      'Allowing the elbows to flare out or drift forward, which shifts the load away from the triceps.',
      'Leaning over the bar and pressing with body weight instead of isolating the triceps.',
      'Using a partial range of motion by not fully extending the arms at the bottom.'
    ],
    substitutes: ['Overhead Tricep Extension', 'Dips', 'Skull Crushers'],
    youtube_search_term: 'cable tricep pushdown proper form'
  },

  'Conventional Deadlift': {
    name: 'Conventional Deadlift',
    primary_muscles: ['hamstrings', 'glutes', 'lower_back'],
    secondary_muscles: ['quads', 'traps', 'forearms', 'lats'],
    form_cues: [
      'Stand with feet hip-width apart, the bar over your mid-foot; bend at the hips and knees to grip the bar just outside your shins with a double overhand or mixed grip.',
      'Drop your hips until your shins touch the bar, flatten your back, and pull the slack out of the bar by engaging your lats — you should feel tension before the bar leaves the floor.',
      'Drive through the floor with your legs first while keeping the bar tight against your body; the hips and shoulders should rise at the same rate.',
      'Once the bar passes your knees, drive your hips forward to lockout, standing tall with your glutes squeezed — do not hyperextend at the top.',
      'Inhale and brace hard before each rep; lower the bar by hinging at the hips first, then bending the knees once it passes them.'
    ],
    common_mistakes: [
      'Rounding the lower back, especially off the floor — this is the most common cause of deadlift injuries.',
      'Starting with hips too high (turning it into a stiff-leg deadlift) or too low (turning it into a squat).',
      'Letting the bar drift away from the body, which massively increases the load on the lower back.'
    ],
    substitutes: ['Romanian Deadlift', 'Barbell Row', 'Trap Bar Deadlift'],
    youtube_search_term: 'conventional deadlift proper form'
  },

  'Standing Overhead Press': {
    name: 'Standing Overhead Press',
    primary_muscles: ['front_delts', 'side_delts'],
    secondary_muscles: ['triceps', 'upper_back', 'abs'],
    form_cues: [
      'Unrack the bar at collarbone height with a grip just outside shoulder width; stand with feet shoulder-width apart and squeeze your glutes and abs for stability.',
      'Press the bar straight up, moving your head slightly back to allow the bar to pass your face, then pushing your head through once the bar clears.',
      'Lock the bar out directly overhead with your biceps by your ears; the bar should be over your mid-foot from the side view.',
      'Lower the bar back to your collarbone under control; inhale at the bottom and exhale as you drive the bar overhead.',
      'Keep your ribcage down and avoid excessive lower back arch — if you are leaning way back, the weight is too heavy.'
    ],
    common_mistakes: [
      'Excessive lumbar hyperextension (leaning back), turning the press into a standing incline press and stressing the spine.',
      'Pressing the bar forward in front of the head instead of straight overhead, which is mechanically inefficient.',
      'Not fully locking out at the top, missing the full range of motion and overhead stability benefits.'
    ],
    substitutes: ['Seated Dumbbell Shoulder Press', 'Dumbbell Lateral Raise', 'Machine Shoulder Press'],
    youtube_search_term: 'standing overhead press barbell proper form'
  },

  'Barbell Row': {
    name: 'Barbell Row',
    primary_muscles: ['upper_back', 'lats'],
    secondary_muscles: ['biceps', 'rear_delts', 'lower_back', 'forearms'],
    form_cues: [
      'Hinge at the hips to about a 45-degree torso angle, keeping a flat back; hold the bar with an overhand grip slightly wider than shoulder width.',
      'Pull the bar toward your lower chest or upper abdomen, driving your elbows back and squeezing your shoulder blades together at the top.',
      'Lower the bar under control to full arm extension, feeling a stretch in your lats at the bottom.',
      'Keep your core braced and torso angle consistent — avoid standing up to cheat the weight.',
      'Exhale as you row the bar up; inhale as you lower it. Keep your neck neutral by looking at the floor a few feet ahead.'
    ],
    common_mistakes: [
      'Using excessive body English — jerking the torso upright to swing the weight up rather than rowing it.',
      'Pulling to the wrong position: too high targets traps, too low misses the upper back.',
      'Rounding the lower back under fatigue, which puts the spine at risk in a loaded hinge position.'
    ],
    substitutes: ['Seated Cable Row', 'Lat Pulldown', 'Dumbbell Row'],
    youtube_search_term: 'barbell row proper form'
  },

  'Leg Press': {
    name: 'Leg Press',
    primary_muscles: ['quads', 'glutes'],
    secondary_muscles: ['hamstrings', 'adductors'],
    form_cues: [
      'Sit in the machine with your back and hips flush against the pad; place your feet shoulder-width apart in the center of the platform.',
      'Release the safety handles and lower the platform by bending your knees toward your chest — descend until your knees reach about 90 degrees.',
      'Press the platform away by driving through your whole foot, focusing on pushing with the quads and glutes.',
      'Do not lock your knees out completely at the top — stop just short of full extension to keep tension on the muscles.',
      'Keep your lower back pressed into the seat at all times; if your hips start to tuck under (butt wink) at the bottom, you have gone too deep.'
    ],
    common_mistakes: [
      'Placing feet too low on the platform, which puts excessive stress on the knees and reduces glute involvement.',
      'Letting the lower back round off the pad at the bottom of the movement, risking disc injury.',
      'Locking the knees fully at the top, which transfers load to the joints instead of the muscles.'
    ],
    substitutes: ['Barbell Back Squat', 'Bulgarian Split Squat', 'Hack Squat'],
    youtube_search_term: 'leg press machine proper form'
  },

  'Face Pull': {
    name: 'Face Pull',
    primary_muscles: ['rear_delts', 'upper_back'],
    secondary_muscles: ['traps', 'biceps'],
    form_cues: [
      'Set a cable pulley to upper-chest or face height with a rope attachment; grip the rope with an overhand (thumbs-toward-you) grip.',
      'Step back to create tension, stagger your feet for balance, and start with arms fully extended in front of you.',
      'Pull the rope toward your face by driving your elbows wide and back, externally rotating your shoulders so your hands finish beside your ears.',
      'Squeeze your rear delts and upper back at the peak contraction for a one-second hold.',
      'Return the rope slowly to the start position with control; exhale as you pull and inhale as you release.'
    ],
    common_mistakes: [
      'Pulling to the chin or neck instead of the face/forehead, which reduces rear delt and rotator cuff activation.',
      'Using too much weight and turning the movement into a row rather than a face pull with external rotation.',
      'Leaning back excessively and using body weight to move the load instead of isolating the rear delts.'
    ],
    substitutes: ['Rear Delt Fly', 'Band Pull-Apart', 'Reverse Pec Deck'],
    youtube_search_term: 'face pull cable proper form'
  },

  'Dumbbell Hammer Curl': {
    name: 'Dumbbell Hammer Curl',
    primary_muscles: ['biceps', 'forearms'],
    secondary_muscles: [],
    form_cues: [
      'Stand with feet shoulder-width apart, holding dumbbells at your sides with palms facing each other (neutral grip).',
      'Keeping your elbows pinned to your sides, curl the dumbbells up toward your shoulders without rotating your wrists.',
      'Squeeze at the top for a brief pause, then lower the dumbbells slowly under control to full extension.',
      'Keep your torso upright and avoid swinging — if you need to rock your body, the weight is too heavy.',
      'Exhale as you curl up, inhale as you lower; you can alternate arms or curl both simultaneously.'
    ],
    common_mistakes: [
      'Swinging the dumbbells using body momentum, which takes tension off the biceps and brachioradialis.',
      'Allowing the elbows to drift forward during the curl, recruiting the front delts.',
      'Rushing the eccentric (lowering) phase — slow it down to 2-3 seconds for more muscle activation.'
    ],
    substitutes: ['Cable Bicep Curl', 'Barbell Curl', 'Rope Cable Curl'],
    youtube_search_term: 'dumbbell hammer curl proper form'
  },

  'Dips': {
    name: 'Dips',
    primary_muscles: ['chest', 'triceps'],
    secondary_muscles: ['front_delts'],
    form_cues: [
      'Grip the parallel bars with straight arms, supporting your full body weight; cross your ankles behind you if desired.',
      'Lean your torso forward about 15-30 degrees for chest emphasis, or stay upright for more triceps emphasis.',
      'Lower yourself by bending at the elbows until your upper arms are at least parallel with the floor, feeling a stretch across the chest.',
      'Press yourself back up to full arm extension, squeezing your chest and triceps at the top.',
      'Inhale on the way down, exhale as you drive up; keep your shoulders down and away from your ears throughout.'
    ],
    common_mistakes: [
      'Going too deep beyond your shoulder mobility, which can strain the anterior shoulder capsule.',
      'Flaring the elbows out excessively wide, which increases shoulder joint stress.',
      'Shrugging the shoulders up toward the ears at the top instead of keeping them depressed.'
    ],
    substitutes: ['Cable Tricep Pushdown', 'Barbell Bench Press', 'Close-Grip Bench Press'],
    youtube_search_term: 'dips chest triceps proper form'
  },

  'Bulgarian Split Squat': {
    name: 'Bulgarian Split Squat',
    primary_muscles: ['quads', 'glutes'],
    secondary_muscles: ['hamstrings', 'adductors', 'abs'],
    form_cues: [
      'Stand about 2 feet in front of a bench; place the top of your rear foot on the bench behind you, laces down.',
      'Keep your torso upright and your front shin relatively vertical; your front foot should be far enough forward that the knee does not travel past your toes significantly.',
      'Lower yourself by bending the front knee until your rear knee nearly touches the floor, or your front thigh reaches parallel.',
      'Drive up through the heel and mid-foot of your front leg, squeezing your glute at the top.',
      'Exhale as you stand up; keep your hips square and facing forward — avoid rotating or shifting laterally.'
    ],
    common_mistakes: [
      'Placing the front foot too close to the bench, which forces the knee far over the toes and stresses the knee joint.',
      'Leaning the torso too far forward, shifting emphasis off the quads and onto the lower back.',
      'Losing balance by rushing — use a slow, controlled tempo until you have the movement pattern dialed in.'
    ],
    substitutes: ['Barbell Back Squat', 'Leg Press', 'Walking Lunges'],
    youtube_search_term: 'bulgarian split squat proper form'
  },

  'Incline Dumbbell Press': {
    name: 'Incline Dumbbell Press',
    primary_muscles: ['chest', 'front_delts'],
    secondary_muscles: ['triceps'],
    form_cues: [
      'Set an adjustable bench to 30-45 degrees; sit back with a dumbbell in each hand resting on your thighs, then kick them up to shoulder level as you lean back.',
      'Start with the dumbbells at chest height, elbows at roughly 45-degree angle from your torso; retract and depress your shoulder blades against the bench.',
      'Press the dumbbells up and slightly inward so they nearly touch at the top, with arms fully extended over your upper chest.',
      'Lower the dumbbells slowly to the sides of your upper chest, feeling a stretch across the pecs.',
      'Exhale on the press, inhale on the descent; keep your feet flat on the floor and back arched naturally.'
    ],
    common_mistakes: [
      'Setting the bench angle too steep (above 45 degrees), which turns the press into a shoulder exercise.',
      'Flaring the elbows to 90 degrees instead of tucking them to 45-60 degrees, which stresses the shoulder.',
      'Not achieving a full range of motion — dumbbells should come down to chest level for complete pec activation.'
    ],
    substitutes: ['Barbell Bench Press', 'Cable Chest Fly', 'Dips'],
    youtube_search_term: 'incline dumbbell press proper form'
  },

  'Seated Cable Row': {
    name: 'Seated Cable Row',
    primary_muscles: ['upper_back', 'lats'],
    secondary_muscles: ['biceps', 'rear_delts', 'forearms'],
    form_cues: [
      'Sit with your feet on the foot plate, knees slightly bent; grab the handle with arms fully extended, maintaining a flat back and upright torso.',
      'Pull the handle toward your lower chest or upper abdomen by driving your elbows straight back, squeezing your shoulder blades together.',
      'Hold the peak contraction for one second, keeping your chest lifted and shoulders pulled back.',
      'Return the handle forward under control, allowing a full stretch of the lats and upper back — let your shoulder blades protract slightly.',
      'Exhale as you pull, inhale as you release; keep your torso angle constant — do not rock back and forth.'
    ],
    common_mistakes: [
      'Rocking the torso back excessively to generate momentum, which takes tension off the back muscles.',
      'Shrugging the shoulders up during the pull instead of keeping them depressed.',
      'Using only the arms to pull without initiating the movement with the shoulder blades.'
    ],
    substitutes: ['Barbell Row', 'Lat Pulldown', 'Dumbbell Row'],
    youtube_search_term: 'seated cable row proper form'
  },

  'Lying Leg Curl': {
    name: 'Lying Leg Curl',
    primary_muscles: ['hamstrings'],
    secondary_muscles: ['calves'],
    form_cues: [
      'Lie face down on the machine with the pad resting just above your ankles (on the Achilles tendon area), and your knees just off the edge of the bench.',
      'Grip the handles and press your hips firmly into the pad — do not let them rise during the curl.',
      'Curl your heels toward your glutes by contracting your hamstrings, squeezing hard at the top of the movement.',
      'Lower the weight back down under control to near-full extension — do not let the weight stack slam.',
      'Exhale as you curl up; point your toes slightly to reduce calf involvement and maximize hamstring contraction.'
    ],
    common_mistakes: [
      'Lifting the hips off the bench during the curl, which uses momentum and reduces hamstring isolation.',
      'Using a partial range of motion — not curling high enough or not extending fully at the bottom.',
      'Going too heavy and jerking the weight, which can strain the hamstring tendons.'
    ],
    substitutes: ['Romanian Deadlift', 'Back Extension', 'Smith Machine Romanian Deadlift'],
    youtube_search_term: 'lying leg curl proper form'
  },

  'Rear Delt Fly': {
    name: 'Rear Delt Fly',
    primary_muscles: ['rear_delts'],
    secondary_muscles: ['upper_back', 'traps'],
    form_cues: [
      'Hinge at the hips with a flat back until your torso is nearly parallel to the floor, or use an incline bench for chest support; hold dumbbells with palms facing each other.',
      'With a slight bend in your elbows, raise the dumbbells out to the sides in a wide arc, leading with your elbows.',
      'Squeeze your rear delts and upper back at the top of the movement when your arms are roughly parallel to the floor.',
      'Lower the dumbbells slowly back to the starting position under control — do not let them swing.',
      'Exhale as you raise the weights; keep your neck neutral and avoid jerking your head up.'
    ],
    common_mistakes: [
      'Raising the torso during the lift, which turns it into a lateral raise and reduces rear delt activation.',
      'Using too much weight, leading to excessive trap involvement and momentum instead of rear delt isolation.',
      'Bending the elbows too much (past 30 degrees), which shortens the lever arm and reduces difficulty.'
    ],
    substitutes: ['Face Pull', 'Cable Rear Delt Fly', 'Reverse Pec Deck'],
    youtube_search_term: 'rear delt fly dumbbell proper form'
  },

  'Cable Crunch': {
    name: 'Cable Crunch',
    primary_muscles: ['abs'],
    secondary_muscles: ['obliques'],
    form_cues: [
      'Kneel in front of a high cable pulley with a rope attachment; hold the rope at the sides of your head or behind your neck.',
      'Start with your torso upright and your hips locked in position — the movement should come only from flexing your spine.',
      'Crunch down by rounding your upper back and driving your elbows toward your knees, focusing on contracting your abs.',
      'Squeeze hard at the bottom of the crunch for a one-second hold, then slowly return to the upright position.',
      'Exhale forcefully as you crunch down; inhale as you return to the top. Keep your hips stationary — they should not sit back toward your heels.'
    ],
    common_mistakes: [
      'Sitting back onto the heels instead of crunching the spine, which turns it into a hip flexor exercise.',
      'Using the arms to pull the cable down rather than driving the movement with ab contraction.',
      'Not achieving full spinal flexion, performing the movement with a flat back instead of rounding.'
    ],
    substitutes: ['Hanging Leg Raise', 'Ab Wheel Rollout', 'Weighted Decline Crunch'],
    youtube_search_term: 'cable crunch abs proper form'
  },

  'Hanging Leg Raise': {
    name: 'Hanging Leg Raise',
    primary_muscles: ['abs', 'hip_flexors'],
    secondary_muscles: ['obliques', 'forearms'],
    form_cues: [
      'Hang from a pull-up bar with a shoulder-width overhand grip, arms fully extended and shoulders packed (do not shrug).',
      'With legs straight (or knees slightly bent for an easier variation), raise your legs by curling your pelvis up, not just lifting the legs.',
      'Lift until your thighs are at least parallel to the floor, or higher if you can control it — the abs only fully engage when the pelvis tilts posteriorly.',
      'Lower your legs slowly under control back to the dead hang; avoid swinging or using momentum.',
      'Exhale as you raise your legs; if you swing, pause at the bottom to eliminate momentum before the next rep.'
    ],
    common_mistakes: [
      'Swinging the body to generate momentum instead of using a controlled ab contraction.',
      'Only raising the legs without curling the pelvis, which primarily works the hip flexors instead of the abs.',
      'Dropping the legs too quickly on the descent, losing the eccentric benefit and creating swing.'
    ],
    substitutes: ['Cable Crunch', 'Lying Leg Raise', 'Knee Raise'],
    youtube_search_term: 'hanging leg raise proper form'
  },

  'Pull-Up': {
    name: 'Pull-Up',
    primary_muscles: ['lats', 'upper_back'],
    secondary_muscles: ['biceps', 'forearms', 'rear_delts'],
    form_cues: [
      'Grip the bar with an overhand grip slightly wider than shoulder width; hang with arms fully extended and shoulders engaged (do not passively hang on your joints).',
      'Initiate the pull by depressing and retracting your shoulder blades, then drive your elbows down and back toward your hips.',
      'Pull until your chin clears the bar and your chest rises toward it; squeeze your lats and upper back at the top.',
      'Lower yourself under control to a full dead hang — each rep should start from arms fully extended.',
      'Exhale as you pull up; avoid kipping, swinging, or using your lower body to generate momentum.'
    ],
    common_mistakes: [
      'Using a partial range of motion — not going all the way down to a dead hang or not getting the chin over the bar.',
      'Craning the neck up to get the chin over the bar instead of actually pulling the body higher.',
      'Ignoring scapular engagement and relying solely on arm strength, which limits lat activation.'
    ],
    substitutes: ['Lat Pulldown', 'Seated Cable Row', 'Assisted Pull-Up Machine'],
    youtube_search_term: 'pull up proper form'
  },

  'Seated Dumbbell Shoulder Press': {
    name: 'Seated Dumbbell Shoulder Press',
    primary_muscles: ['front_delts', 'side_delts'],
    secondary_muscles: ['triceps', 'upper_back'],
    form_cues: [
      'Sit on a bench with back support set to 90 degrees (or very slightly reclined); hold dumbbells at shoulder height with palms facing forward.',
      'Press the dumbbells overhead until your arms are fully extended, bringing them slightly together at the top without clanking.',
      'Lower the dumbbells under control until they are at ear level or slightly below, with elbows at about 90 degrees.',
      'Keep your back flat against the pad and avoid arching excessively — if your back comes off the bench, the weight is too heavy.',
      'Exhale as you press up; inhale as you lower. Maintain a neutral wrist — the dumbbells should be directly above your elbows throughout.'
    ],
    common_mistakes: [
      'Arching the lower back excessively off the bench, turning the press into an incline press.',
      'Flaring the elbows too far back behind the body, which puts stress on the shoulder joint.',
      'Not pressing to full lockout, missing the full range of motion overhead.'
    ],
    substitutes: ['Standing Overhead Press', 'Dumbbell Lateral Raise', 'Arnold Press'],
    youtube_search_term: 'seated dumbbell shoulder press proper form'
  },

  'Cable Chest Fly': {
    name: 'Cable Chest Fly',
    primary_muscles: ['chest'],
    secondary_muscles: ['front_delts'],
    form_cues: [
      'Set both cable pulleys to shoulder height (or high for lower chest emphasis, low for upper chest); grab one handle in each hand and step forward into a staggered stance.',
      'Start with arms extended wide at your sides, elbows slightly bent (about 10-20 degrees) — maintain this elbow angle throughout the entire movement.',
      'Bring your hands together in a wide arc in front of your chest, squeezing your pecs hard when your hands meet or cross.',
      'Return your arms to the starting position slowly, feeling a deep stretch across your chest at full extension.',
      'Exhale as you bring your hands together; keep your torso stable and avoid rounding your shoulders forward.'
    ],
    common_mistakes: [
      'Bending and extending the elbows during the movement, turning the fly into a press.',
      'Using too much weight, which forces you to shorten the range of motion and lose the chest stretch.',
      'Leaning too far forward, which shifts the emphasis off the chest and onto the front delts.'
    ],
    substitutes: ['Incline Dumbbell Press', 'Smith Machine Bench Press', 'Pec Deck'],
    youtube_search_term: 'cable chest fly proper form'
  },

  'Overhead Tricep Extension': {
    name: 'Overhead Tricep Extension',
    primary_muscles: ['triceps'],
    secondary_muscles: [],
    form_cues: [
      'Hold a dumbbell, EZ-bar, or cable rope overhead with both hands, arms fully extended; keep your upper arms close to your ears.',
      'Lower the weight behind your head by bending at the elbows only — your upper arms should stay vertical and stationary.',
      'Descend until you feel a deep stretch in the triceps (elbows at about 90 degrees or slightly beyond).',
      'Extend your arms back to full lockout overhead, squeezing the triceps at the top.',
      'Exhale as you extend; keep your core tight and avoid arching your lower back — sit on a bench with back support if needed.'
    ],
    common_mistakes: [
      'Letting the elbows flare out wide, which reduces tricep activation and can stress the shoulders.',
      'Moving the upper arms forward and back instead of keeping them fixed next to the ears.',
      'Arching the lower back excessively, especially with heavy loads, which risks lower back injury.'
    ],
    substitutes: ['Cable Tricep Pushdown', 'Dips', 'Skull Crushers'],
    youtube_search_term: 'overhead tricep extension proper form'
  },

  'Leg Extension': {
    name: 'Leg Extension',
    primary_muscles: ['quads'],
    secondary_muscles: [],
    form_cues: [
      'Sit in the machine with your back flat against the pad; adjust the shin pad so it sits on your lower shins just above your ankles.',
      'Grip the side handles and extend your legs by straightening your knees until your legs are fully extended (but not hyperextended).',
      'Squeeze your quads hard at the top of the movement for a one-second hold.',
      'Lower the weight slowly under control — use a 2-3 second eccentric — stopping just before the weight stack touches.',
      'Exhale as you extend; keep your hips pressed into the seat and avoid lifting off the backrest.'
    ],
    common_mistakes: [
      'Using momentum to swing the weight up, which reduces quad activation and stresses the knee joint.',
      'Setting the shin pad too high on the shin, which creates unnecessary ankle joint stress.',
      'Locking out aggressively and hyperextending the knees at the top of the movement.'
    ],
    substitutes: ['Barbell Back Squat', 'Leg Press', 'Bulgarian Split Squat'],
    youtube_search_term: 'leg extension machine proper form'
  },

  'Seated Leg Curl': {
    name: 'Seated Leg Curl',
    primary_muscles: ['hamstrings'],
    secondary_muscles: ['calves'],
    form_cues: [
      'Sit in the machine with your back flat against the pad; adjust the lap pad snugly over your lower thighs and the ankle pad on the back of your lower shins.',
      'Start with legs fully extended, then curl your heels down and back toward the underside of the seat by contracting your hamstrings.',
      'Squeeze your hamstrings at the bottom of the curl for a one-second hold.',
      'Return the weight slowly to the starting position, stopping just before full extension to maintain tension.',
      'Exhale as you curl; grip the handles to keep your upper body stable and prevent your hips from lifting.'
    ],
    common_mistakes: [
      'Using a partial range of motion — not curling far enough or not extending fully between reps.',
      'Setting the ankle pad too high on the calves, which reduces hamstring leverage and effectiveness.',
      'Going too heavy and using a jerking motion to initiate the curl instead of a smooth contraction.'
    ],
    substitutes: ['Lying Leg Curl', 'Romanian Deadlift', 'Back Extension'],
    youtube_search_term: 'seated leg curl machine proper form'
  },

  'Hip Thrust': {
    name: 'Hip Thrust',
    primary_muscles: ['glutes'],
    secondary_muscles: ['hamstrings', 'quads', 'abs'],
    form_cues: [
      'Sit on the floor with your upper back (just below the shoulder blades) against a stable bench; roll a loaded barbell over your legs to your hip crease, using a pad for comfort.',
      'Place your feet flat on the floor about shoulder-width apart, positioned so that your shins are vertical at the top of the movement.',
      'Drive through your heels to lift your hips until your body forms a straight line from shoulders to knees — squeeze your glutes maximally at the top.',
      'Hold the lockout for a one-second squeeze, then lower your hips back down under control without fully resting on the floor between reps.',
      'Exhale as you thrust up; keep your chin tucked slightly (look forward, not at the ceiling) to maintain a neutral spine throughout.'
    ],
    common_mistakes: [
      'Hyperextending the lower back at the top instead of achieving full hip extension through glute contraction.',
      'Placing feet too far from the bench (hamstring-dominant) or too close (quad-dominant) instead of keeping shins vertical at lockout.',
      'Pushing through the toes instead of driving through the heels, which reduces glute activation.'
    ],
    substitutes: ['Barbell Back Squat', 'Bulgarian Split Squat', 'Glute Bridge'],
    youtube_search_term: 'barbell hip thrust proper form'
  },

  'Standing Calf Raise': {
    name: 'Standing Calf Raise',
    primary_muscles: ['calves'],
    secondary_muscles: [],
    form_cues: [
      'Stand on a calf raise machine or a raised surface (step/block) with the balls of your feet on the edge and your heels hanging off.',
      'Start by lowering your heels as far as comfortable below the platform to get a full stretch in the calves.',
      'Drive up onto the balls of your feet as high as possible, squeezing your calves hard at the peak contraction for a one-second hold.',
      'Lower your heels slowly back down under control (2-3 second eccentric) to the fully stretched position.',
      'Keep your knees straight (but not locked) to emphasize the gastrocnemius; exhale on the way up, inhale on the way down.'
    ],
    common_mistakes: [
      'Bouncing at the bottom by using the Achilles tendon stretch reflex instead of performing controlled reps.',
      'Using a partial range of motion — not lowering the heels fully or not rising all the way onto the toes.',
      'Bending the knees excessively, which shifts emphasis to the soleus and reduces gastrocnemius activation.'
    ],
    substitutes: ['Seated Calf Raise', 'Leg Press Calf Raise', 'Single-Leg Calf Raise'],
    youtube_search_term: 'standing calf raise proper form'
  },

  'Seated Calf Raise': {
    name: 'Seated Calf Raise',
    primary_muscles: ['calves'],
    secondary_muscles: [],
    form_cues: [
      'Sit in the seated calf raise machine with the pad resting snugly on your lower thighs (just above the knees); place the balls of your feet on the platform with heels hanging off.',
      'Release the safety lever and lower your heels as far as comfortable to achieve a full calf stretch.',
      'Press up by driving through the balls of your feet, squeezing your calves at the top for a one-second hold.',
      'Lower your heels back down slowly under control to the full stretch position — emphasize the 2-3 second eccentric.',
      'Exhale on the way up; keep your torso upright and avoid bouncing at the bottom of the rep.'
    ],
    common_mistakes: [
      'Using too short a range of motion — the seated calf raise requires a full stretch and full contraction for the soleus to grow.',
      'Bouncing the weight up by using the stretch reflex at the bottom instead of pausing briefly in the stretched position.',
      'Going too heavy and sacrificing range of motion — this is an isolation exercise that responds to controlled reps and time under tension.'
    ],
    substitutes: ['Standing Calf Raise', 'Leg Press Calf Raise', 'Single-Leg Calf Raise'],
    youtube_search_term: 'seated calf raise proper form'
  },
  'Chest Press Machine': {
    name: 'Chest Press Machine',
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps', 'front_delts'],
    form_cues: [
      'Adjust the seat so the handles are at mid-chest height; sit back with your shoulder blades pressed into the pad.',
      'Grip the handles and press forward until your arms are extended but not locked out.',
      'Lower the handles slowly back until you feel a stretch across your chest.',
      'Keep your feet flat on the floor and your back pressed into the pad throughout.',
      'Exhale as you press, inhale as you return; focus on squeezing the chest at full extension.'
    ],
    common_mistakes: [
      'Flaring the elbows too wide — keep them at roughly 45-60 degrees from the torso.',
      'Letting the shoulders roll forward off the pad during the press.',
      'Using momentum or bouncing the weight at the bottom of the rep.'
    ],
    substitutes: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Dips'],
    youtube_search_term: 'chest press machine proper form'
  },
  'Chest-Supported Row Machine': {
    name: 'Chest-Supported Row Machine',
    primary_muscles: ['upper_back', 'lats'],
    secondary_muscles: ['biceps', 'rear_delts'],
    form_cues: [
      'Sit or lean into the chest pad so your torso is fully supported; grip the handles with arms extended.',
      'Pull the handles toward your torso by driving your elbows back, squeezing your shoulder blades together.',
      'Hold the peak contraction for a one-second squeeze, keeping your chest pressed into the pad.',
      'Return the handles forward under control, letting your shoulder blades protract for a full stretch.',
      'Exhale as you pull; keep your head neutral and avoid lifting your chest off the pad.'
    ],
    common_mistakes: [
      'Lifting the chest off the pad to use body momentum.',
      'Shrugging the shoulders up instead of retracting the shoulder blades.',
      'Cutting the range of motion short — fully extend at the bottom for a lat stretch.'
    ],
    substitutes: ['Seated Cable Row', 'Barbell Row', 'Chest Supported Row'],
    youtube_search_term: 'chest supported row machine form'
  },
  'Shoulder Press Machine': {
    name: 'Shoulder Press Machine',
    primary_muscles: ['front_delts', 'side_delts'],
    secondary_muscles: ['triceps'],
    form_cues: [
      'Adjust the seat so the handles start at shoulder height; sit with your back flat against the pad.',
      'Grip the handles and press overhead until your arms are fully extended.',
      'Lower the handles back to shoulder height under control.',
      'Keep your feet flat on the floor and your core braced throughout.',
      'Exhale as you press up; avoid arching your lower back.'
    ],
    common_mistakes: [
      'Arching the lower back off the pad to cheat the weight up.',
      'Not pressing to full extension, cutting the range of motion short.',
      'Setting the seat too low, which forces the shoulders into an uncomfortable starting position.'
    ],
    substitutes: ['Standing Overhead Press', 'Seated Dumbbell Shoulder Press', 'Dumbbell Lateral Raise'],
    youtube_search_term: 'shoulder press machine proper form'
  },
  'Assisted Pull-Up Machine': {
    name: 'Assisted Pull-Up Machine',
    primary_muscles: ['lats', 'upper_back'],
    secondary_muscles: ['biceps', 'forearms', 'rear_delts'],
    form_cues: [
      'Select a counterweight that allows you to complete your target reps with good form.',
      'Kneel on the pad and grip the handles slightly wider than shoulder width.',
      'Pull yourself up by driving your elbows down and back, aiming to get your chin above the handles.',
      'Lower yourself under control to full arm extension, feeling a stretch in your lats.',
      'Exhale as you pull up; keep your core tight and avoid swinging.'
    ],
    common_mistakes: [
      'Using too much assistance — challenge yourself with a weight that makes the last 2 reps difficult.',
      'Not achieving full range of motion — go all the way down and all the way up.',
      'Kipping or swinging the body instead of using a controlled pull.'
    ],
    substitutes: ['Pull-Up', 'Lat Pulldown', 'Seated Cable Row'],
    youtube_search_term: 'assisted pull up machine proper form'
  },
  'Cable Lateral Raise': {
    name: 'Cable Lateral Raise',
    primary_muscles: ['side_delts'],
    secondary_muscles: ['traps'],
    form_cues: [
      'Set a cable pulley to the lowest position; stand sideways to the machine and grab the handle with the far hand.',
      'With a slight bend in your elbow, raise your arm out to the side until parallel with the floor.',
      'Hold briefly at the top, then lower under control.',
      'Keep your torso upright and avoid leaning away from the cable.',
      'Exhale as you raise; perform all reps on one side, then switch.'
    ],
    common_mistakes: [
      'Using too much weight and compensating with body lean or momentum.',
      'Raising the arm above shoulder height, which shifts tension to the traps.',
      'Standing too close to the machine, reducing the effective range of motion.'
    ],
    substitutes: ['Dumbbell Lateral Raise', 'Machine Lateral Raise'],
    youtube_search_term: 'cable lateral raise proper form'
  },
  'Hip Thrust Machine': {
    name: 'Hip Thrust Machine',
    primary_muscles: ['glutes'],
    secondary_muscles: ['hamstrings', 'quads'],
    form_cues: [
      'Sit in the machine with your upper back against the pad and feet flat on the platform.',
      'Drive through your heels to extend your hips until your body forms a straight line.',
      'Squeeze your glutes maximally at the top and hold for a one-second pause.',
      'Lower the weight under control.',
      'Keep your chin slightly tucked and avoid hyperextending your lower back.'
    ],
    common_mistakes: [
      'Hyperextending the lower back instead of achieving full hip extension through glute squeeze.',
      'Pushing through the toes instead of driving through the heels.',
      'Rushing the reps — use a controlled 2-second eccentric.'
    ],
    substitutes: ['Hip Thrust', 'Glute Bridge', 'Bulgarian Split Squat'],
    youtube_search_term: 'hip thrust machine proper form'
  },
  'Cable Pull-Through': {
    name: 'Cable Pull-Through',
    primary_muscles: ['glutes', 'hamstrings'],
    secondary_muscles: ['lower_back'],
    form_cues: [
      'Set a cable pulley to the lowest position with a rope attachment; straddle the cable facing away.',
      'Hinge at the hips, pushing them back while keeping a slight knee bend.',
      'Drive your hips forward explosively by squeezing your glutes, standing tall at the top.',
      'Keep your arms straight throughout — they are just hooks holding the rope.',
      'Exhale as you drive forward; keep your back flat and core braced.'
    ],
    common_mistakes: [
      'Squatting the movement instead of hinging — push the hips back, not the knees forward.',
      'Rounding the lower back during the hinge portion.',
      'Using the arms to pull the cable instead of driving with the glutes.'
    ],
    substitutes: ['Romanian Deadlift', 'Hip Thrust', 'Hip Thrust Machine'],
    youtube_search_term: 'cable pull through proper form'
  },
  'Smith Machine Bench Press': {
    name: 'Smith Machine Bench Press',
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps', 'front_delts'],
    form_cues: [
      'Position a flat bench centered under the Smith bar so that the bar lines up with your mid-chest when you lie down; retract and depress your shoulder blades against the bench to create a stable pressing shelf.',
      'Unrack the bar by rotating your wrists to release the hooks; set the safety catches one inch above your chest so you can bail safely without a spotter.',
      'Lower the bar in a controlled manner to your lower chest, keeping your elbows tucked at roughly 45-75 degrees from your torso — the fixed vertical path means you must position your body to match the bar, not the other way around.',
      'Press the bar straight up until your arms are fully extended, driving through your palms; exhale forcefully past the sticking point.',
      'Keep your feet flat on the floor, maintain a slight natural arch in your lower back, and re-rack by rotating the bar back into the hooks at the top.'
    ],
    common_mistakes: [
      'Not centering the bench under the bar, which forces an unnatural bar path and stresses the shoulders.',
      'Forgetting to set the safety catches, eliminating the key safety advantage of the Smith machine.',
      'Flaring the elbows to 90 degrees instead of tucking them, which puts excessive stress on the shoulder joint.'
    ],
    substitutes: ['Dumbbell Flat Press', 'Dips', 'Pec Deck'],
    youtube_search_term: 'smith machine bench press proper form',
    equipment_type: 'machine',
    required_equipment: ['smith_machine', 'flat_bench'],
  },
  'Smith Machine Romanian Deadlift': {
    name: 'Smith Machine Romanian Deadlift',
    primary_muscles: ['hamstrings', 'glutes'],
    secondary_muscles: ['lower_back'],
    form_cues: [
      'Stand close to the Smith bar with your feet hip-width apart and the bar touching your thighs; grip the bar just outside your hips with an overhand grip.',
      'Unrack by rotating the bar to release the hooks; the fixed vertical path eliminates the need to balance the bar, letting you focus entirely on the hip hinge pattern.',
      'Hinge at the hips by pushing them straight back while maintaining a slight bend in the knees (about 15-20 degrees), letting the bar skim down your thighs and shins.',
      'Lower until you feel a deep stretch in your hamstrings (typically mid-shin level), then drive your hips forward to return to standing, squeezing your glutes hard at the top.',
      'Set the safety catches just below knee height so you can bail if needed; keep your back flat and chest up throughout.'
    ],
    common_mistakes: [
      'Standing too far from the bar, which forces an awkward bar path and increases lower back stress.',
      'Bending the knees too much, turning the movement into a squat rather than a hip hinge.',
      'Rounding the lower back during the descent, which puts dangerous shear force on the lumbar spine.'
    ],
    substitutes: ['Romanian Deadlift', 'Back Extension', 'Cable Pull-Through'],
    youtube_search_term: 'smith machine romanian deadlift proper form',
    equipment_type: 'machine',
    required_equipment: ['smith_machine'],
  },
  'T-Bar Row': {
    name: 'T-Bar Row',
    primary_muscles: ['upper_back', 'lats'],
    secondary_muscles: ['biceps', 'rear_delts', 'lower_back'],
    form_cues: [
      'Position your chest against the pad (if the machine has one) with your feet on the foot plates shoulder-width apart; keep a slight bend in your knees and a flat back.',
      'Choose your grip — a narrow neutral grip emphasizes the lats and lower traps, while a wider grip targets the upper back and rear delts more.',
      'Pull the handles toward your lower chest by driving your elbows back and squeezing your shoulder blades together at the peak contraction.',
      'Lower the weight under control to full arm extension, allowing a stretch in the lats before initiating the next rep.',
      'Exhale as you row up, inhale as you lower; keep your torso angle consistent and avoid jerking the weight up with body momentum.'
    ],
    common_mistakes: [
      'Lifting the chest off the pad and using body momentum to heave the weight up, reducing back activation.',
      'Pulling too high toward the neck, which shifts tension to the traps instead of the lats and mid-back.',
      'Using a partial range of motion by not fully extending the arms at the bottom, missing the lat stretch.'
    ],
    substitutes: ['Seated Cable Row', 'Barbell Row', 'Lat Pulldown'],
    youtube_search_term: 't-bar row proper form',
    equipment_type: 'machine',
    required_equipment: ['t_bar_row'],
  },
  'Pec Deck': {
    name: 'Pec Deck',
    primary_muscles: ['chest'],
    secondary_muscles: ['front_delts'],
    form_cues: [
      'Adjust the seat height so the machine handles are at mid-chest level when your arms are extended to the sides; sit with your back flat against the pad.',
      'Place your forearms against the pads (or grip the handles) with your elbows slightly bent at about 10-20 degrees — maintain this elbow angle throughout.',
      'Bring the pads together in a controlled arc by squeezing your chest, focusing on driving with the pecs rather than pushing with the arms.',
      'Squeeze hard when the pads meet in front of your chest, holding the peak contraction for a one-second pause.',
      'Return to the starting position slowly under control, feeling a deep stretch across your chest — do not let the weight stack slam.'
    ],
    common_mistakes: [
      'Setting the seat too low or too high, which misaligns the movement arc with the chest and shifts stress to the shoulders.',
      'Straightening the arms fully and turning the fly into a pressing motion, which reduces chest isolation.',
      'Using too much weight and cutting the range of motion short, missing the stretch and squeeze that make this exercise effective.'
    ],
    substitutes: ['Cable Chest Fly', 'Incline Dumbbell Press', 'Dips'],
    youtube_search_term: 'pec deck machine proper form',
    equipment_type: 'machine',
    required_equipment: ['pec_deck'],
  },
  'Preacher Curl (EZ Bar)': {
    name: 'Preacher Curl (EZ Bar)',
    primary_muscles: ['biceps'],
    secondary_muscles: ['forearms'],
    form_cues: [
      'Adjust the preacher bench so your armpits rest at the top of the angled pad; sit or stand with your upper arms flat against the pad from armpit to elbow.',
      'Grip the EZ curl bar on the angled inner handles — the cambered grip reduces wrist strain compared to a straight bar.',
      'Curl the bar upward by contracting your biceps, keeping your elbows firmly pressed into the pad throughout the entire movement.',
      'Squeeze your biceps hard at the top, then lower the bar slowly under control to near-full extension — do not drop into a dead hang, which can hyperextend the elbow.',
      'Exhale as you curl up, inhale as you lower; keep your wrists neutral and avoid flexing them forward at the top.'
    ],
    common_mistakes: [
      'Lifting the elbows off the pad at the top of the curl, which recruits the front delts and reduces bicep isolation.',
      'Lowering the bar too fast or to full lockout with heavy weight, which puts dangerous stress on the elbow tendons.',
      'Leaning back or rocking the torso to generate momentum instead of isolating the biceps.'
    ],
    substitutes: ['Cable Bicep Curl', 'Dumbbell Hammer Curl'],
    youtube_search_term: 'preacher curl ez bar proper form',
    equipment_type: 'dumbbell',
    required_equipment: ['preacher_curl_bench', 'ez_curl_bar'],
  },
  'Back Extension': {
    name: 'Back Extension',
    primary_muscles: ['lower_back', 'glutes'],
    secondary_muscles: ['hamstrings'],
    form_cues: [
      'Position yourself on the back extension bench with the hip pad at your hip crease (not your waist) and your ankles locked securely under the foot pads.',
      'Cross your arms over your chest or place your hands behind your head; start with your torso hanging straight down, forming roughly a 90-degree angle at the hips.',
      'Raise your torso by extending at the hips and contracting your glutes and lower back, lifting until your body forms a straight line from head to heels.',
      'Squeeze your glutes hard at the top for a one-second hold — do not hyperextend past the straight-line position.',
      'Lower your torso back down under control with a 2-3 second eccentric; keep your core braced and neck neutral throughout.'
    ],
    common_mistakes: [
      'Placing the hip pad too high (at the waist), which limits range of motion and reduces glute engagement.',
      'Hyperextending the spine at the top by arching past a neutral straight-line position, which compresses the lumbar discs.',
      'Swinging the torso up with momentum instead of using a controlled contraction through the glutes and erectors.'
    ],
    substitutes: ['Smith Machine Romanian Deadlift', 'Romanian Deadlift', 'Cable Pull-Through'],
    youtube_search_term: 'back extension proper form',
    equipment_type: 'bodyweight',
    required_equipment: ['back_extension_bench'],
  },
  'Single-Leg Leg Press': {
    name: 'Single-Leg Leg Press',
    primary_muscles: ['quads', 'glutes'],
    secondary_muscles: ['hamstrings', 'adductors'],
    form_cues: [
      'Sit in the leg press machine with your back and hips flush against the pad; place one foot in the center of the platform at about shoulder height, and rest the other foot safely on the floor or the machine frame.',
      'Use significantly less weight than your bilateral leg press — start with roughly 40-50 percent of your two-leg weight to account for the single-leg demand.',
      'Release the safety handles and lower the platform by bending your working knee, descending in a controlled manner until your knee reaches about 90 degrees.',
      'Press the platform away by driving through your whole foot, focusing on even pressure across the heel and mid-foot — do not let your knee cave inward.',
      'Keep your lower back pressed firmly into the seat throughout; if your hip starts to tuck under at the bottom, reduce the depth slightly.'
    ],
    common_mistakes: [
      'Using the same weight as bilateral leg press, which compromises form and risks injury on the working leg.',
      'Letting the knee collapse inward (valgus) during the press, especially under fatigue — actively push the knee outward over the toes.',
      'Placing the foot too low on the platform, which puts excessive stress on the knee and reduces glute involvement.'
    ],
    substitutes: ['Bulgarian Split Squat', 'Leg Press', 'Smith Machine Squat'],
    youtube_search_term: 'single leg leg press proper form',
    equipment_type: 'machine',
    required_equipment: ['leg_press'],
  },
  'Goblet Squat': {
    name: 'Goblet Squat',
    primary_muscles: ['quads', 'glutes'],
    secondary_muscles: ['abs', 'upper_back'],
    form_cues: [
      'Hold a dumbbell vertically at chest height, cupping the top end with both hands close to your body; stand with feet shoulder-width apart and toes turned out 15-30 degrees.',
      'Brace your core and sit straight down between your hips by bending at the knees and hips simultaneously, keeping the dumbbell tight against your chest.',
      'Descend until your elbows touch or pass the inside of your knees (or as deep as mobility allows), keeping your chest up and back flat throughout.',
      'Drive up through your whole foot to return to standing, squeezing your glutes at the top; the front-loaded weight naturally keeps your torso upright.',
      'Exhale as you stand up; keep your knees tracking over your toes and avoid letting them cave inward.'
    ],
    common_mistakes: [
      'Letting the dumbbell drift away from the chest, which pulls the torso forward and rounds the upper back.',
      'Rising onto the toes during the descent, which shifts load to the knees and reduces stability — keep your heels grounded.',
      'Cutting depth short instead of sitting deep between the hips, which limits quad and glute activation.'
    ],
    substitutes: ['Smith Machine Squat', 'Leg Press', 'Bulgarian Split Squat'],
    youtube_search_term: 'goblet squat proper form',
    equipment_type: 'dumbbell',
    required_equipment: ['dumbbells'],
  },
  'Dumbbell Romanian Deadlift': {
    name: 'Dumbbell Romanian Deadlift',
    primary_muscles: ['hamstrings', 'glutes'],
    secondary_muscles: ['lower_back'],
    form_cues: [
      'Stand with feet hip-width apart, holding a dumbbell in each hand at your sides with palms facing your thighs; pull your shoulders back and down.',
      'Hinge at the hips by pushing them straight back while maintaining a slight bend in the knees (about 15-20 degrees), letting the dumbbells slide down the front of your legs.',
      'Lower until you feel a deep stretch in your hamstrings (typically mid-shin level), keeping the dumbbells close to your body throughout.',
      'Drive your hips forward to return to standing, squeezing your glutes hard at the top without hyperextending your lower back.',
      'Keep your back flat and chest up throughout; the dumbbells allow a slightly more natural arm position than a barbell, so let them hang naturally beside your thighs.'
    ],
    common_mistakes: [
      'Rounding the lower back during the descent, which puts dangerous shear force on the lumbar spine — maintain a flat back throughout.',
      'Letting the dumbbells drift away from the body, increasing the moment arm and overloading the lower back.',
      'Bending the knees too much, turning the hip hinge into a squat and reducing hamstring engagement.'
    ],
    substitutes: ['Romanian Deadlift', 'Lying Leg Curl', 'Back Extension'],
    youtube_search_term: 'dumbbell romanian deadlift proper form',
    equipment_type: 'dumbbell',
    required_equipment: ['dumbbells'],
  },
  'EZ Bar Curl': {
    name: 'EZ Bar Curl',
    primary_muscles: ['biceps'],
    secondary_muscles: ['forearms'],
    form_cues: [
      'Stand with feet shoulder-width apart, holding the EZ curl bar on the angled inner handles with an underhand grip — the cambered bar reduces wrist and forearm strain compared to a straight bar.',
      'Keep your elbows pinned to your sides throughout the movement; curl the bar upward by contracting your biceps.',
      'Squeeze your biceps hard at the top of the contraction, then lower the bar slowly under control (2-3 second eccentric) to full arm extension.',
      'Keep your torso upright and avoid swinging — if you need to rock your body or lean back, the weight is too heavy.',
      'Exhale as you curl up, inhale as you lower; maintain a neutral wrist position and let the angled grip do the work of reducing strain.'
    ],
    common_mistakes: [
      'Swinging the body and using momentum to cheat the bar up, which takes tension off the biceps.',
      'Allowing the elbows to drift forward during the curl, which recruits the front delts and reduces bicep isolation.',
      'Gripping the bar on the outer (wider) handles unintentionally, which changes the muscle emphasis and can feel less natural.'
    ],
    substitutes: ['Cable Bicep Curl', 'Preacher Curl (EZ Bar)', 'Dumbbell Hammer Curl'],
    youtube_search_term: 'ez bar curl proper form',
    equipment_type: 'dumbbell',
    required_equipment: ['ez_curl_bar'],
  }
};

export default EXERCISES;
