// Equipment catalog — shared source of truth for equipment keys, labels, and categories.
// Default: all available (most commercial gyms have everything).

const EQUIPMENT_CATALOG = [
  // Racks & bars
  { key: 'squat_rack', label: 'Squat rack / power rack', category: 'Racks & bars' },
  { key: 'smith_machine', label: 'Smith machine', category: 'Racks & bars' },
  { key: 'barbell', label: 'Barbell + plates', category: 'Racks & bars' },
  { key: 'ez_curl_bar', label: 'EZ curl bar', category: 'Racks & bars' },
  { key: 'dumbbells', label: 'Dumbbells', category: 'Racks & bars' },
  { key: 'flat_bench', label: 'Flat bench', category: 'Racks & bars' },
  { key: 'adjustable_bench', label: 'Adjustable/incline bench', category: 'Racks & bars' },

  // Lower body machines
  { key: 'leg_press', label: 'Leg press', category: 'Lower body machines' },
  { key: 'hack_squat_machine', label: 'Hack squat machine', category: 'Lower body machines' },
  { key: 'leg_extension', label: 'Leg extension', category: 'Lower body machines' },
  { key: 'lying_leg_curl', label: 'Lying leg curl', category: 'Lower body machines' },
  { key: 'seated_leg_curl', label: 'Seated leg curl', category: 'Lower body machines' },
  { key: 'standing_calf_raise_machine', label: 'Standing calf raise machine', category: 'Lower body machines' },
  { key: 'seated_calf_raise_machine', label: 'Seated calf raise machine', category: 'Lower body machines' },
  { key: 'hip_thrust_machine', label: 'Hip thrust machine', category: 'Lower body machines' },
  { key: 'glute_kickback_machine', label: 'Glute kickback machine', category: 'Lower body machines' },
  { key: 'back_extension_bench', label: 'Back extension bench (45\u00b0 hyperextension)', category: 'Lower body machines' },

  // Upper body machines
  { key: 'chest_press_machine', label: 'Chest press machine', category: 'Upper body machines' },
  { key: 'incline_chest_press_machine', label: 'Incline chest press machine', category: 'Upper body machines' },
  { key: 'pec_deck', label: 'Pec deck / chest fly machine', category: 'Upper body machines' },
  { key: 'shoulder_press_machine', label: 'Shoulder press machine', category: 'Upper body machines' },
  { key: 'lat_pulldown_machine', label: 'Lat pulldown', category: 'Upper body machines' },
  { key: 'seated_cable_row_machine', label: 'Seated cable row', category: 'Upper body machines' },
  { key: 'chest_supported_row_machine', label: 'Chest-supported row machine', category: 'Upper body machines' },
  { key: 't_bar_row', label: 'T-bar row', category: 'Upper body machines' },
  { key: 'assisted_pullup_machine', label: 'Assisted pull-up machine', category: 'Upper body machines' },
  { key: 'pull_up_bar', label: 'Pull-up bar', category: 'Upper body machines' },
  { key: 'dip_station', label: 'Dip station / assisted dip machine', category: 'Upper body machines' },
  { key: 'preacher_curl_bench', label: 'Preacher curl bench', category: 'Upper body machines' },

  // Cables & other
  { key: 'cable_crossover', label: 'Cable crossover / functional trainer', category: 'Cables & other' },
  { key: 'single_cable', label: 'Single cable station', category: 'Cables & other' },
  { key: 'rope_handle_attachments', label: 'Rope / handle attachments', category: 'Cables & other' },
  { key: 'treadmill', label: 'Treadmill', category: 'Cables & other' },
  { key: 'rowing_machine', label: 'Rowing machine', category: 'Cables & other' },
  { key: 'elliptical', label: 'Elliptical', category: 'Cables & other' },
  { key: 'stationary_bike', label: 'Stationary bike', category: 'Cables & other' },
  { key: 'stair_climber', label: 'Stair climber', category: 'Cables & other' },
];

const EQUIPMENT_CATEGORIES = [...new Set(EQUIPMENT_CATALOG.map(e => e.category))];

module.exports = { EQUIPMENT_CATALOG, EQUIPMENT_CATEGORIES };
