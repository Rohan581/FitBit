const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST, daysAgoIST, getMondayIST } = require('../dateUtils');

// Deterministic swap alternatives: source_seed_key -> target_seed_key
// Each entry maps a higher-calorie protein to a leaner alternative
const SWAP_ALTERNATIVES = {
  'chicken_thigh_cooked_skinless': 'chicken_breast_grilled',
  'chicken_thigh_air_fried_skinless': 'chicken_breast_air_fried_minimal_oil',
  'paneer_regular': 'paneer_low_fat',
  'paneer_curry': 'paneer_tikka_air_fried',
  'plain_omelette_2_eggs': 'egg_whites',
  'boiled_eggs': 'egg_whites',
  'chicken_curry_home_style': 'chicken_breast_curry_home_style',
  'prawn_masala_fry': 'prawns_air_fried_light_oil',
  'prawn_curry_home_style': 'prawns_air_fried_light_oil',
  'steamed_rice': 'brown_rice_steamed',
  'fried_chicken': 'chicken_breast_air_fried_minimal_oil',
  'fish_curry_home_style': 'basa_fillet_air_fried_grilled',
  'butter_chicken': 'chicken_breast_curry_home_style',
};

// Volume foods for calorie headroom suggestions (low calorie density)
const VOLUME_FOOD_KEYS = [
  'cabbage_raw_steamed', 'carrot_raw', 'capsicum_bell_pepper',
  'broccoli_steamed', 'cauliflower_steamed', 'spinach_cooked',
  'green_beans_steamed', 'mixed_salad_cucumber_tomato_onion_lemon',
  'watermelon', 'papaya', 'popcorn_air_popped', 'makhana_roasted_light_oil',
  'cucumber', 'raita_curd_cucumber',
];

// Cooking fat seed keys for detection
const COOKING_FAT_KEYS = [
  'olive_oil', 'ghee', 'refined_vegetable_oil', 'butter',
];

// Home-cooked curry/fry keywords that imply cooking oil
const CURRY_KEYWORDS = ['curry', 'masala', 'fry', 'sabzi', 'bhaji', 'paratha', 'keema', 'tikka'];

function toSeedKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// GET /api/suggestions?date=YYYY-MM-DD
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();
  const force = req.query.force === 'true';

  // Get goal targets
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const calTarget = goal?.current_calorie_target || 2240;
  const proTarget = goal?.current_protein_target_g || 180;
  const fiberTarget = goal?.current_fiber_target_g || 32;

  // Get today's logs and totals
  const logs = db.prepare('SELECT * FROM food_logs WHERE date = ?').all(date);
  const totals = logs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein_g: acc.protein_g + l.protein_g,
    fiber_g: acc.fiber_g + (l.fiber_g || 0),
  }), { calories: 0, protein_g: 0, fiber_g: 0 });

  const remainingCal = calTarget - totals.calories;
  const proteinGap = proTarget - totals.protein_g;
  const fiberGap = fiberTarget - totals.fiber_g;

  // Time check (2pm IST)
  const now = new Date(Date.now() + 330 * 60000);
  const hour = now.getUTCHours();
  const isPastMidDay = hour >= 14;

  // Determine default meal type
  let defaultMeal = 'snack';
  if (hour < 11) defaultMeal = 'breakfast';
  else if (hour < 16) defaultMeal = 'lunch';
  else if (hour < 20) defaultMeal = 'snack';
  else defaultMeal = 'dinner';

  // Run all suggestion types and collect cards
  const cards = [];

  // --- Type D: Over-target soft landing (always takes priority) ---
  if (totals.calories > calTarget) {
    const weeklyAvgInfo = getWeeklyCalorieAvg(db, date, calTarget);
    cards.push({
      type: 'over_target',
      priority: 100,
      title: 'Above target today',
      message: weeklyAvgInfo.message,
      color: 'var(--text-3)',
    });
    // Type D suppresses all food suggestions
    return res.json({
      cards: cards.slice(0, 2),
      default_meal_type: defaultMeal,
      remaining_calories: Math.round(remainingCal),
    });
  }

  // Only generate food suggestions after 2pm or if forced
  const shouldSuggest = force || isPastMidDay;

  if (shouldSuggest) {
    // --- Type A: Protein-efficient swaps ---
    const swapCard = generateSwapSuggestion(db, logs, date);
    if (swapCard) cards.push(swapCard);

    // --- Type B: Nutrient gap closers ---
    const gapCard = generateGapSuggestion(db, totals, calTarget, proTarget, fiberTarget, remainingCal);
    if (gapCard) cards.push(gapCard);

    // --- Type C: Calorie headroom ---
    if (remainingCal > 200 && proteinGap <= 10) {
      const headroomCard = generateHeadroomSuggestion(db, remainingCal);
      if (headroomCard) cards.push(headroomCard);
    }
  }

  // --- Type E: Hidden cooking fat prompt (max 2x per week) ---
  if (shouldSuggest) {
    const fatCard = generateCookingFatPrompt(db, logs, date);
    if (fatCard) cards.push(fatCard);
  }

  // Sort by priority descending, take top 2
  cards.sort((a, b) => b.priority - a.priority);

  // Also include legacy-compatible fields for existing UI
  const topCards = cards.slice(0, 2);

  // Build legacy-compatible response alongside new cards
  const legacySuggestions = [];
  const legacyGapCard = topCards.find(c => c.type === 'gap' && c.suggestions);
  if (legacyGapCard) {
    legacySuggestions.push(...legacyGapCard.suggestions);
  }

  res.json({
    cards: topCards,
    // Legacy compatibility
    suggestions: legacySuggestions,
    primary_gap: legacyGapCard?.primary_gap || null,
    gap_amount: legacyGapCard?.gap_amount || 0,
    remaining_calories: Math.round(remainingCal),
    default_meal_type: defaultMeal,
    reason: topCards.length > 0 ? 'gap_detected' : (shouldSuggest ? 'on_track' : 'on_track'),
  });
});

function getWeeklyCalorieAvg(db, date, calTarget) {
  const monday = getMondayIST(date);
  const days = [];
  const d = new Date(monday + 'T12:00:00Z');
  const todayDate = new Date(date + 'T12:00:00Z');
  while (d <= todayDate) {
    days.push(d.toISOString().split('T')[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const weekLogs = db.prepare(`
    SELECT date, SUM(calories) as total FROM food_logs
    WHERE date >= ? AND date <= ? GROUP BY date
  `).all(monday, date);

  const weekMap = {};
  weekLogs.forEach(l => { weekMap[l.date] = l.total; });
  const loggedDays = days.filter(d => weekMap[d] !== undefined);
  const weekAvg = loggedDays.length > 0
    ? Math.round(loggedDays.reduce((s, d) => s + (weekMap[d] || 0), 0) / loggedDays.length)
    : 0;

  const diff = weekAvg - calTarget;
  if (diff > 100) {
    return { message: `This week's daily average is ${weekAvg} kcal (${Math.abs(Math.round(diff))} above the ${Math.round(calTarget)} target). The weekly average is what matters — one day above target is normal.` };
  }
  return { message: `Today is above target, but the weekly average (${weekAvg} kcal/day) is close to the ${Math.round(calTarget)} target. One day above is normal.` };
}

function generateSwapSuggestion(db, logs, date) {
  // Look at today's logged foods and check for swap opportunities
  const loggedFoodIds = logs.filter(l => l.food_id).map(l => l.food_id);
  if (loggedFoodIds.length === 0) return null;

  const foods = loggedFoodIds.length > 0
    ? db.prepare(`SELECT * FROM foods WHERE id IN (${loggedFoodIds.map(() => '?').join(',')})`).all(...loggedFoodIds)
    : [];

  for (const food of foods) {
    const sourceKey = food.seed_key || toSeedKey(food.name);
    const targetKey = SWAP_ALTERNATIVES[sourceKey];
    if (!targetKey) continue;

    const target = db.prepare('SELECT * FROM foods WHERE seed_key = ?').get(targetKey);
    if (!target) continue;

    // Find the log entry for this food to get quantity
    const logEntry = logs.find(l => l.food_id === food.id);
    if (!logEntry) continue;

    const qty = logEntry.quantity || 1;
    const unitMultiplier = (() => {
      if (!logEntry.unit_used || !food.units) return 1;
      const units = JSON.parse(food.units);
      const u = units.find(u => u.unit === logEntry.unit_used);
      return u ? u.multiplier : 1;
    })();
    const effectiveQty = qty * unitMultiplier;

    const sourceCal = Math.round(food.calories * effectiveQty);
    const sourcePro = Math.round(food.protein_g * effectiveQty);

    // Find equivalent quantity of target for same protein
    if (target.protein_g <= 0) continue;
    const targetQtyForSameProtein = sourcePro / target.protein_g;
    const targetCal = Math.round(target.calories * targetQtyForSameProtein);
    const calSaved = sourceCal - targetCal;

    if (calSaved >= 100) {
      return {
        type: 'swap',
        priority: 70 + Math.min(calSaved / 10, 20), // Higher savings = higher priority
        title: 'Protein-efficient swap',
        message: `Swap ${food.name} for ${target.name}: same ${sourcePro}g protein, saves ${calSaved} kcal.`,
        swap: {
          from: food.name,
          to: target.name,
          protein: sourcePro,
          calories_saved: calSaved,
        },
        color: 'var(--protein)',
      };
    }
  }

  return null;
}

function generateGapSuggestion(db, totals, calTarget, proTarget, fiberTarget, remainingCal) {
  if (remainingCal < 150) return null;

  const proteinPct = totals.protein_g / proTarget;
  const fiberPct = totals.fiber_g / fiberTarget;

  // Only suggest if meaningfully behind (< 70% of target)
  if (proteinPct >= 0.7 && fiberPct >= 0.7) return null;

  const primaryGap = proteinPct <= fiberPct ? 'protein' : 'fiber';
  const gapAmount = primaryGap === 'protein' ? (proTarget - totals.protein_g) : (fiberTarget - totals.fiber_g);

  // Get candidates
  const favorites = db.prepare('SELECT * FROM foods WHERE is_favorite = 1').all();
  const frequentIds = db.prepare(`
    SELECT food_id, COUNT(*) as cnt FROM food_logs
    WHERE food_id IS NOT NULL GROUP BY food_id ORDER BY cnt DESC LIMIT 30
  `).all().map(r => r.food_id);

  const frequents = frequentIds.length > 0
    ? db.prepare(`SELECT * FROM foods WHERE id IN (${frequentIds.map(() => '?').join(',')})`).all(...frequentIds)
    : [];

  const allFoods = db.prepare('SELECT * FROM foods').all();

  const seen = new Set();
  const candidates = [];
  for (const food of [...favorites, ...frequents, ...allFoods]) {
    if (seen.has(food.id)) continue;
    seen.add(food.id);
    if (food.calories > remainingCal || food.calories <= 0) continue;
    candidates.push(food);
  }

  const scored = candidates.map(food => {
    const nutrientPerCal = primaryGap === 'protein'
      ? food.protein_g / food.calories
      : (food.fiber_g || 0) / food.calories;
    const favBonus = food.is_favorite ? 0.3 : 0;
    const freqBonus = frequentIds.includes(food.id) ? 0.2 : 0;
    return { food, score: nutrientPerCal + favBonus + freqBonus };
  });

  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);
  if (top3.length === 0) return null;

  const suggestions = top3.map(({ food }) => {
    const nutrient = primaryGap === 'protein'
      ? `+${Math.round(food.protein_g)}g protein`
      : `+${Math.round(food.fiber_g || 0)}g fiber`;
    return {
      food_id: food.id,
      food_name: food.name,
      serving_unit: food.serving_unit,
      calories: Math.round(food.calories),
      nutrient_highlight: nutrient,
      description: `${food.serving_unit} · ${nutrient} · ${Math.round(food.calories)} kcal`,
    };
  });

  return {
    type: 'gap',
    priority: 60 + Math.round(gapAmount / 5),
    title: `Close the ${primaryGap} gap`,
    message: `${Math.round(gapAmount)}g ${primaryGap} remaining within ${Math.round(remainingCal)} kcal.`,
    suggestions,
    primary_gap: primaryGap,
    gap_amount: Math.round(gapAmount),
    color: primaryGap === 'protein' ? 'var(--protein)' : 'var(--fiber)',
  };
}

function generateHeadroomSuggestion(db, remainingCal) {
  // Suggest satisfying low-density foods
  const volumeFoods = db.prepare(
    `SELECT * FROM foods WHERE seed_key IN (${VOLUME_FOOD_KEYS.map(() => '?').join(',')}) AND calories <= ?`
  ).all(...VOLUME_FOOD_KEYS, remainingCal);

  if (volumeFoods.length === 0) return null;

  // Sort by calories per serving (lowest first = most volume per calorie)
  volumeFoods.sort((a, b) => a.calories - b.calories);
  const picks = volumeFoods.slice(0, 3);

  const suggestions = picks.map(food => ({
    food_id: food.id,
    food_name: food.name,
    serving_unit: food.serving_unit,
    calories: Math.round(food.calories),
    nutrient_highlight: `${Math.round(food.fiber_g || 0)}g fiber`,
    description: `${food.serving_unit} · ${Math.round(food.calories)} kcal`,
  }));

  return {
    type: 'headroom',
    priority: 40,
    title: 'Calories to spare',
    message: `${Math.round(remainingCal)} kcal remaining and protein is met. Some satisfying options:`,
    suggestions,
    color: 'var(--fiber)',
  };
}

function generateCookingFatPrompt(db, logs, date) {
  // Check if today has home-cooked curry/fry entries but no cooking oil logged
  const hasCurry = logs.some(l => {
    const name = (l.food_name || '').toLowerCase();
    return CURRY_KEYWORDS.some(kw => name.includes(kw));
  });

  if (!hasCurry) return null;

  // Check if cooking oil/fat is already logged today
  const hasOilLogged = logs.some(l => {
    const key = toSeedKey(l.food_name || '');
    return COOKING_FAT_KEYS.includes(key);
  });

  if (hasOilLogged) return null;

  // Rate limit: at most 2x per week. Check how many times we showed this recently.
  // Use a simple heuristic: check if oil was logged in the last 3 days (means we already prompted)
  const threeDaysAgo = daysAgoIST(3);
  const recentOilLogs = db.prepare(`
    SELECT COUNT(*) as cnt FROM food_logs
    WHERE date >= ? AND date < ? AND (
      food_name LIKE '%oil%' OR food_name LIKE '%ghee%' OR food_name LIKE '%butter%'
    )
  `).get(threeDaysAgo, date);

  // If oil was logged recently (after a prompt), skip for a few days
  if (recentOilLogs.cnt >= 2) return null;

  return {
    type: 'cooking_fat',
    priority: 30,
    title: 'Cooking oil check',
    message: 'Curries logged without cooking oil — a typical home curry carries 10-15g oil (90-135 kcal). Add it for accuracy?',
    color: 'var(--fat)',
    action: 'add_oil',
  };
}

module.exports = router;
