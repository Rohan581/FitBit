// Paste-to-log parser. Pure functions: no DOM, no database, no network, no AI.
//
//   Dinner | Chicken 65, half plate | 350 kcal | 21g P | 11g C | 23g F | 1g Fib
//
// The point of this module is that macro estimates arrive as text — from a chat,
// a message, a label photographed and typed out — and retyping six numbers into a
// form is the step that stops things getting logged at all. One paste, one review,
// one tap.
//
// Deliberately not an AI call. The format is fixed enough to parse with a regex,
// and a parser that runs offline in 1 ms beats one that needs a key, a network hop
// and a per-request cost.
//
// parseLog(text, opts) -> { results, entries, errors }
//   opts.now      Date (or an hour number 0-23) used to guess a missing meal. Default: now in IST.
//   opts.foods    known foods [{ id, name, calories, protein_g, ... }] for name-only shortcut lines
//
// Every entry: { food_name, meal_type, mealGuessed, calories, protein_g, carbs_g,
//                fat_g, fiber_g, sugar_g, source, food_id, warnings }
// A macro the line did not state comes back as null, meaning unknown — never 0.
// The caller decides what to do with unknown (the UI shows it blank and stores 0).

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'drinks'];

const MEAL_WORDS = {
  breakfast: 'breakfast', bf: 'breakfast', brekkie: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner', supper: 'dinner',
  snack: 'snack', snk: 'snack', snacks: 'snack',
  drink: 'drinks', drinks: 'drinks', beverage: 'drinks',
};

/** Meal guessed from the hour of day, for a line that does not name one. */
function guessMeal(hour) {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

const round1 = (x) => Math.round(x * 10) / 10;

function hourOf(now) {
  if (typeof now === 'number') return now;
  if (now instanceof Date) return now.getHours();
  // Default: the current hour in IST, matching the rest of the app's fixed timezone.
  return Number(
    new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).slice(0, 2)
  );
}

// ─── line clean-up ────────────────────────────────────────────────────────────
// Text pasted out of a chat arrives wrapped in markdown. Strip it rather than
// making the user tidy it up by hand.

const QUOTE_PAIRS = [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’']];

function cleanLine(line) {
  let s = line.replace(/`/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
  s = s.replace(/^[-–—•·]\s*/, '').trim();       // bullet
  s = s.replace(/^\d+[.)]\s+/, '').trim();        // "1. " or "1) "
  for (const [open, close] of QUOTE_PAIRS) {
    if (s.length >= 2 && s.startsWith(open) && s.endsWith(close)) { s = s.slice(1, -1).trim(); break; }
  }
  return s;
}

/** Split pasted text into candidate lines, dropping markdown noise and blanks. */
function cleanLines(text) {
  return String(text ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !/^`{3,}[\w-]*$/.test(l))      // ``` fence, with or without a language
    .filter((l) => !/^\|?\s*[-:|\s]+\|?$/.test(l)) // markdown table rule: |---|---|
    .map(cleanLine)
    .filter(Boolean);
}

// ─── nutrient fields ──────────────────────────────────────────────────────────
// Both orders are accepted ("32g P" and "Protein 32g") because different sources
// write it differently and the user should not have to care which.

const NUM = '(\\d+(?:\\.\\d+)?)';
const RANGE = `${NUM}(?:\\s*(?:-|–|—|to)\\s*${NUM})?`;
const LABEL = '(kcals?|calories|cals?|energy|protein|prot|p|carbohydrates|carbs?|c|fats?|f|fibre|fiber|fib|sugars?|sug|s)';
const NUMBER_FIRST = new RegExp(`^${RANGE}\\s*(?:g|gm|gms|grams?)?\\s*(?:of\\s+)?${LABEL}$`);
const LABEL_FIRST = new RegExp(`^${LABEL}\\s*[:=]?\\s*${RANGE}\\s*(?:g|gm|gms|grams?)?$`);

function labelKey(label) {
  if (/^(kcals?|calories|cals?|energy)$/.test(label)) return 'calories';
  if (/^(protein|prot|p)$/.test(label)) return 'protein_g';
  if (/^(carbohydrates|carbs?|c)$/.test(label)) return 'carbs_g';
  if (/^(fats?|f)$/.test(label)) return 'fat_g';
  if (/^(fibre|fiber|fib)$/.test(label)) return 'fiber_g';
  return 'sugar_g';
}

function midpoint(a, b) {
  const x = parseFloat(a);
  return b === undefined ? x : (x + parseFloat(b)) / 2;   // "500-560" logs as 530
}

/** {key, value} if this field is a nutrient, else null. */
function parseNutrientField(field) {
  const f = String(field)
    .toLowerCase()
    .replace(/[~≈]/g, '')
    .replace(/\b(?:approx|about|around|roughly)(?:imately|\.)?\b/g, '')
    .replace(/(\d),(\d{3})\b/g, '$1$2')      // 1,250 -> 1250
    .replace(/\s+/g, ' ')
    .trim();
  let m = f.match(NUMBER_FIRST);
  if (m) return { key: labelKey(m[3]), value: round1(midpoint(m[1], m[2])) };
  m = f.match(LABEL_FIRST);
  if (m) return { key: labelKey(m[1]), value: round1(midpoint(m[2], m[3])) };
  return null;
}

// ─── known-food shortcut ──────────────────────────────────────────────────────

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

function buildLookup(foods) {
  const map = new Map();
  for (const f of foods ?? []) if (f && f.name) map.set(norm(f.name), f);
  return map;
}

const numOrNull = (v) =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : round1(Number(v));

function foodEntry(food, meal, hour) {
  return {
    food_name: food.name,
    meal_type: meal || guessMeal(hour),
    mealGuessed: !meal,
    calories: numOrNull(food.calories),
    protein_g: numOrNull(food.protein_g),
    carbs_g: numOrNull(food.carbs_g),
    fat_g: numOrNull(food.fat_g),
    fiber_g: numOrNull(food.fiber_g),
    sugar_g: numOrNull(food.sugar_g),
    source: 'saved',
    food_id: food.id ?? null,
    warnings: [],
  };
}

// ─── one line ─────────────────────────────────────────────────────────────────

function parseLine(line, hour, lookup) {
  // A trailing "| 1g Fib |" from a markdown table leaves empty cells; drop them.
  const fields = line.split('|').map((s) => s.trim()).filter((s) => s !== '');
  if (!fields.length) return { error: 'empty line' };

  let meal = null;
  let rest = fields;
  const firstWord = norm(fields[0]).replace(/\s+/g, '-');
  if (MEAL_WORDS[firstWord]) { meal = MEAL_WORDS[firstWord]; rest = fields.slice(1); }

  // A line that is only the name of a food already saved logs that food.
  if (rest.length === 1 && !parseNutrientField(rest[0])) {
    const hit = lookup.get(norm(rest[0]));
    if (hit) return { entry: foodEntry(hit, meal, hour) };
  }

  const values = {};
  const warnings = [];
  let name = null;
  for (const f of rest) {
    const n = parseNutrientField(f);
    if (n) {
      if (n.key in values) warnings.push(`second ${n.key.replace('_g', '')} value ignored`);
      else values[n.key] = n.value;
    } else if (name === null) {
      name = f;
    } else {
      warnings.push(`ignored "${f}"`);
    }
  }

  // Calories are the one field with no sensible default. Protein is allowed to be
  // missing because plenty of things worth logging have none worth stating.
  if (values.calories === undefined) {
    return { error: name ? 'needs a calorie value' : 'not a log line' };
  }
  if (!name) return { error: 'needs a food name' };

  return {
    entry: {
      food_name: name,
      meal_type: meal || guessMeal(hour),
      mealGuessed: !meal,
      calories: values.calories,
      protein_g: values.protein_g ?? null,
      carbs_g: values.carbs_g ?? null,
      fat_g: values.fat_g ?? null,
      fiber_g: values.fiber_g ?? null,
      sugar_g: values.sugar_g ?? null,
      source: 'paste',
      food_id: null,
      warnings,
    },
  };
}

/**
 * Parse pasted text into reviewable entries.
 * One bad line never blocks the good ones — they come back in `errors` with the
 * raw text, so the user can see which line failed and why.
 */
function parseLog(text, opts = {}) {
  const hour = hourOf(opts.now);
  const lookup = buildLookup(opts.foods);
  const results = cleanLines(text).map((raw, i) => ({ line: i + 1, raw, ...parseLine(raw, hour, lookup) }));
  return {
    results,
    entries: results.filter((r) => r.entry).map((r) => r.entry),
    errors: results.filter((r) => r.error).map(({ line, raw, error }) => ({ line, raw, error })),
  };
}

module.exports = {
  parseLog,
  parseNutrientField,
  cleanLines,
  guessMeal,
  MEAL_TYPES,
};
