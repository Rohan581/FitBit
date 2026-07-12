const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');

// GET /api/suggestions?date=YYYY-MM-DD
// Returns top 3 food suggestions to close nutrient gaps
router.get('/', (req, res) => {
  const db = getDB();
  const date = req.query.date || todayIST();

  // Get goal targets
  const goal = db.prepare('SELECT * FROM goal WHERE id = 1').get();
  const calTarget = goal?.current_calorie_target || 2240;
  const proTarget = goal?.current_protein_target_g || 180;
  const fiberTarget = goal?.current_fiber_target_g || 32;

  // Get today's totals
  const logs = db.prepare('SELECT * FROM food_logs WHERE date = ?').all(date);
  const totals = logs.reduce((acc, l) => ({
    calories: acc.calories + l.calories,
    protein_g: acc.protein_g + l.protein_g,
    fiber_g: acc.fiber_g + (l.fiber_g || 0),
  }), { calories: 0, protein_g: 0, fiber_g: 0 });

  const remainingCal = calTarget - totals.calories;
  const proteinGap = proTarget - totals.protein_g;
  const fiberGap = fiberTarget - totals.fiber_g;

  // Check if it's past midday (2pm IST) or manual request (always return if asked)
  const now = new Date(Date.now() + 330 * 60000); // IST
  const hour = now.getUTCHours();
  const isPastMidDay = hour >= 14;

  // Determine which gap is larger (relative to target)
  const proteinPct = totals.protein_g / proTarget;
  const fiberPct = totals.fiber_g / fiberTarget;

  // Only suggest if meaningfully behind (< 60% of target after 2pm)
  const shouldSuggest = req.query.force === 'true' || (isPastMidDay && (proteinPct < 0.6 || fiberPct < 0.6));

  if (!shouldSuggest) {
    return res.json({ suggestions: [], reason: 'on_track' });
  }

  // If remaining calories very low, suggest light options
  if (remainingCal < 150) {
    return res.json({
      suggestions: [],
      reason: 'low_calories',
      message: "You're close to your calorie target — tomorrow's another chance to hit fiber/protein."
    });
  }

  // Determine primary gap
  const primaryGap = (proteinPct <= fiberPct) ? 'protein' : 'fiber';
  const gapAmount = primaryGap === 'protein' ? proteinGap : fiberGap;

  // Get candidate foods: favorites first, then frequently logged
  const favorites = db.prepare('SELECT * FROM foods WHERE is_favorite = 1').all();
  const frequentIds = db.prepare(`
    SELECT food_id, COUNT(*) as cnt FROM food_logs
    WHERE food_id IS NOT NULL
    GROUP BY food_id
    ORDER BY cnt DESC
    LIMIT 30
  `).all().map(r => r.food_id);

  const frequents = frequentIds.length > 0
    ? db.prepare(`SELECT * FROM foods WHERE id IN (${frequentIds.map(() => '?').join(',')})`)
        .all(...frequentIds)
    : [];

  // Also include all foods as fallback
  const allFoods = db.prepare('SELECT * FROM foods').all();

  // Deduplicate and prioritize
  const seen = new Set();
  const candidates = [];
  for (const food of [...favorites, ...frequents, ...allFoods]) {
    if (seen.has(food.id)) continue;
    seen.add(food.id);
    if (food.calories > remainingCal) continue; // skip if exceeds remaining calories
    if (food.calories <= 0) continue;
    candidates.push(food);
  }

  // Score by nutrient-per-calorie density for the gap nutrient
  const scored = candidates.map(food => {
    const nutrientPerCal = primaryGap === 'protein'
      ? food.protein_g / food.calories
      : (food.fiber_g || 0) / food.calories;

    // Bonus for favorites
    const favBonus = food.is_favorite ? 0.3 : 0;
    // Bonus for frequently logged
    const freqBonus = frequentIds.includes(food.id) ? 0.2 : 0;

    return { food, score: nutrientPerCal + favBonus + freqBonus };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top 3
  const suggestions = scored.slice(0, 3).map(({ food }) => {
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

  // Determine default meal type by time
  let defaultMeal = 'snack';
  if (hour < 11) defaultMeal = 'breakfast';
  else if (hour < 16) defaultMeal = 'lunch';
  else if (hour < 20) defaultMeal = 'snack';
  else defaultMeal = 'dinner';

  res.json({
    suggestions,
    primary_gap: primaryGap,
    gap_amount: Math.round(gapAmount),
    remaining_calories: Math.round(remainingCal),
    default_meal_type: defaultMeal,
    reason: 'gap_detected',
  });
});

module.exports = router;
