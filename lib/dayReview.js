// Day review: for each target, whether it was met and WHICH ITEMS caused it.
//
// Pure functions: no DOM, no database, no network, no AI.
//
// The dashboard already says "64 of 166 g protein". That tells you the score, not
// what to do about it. The useful sentence is "48 g short — the biryani and the
// thekua were 780 kcal between them and brought 14 g of protein", because that
// names the thing to change tomorrow. Everything here exists to turn a day's
// entries into that sentence.
//
// Two rules that matter:
//  - A day still in progress is never scored as a failure. Protein and fibre
//    below target read as "to go", not "short". Calories and sugar going over is
//    a fact at any hour, so those are flagged immediately.
//  - A day with nothing logged produces no notes. A blank day is not a failed day.

const FIELD = {
  calories: 'calories', protein: 'protein_g', carbs: 'carbs_g',
  fat: 'fat_g', fiber: 'fiber_g', sugar: 'sugar_g',
};

const LABEL = {
  calories: 'Calories', protein: 'Protein', carbs: 'Carbs',
  fat: 'Fat', fiber: 'Fibre', sugar: 'Sugar',
};

const MACROS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g'];

const n0 = (x) => Math.round(x).toLocaleString('en-IN');
const round1 = (x) => Math.round(x * 10) / 10;

/** Sum a day's entries. A missing macro counts as 0 but marks the day `partial`. */
function totalsFor(entries) {
  const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, count: 0, partial: false };
  for (const e of entries ?? []) {
    t.count++;
    for (const f of MACROS) {
      const v = e[f];
      if (v === null || v === undefined) t.partial = true;
      else t[f] += Number(v) || 0;
    }
  }
  for (const f of MACROS) t[f] = round1(t[f]);
  return t;
}

/** Targets in one shape, from the goal row. Sugar is a ceiling, the rest are floors or bands. */
function targetsFrom(goal = {}) {
  return {
    calories: goal.current_calorie_target ?? null,
    protein: goal.current_protein_target_g ?? null,
    carbs: goal.current_carb_target_g ?? null,
    fat: goal.current_fat_target_g ?? null,
    fiber: goal.current_fiber_target_g ?? null,
    sugar: goal.current_sugar_limit_g ?? null,
    calorie_band_pct: goal.calorie_band_pct ?? 10,
  };
}

/**
 * A day's entries ranked by one metric, each with its share of the day's total.
 * This is what a macro tile opens into: "who actually contributed this number".
 */
function contributors(entries, metric) {
  const f = FIELD[metric];
  const live = (entries ?? []).filter((e) => e[f] !== null && e[f] !== undefined);
  const total = live.reduce((a, e) => a + (Number(e[f]) || 0), 0);
  const rows = live
    .map((e) => ({ entry: e, value: round1(Number(e[f]) || 0), share: total > 0 ? (Number(e[f]) || 0) / total : 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  return { metric, total: round1(total), rows };
}

/**
 * 'good' | 'warn' | 'bad' | null for one metric against its target.
 *  calories: good inside the band (default ±10%), warn inside twice it, else bad
 *  protein / fibre: good at target, warn from 80% of it, else bad
 *  fat: good at or under target, warn to 15% over, else bad
 *  sugar: a hard limit — good at or under, warn to 20% over, else bad
 *  carbs: no rating; it is whatever is left after the others
 */
function rate(metric, value, t) {
  const target = t[metric];
  if (value === null || value === undefined || !target) return null;
  switch (metric) {
    case 'calories': {
      const dev = Math.abs(value - target) / target;
      const band = (t.calorie_band_pct ?? 10) / 100;
      return dev <= band ? 'good' : dev <= 2 * band ? 'warn' : 'bad';
    }
    case 'protein':
    case 'fiber':
      return value >= target ? 'good' : value >= 0.8 * target ? 'warn' : 'bad';
    case 'fat':
      return value <= target ? 'good' : value <= 1.15 * target ? 'warn' : 'bad';
    case 'sugar':
      return value <= target ? 'good' : value <= 1.2 * target ? 'warn' : 'bad';
    default:
      return null;
  }
}

const ORDER = { bad: 0, warn: 1, todo: 2, good: 3 };
const top = (entries, metric, k = 3) => contributors(entries, metric).rows.slice(0, k);

/**
 * Items that cost a lot of calories and brought little protein with them.
 * This is the single most useful list on a day that missed protein: it is not
 * "eat more chicken", it is "these three things were 40% of your day and did
 * nothing for you". The threshold — under 2.5 g protein per 100 kcal — puts rice,
 * sweets and fried sides on the list and keeps dal and curd off it.
 */
function emptyCalories(entries, totalKcal) {
  return (entries ?? [])
    .filter((e) => (e.calories ?? 0) >= 150 && e.protein_g !== null && e.protein_g !== undefined)
    .filter((e) => (e.protein_g / e.calories) * 100 < 2.5)
    .sort((a, b) => (b.calories ?? 0) - (a.calories ?? 0))
    .slice(0, 3)
    .map((e) => ({ entry: e, value: round1(e.calories), share: totalKcal > 0 ? e.calories / totalKcal : 0 }));
}

/**
 * Plain-English notes on one day, worst first.
 * Each: { metric, status, title, lead, items:[{entry,value,share}], valueMetric }
 *
 * `inProgress` (today) turns "short of target" into "to go".
 */
function dayReview(entries, goal, { inProgress = false } = {}) {
  const live = (entries ?? []).filter(Boolean);
  if (!live.length) return [];

  const t = targetsFrom(goal);
  const tot = totalsFor(live);
  const notes = [];

  // ── Calories ──
  if (t.calories) {
    const r = rate('calories', tot.calories, t);
    if (tot.calories > t.calories && r !== 'good') {
      notes.push({
        metric: 'calories', status: r,
        title: `${n0(tot.calories - t.calories)} kcal over your ${n0(t.calories)} target`,
        lead: 'Biggest calories', items: top(live, 'calories'), valueMetric: 'calories',
      });
    } else if (r === 'good') {
      notes.push({
        metric: 'calories', status: 'good',
        title: `Calories on target: ${n0(tot.calories)} of ${n0(t.calories)}`,
        lead: '', items: [], valueMetric: 'calories',
      });
    } else {
      notes.push({
        metric: 'calories', status: inProgress ? 'todo' : r,
        title: inProgress
          ? `${n0(t.calories - tot.calories)} kcal left today`
          : `${n0(t.calories - tot.calories)} kcal under your ${n0(t.calories)} target`,
        lead: '', items: [], valueMetric: 'calories',
      });
    }
  }

  // ── Protein ──
  if (t.protein) {
    const r = rate('protein', tot.protein_g, t);
    if (r === 'good') {
      notes.push({
        metric: 'protein', status: 'good',
        title: `Protein hit: ${n0(tot.protein_g)} g`,
        lead: 'Best sources', items: top(live, 'protein'), valueMetric: 'protein',
      });
    } else {
      const empties = emptyCalories(live, tot.calories);
      const short = t.protein - tot.protein_g;
      notes.push({
        metric: 'protein', status: inProgress ? 'todo' : r,
        title: inProgress
          ? `${n0(short)} g protein to go`
          : `${n0(short)} g short of your ${n0(t.protein)} g protein target`,
        lead: empties.length ? 'Calories that brought little protein' : 'Protein came from',
        items: empties.length ? empties : top(live, 'protein'),
        valueMetric: empties.length ? 'calories' : 'protein',
      });
    }
  }

  // ── Fat ──
  if (t.fat) {
    const r = rate('fat', tot.fat_g, t);
    if (r !== 'good') {
      notes.push({
        metric: 'fat', status: r,
        title: `${n0(tot.fat_g - t.fat)} g over your ${n0(t.fat)} g fat target`,
        lead: 'Most fat came from', items: top(live, 'fat'), valueMetric: 'fat',
      });
    } else {
      notes.push({
        metric: 'fat', status: 'good',
        title: `Fat within target: ${n0(tot.fat_g)} of ${n0(t.fat)} g`,
        lead: '', items: [], valueMetric: 'fat',
      });
    }
  }

  // ── Sugar: a ceiling, so being over is worth naming the culprit for at any hour ──
  if (t.sugar) {
    const r = rate('sugar', tot.sugar_g, t);
    if (r !== 'good') {
      notes.push({
        metric: 'sugar', status: r,
        title: `${n0(tot.sugar_g - t.sugar)} g over your ${n0(t.sugar)} g sugar limit`,
        lead: 'Most sugar came from', items: top(live, 'sugar'), valueMetric: 'sugar',
      });
    }
  }

  // ── Fibre ──
  if (t.fiber) {
    const r = rate('fiber', tot.fiber_g, t);
    if (r === 'good') {
      notes.push({
        metric: 'fiber', status: 'good',
        title: `Fibre target met: ${n0(tot.fiber_g)} g`,
        lead: '', items: [], valueMetric: 'fiber',
      });
    } else {
      notes.push({
        metric: 'fiber', status: inProgress ? 'todo' : r,
        title: inProgress
          ? `${n0(t.fiber - tot.fiber_g)} g fibre to go`
          : `${n0(t.fiber - tot.fiber_g)} g short of your ${n0(t.fiber)} g fibre target`,
        lead: '', items: [], valueMetric: 'fiber',
      });
    }
  }

  return notes
    .map((note, i) => ({ ...note, i }))
    .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.i - b.i);
}

/** One-line verdict for the card header. */
function dayVerdict(notes) {
  if (!notes.length) return { status: 'todo', text: 'Nothing logged' };
  const bad = notes.filter((n) => n.status === 'bad').length;
  const warn = notes.filter((n) => n.status === 'warn').length;
  if (bad) return { status: 'bad', text: `${bad} target${bad > 1 ? 's' : ''} missed` };
  if (warn) return { status: 'warn', text: `${warn} close call${warn > 1 ? 's' : ''}` };
  if (notes.some((n) => n.status === 'todo')) return { status: 'todo', text: 'In progress' };
  return { status: 'good', text: 'All targets met' };
}

module.exports = { dayReview, dayVerdict, contributors, totalsFor, targetsFrom, rate, FIELD, LABEL };
