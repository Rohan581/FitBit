import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Sheet from '../components/Sheet';
import { SidebarTrigger } from '../components/Sidebar';

/* ── constants ─────────────────────────────────────────── */

const MACROS = [
  { key: 'calories', label: 'kcal', color: '--cal' },
  { key: 'protein_g', label: 'protein', color: '--protein' },
  { key: 'carbs_g', label: 'carbs', color: '--carbs' },
  { key: 'fat_g', label: 'fat', color: '--fat' },
  { key: 'fiber_g', label: 'fibre', color: '--fiber' },
  { key: 'sugar_g', label: 'sugar', color: '--sugar' },
];

const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner', 'drinks'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner', drinks: 'Drinks' };
const MEAL_COLORS = {
  breakfast: 'var(--breakfast)',
  lunch: 'var(--lunch)',
  snack: 'var(--snack)',
  dinner: 'var(--dinner)',
  drinks: 'var(--drinks)',
};

const TAG_OPTIONS = [
  'high-protein', 'low-carb', 'meal-prep', 'quick', 'vegetarian',
  'vegan', 'dairy-free', 'gluten-free', 'breakfast', 'lunch',
  'dinner', 'snack', 'dessert', 'drink', 'sauce',
];

const UNIT_OPTIONS = ['g', 'tsp', 'tbsp', 'cup', 'count', 'pinch'];

/* ── fraction display ──────────────────────────────────── */

const FRACS = {
  0.125: '\u215B', 0.25: '\u00BC', 0.333: '\u2153', 0.375: '\u215C',
  0.5: '\u00BD', 0.625: '\u215D', 0.667: '\u2154', 0.75: '\u00BE', 0.875: '\u215E',
};

function toFraction(val) {
  const whole = Math.floor(val);
  const frac = val - whole;
  let bestKey = null;
  let bestDist = Infinity;
  for (const k of Object.keys(FRACS)) {
    const d = Math.abs(frac - Number(k));
    if (d < bestDist) { bestDist = d; bestKey = k; }
  }
  if (bestDist > 0.06) {
    return whole > 0 ? String(whole) : '0';
  }
  const fracChar = FRACS[bestKey];
  return whole > 0 ? `${whole}${fracChar}` : fracChar;
}

/* ── formatQuantity ────────────────────────────────────── */

function formatQuantity(amount, unit, ingredientName) {
  if (!unit || !amount) return '';
  const u = unit.toLowerCase();
  const name = (ingredientName || '').toLowerCase();

  if (u === 'pinch') return 'a pinch';

  if (u === 'g') {
    const rounded = Math.round(amount / 5) * 5;
    return `${Math.max(5, rounded)}g`;
  }

  if (u === 'count') {
    const isEgg = /\begg\b/.test(name) || /\begg white/.test(name);
    const rounded = isEgg ? Math.round(amount) : Math.round(amount * 2) / 2;
    const display = rounded % 1 === 0 ? String(rounded) : toFraction(rounded);
    return display;
  }

  // tsp / tbsp / cup — round to nearest 1/8, then convert upward
  let tsp = amount;
  if (u === 'tbsp') tsp = amount * 3;
  else if (u === 'cup') tsp = amount * 48;
  else tsp = amount; // already tsp

  // round to nearest 1/8 tsp
  tsp = Math.round(tsp * 8) / 8;

  // convert up: 48 tsp → 1 cup, 3 tsp → 1 tbsp
  if (tsp >= 48) {
    const cups = tsp / 48;
    return `${toFraction(cups)} cup${cups > 1 ? 's' : ''}`;
  }
  if (tsp >= 3) {
    const tbsp = tsp / 3;
    return `${toFraction(tbsp)} tbsp`;
  }
  return `${toFraction(tsp)} tsp`;
}

/* ── rounding helpers ─────────────────────────────────── */

function roundCal(v) { return Math.round(v / 5) * 5; }
function roundMacro(v) { return Math.round(v); }
function roundGrams5(v) { return Math.round(v / 5) * 5; }

/* ── time helpers ──────────────────────────────────────── */

function getMealTypeByTime() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}

function formatTimer(seconds) {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return m > 0 ? `${m} min` : `${seconds}s`;
}

/* ── Stepper component ─────────────────────────────────── */

function Stepper({ value, onChange, min = 0, step = 1, label }) {
  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm text-tx-2 mr-1">{label}</span>}
      <button
        className="w-8 h-8 rounded-full bg-card-2 flex items-center justify-center text-tx press-scale text-lg font-semibold"
        onClick={() => onChange(Math.max(min, +(value - step).toFixed(4)))}
      >
        &minus;
      </button>
      <span className="font-num text-tx min-w-[2rem] text-center">{value % 1 === 0 ? value : value.toFixed(1)}</span>
      <button
        className="w-8 h-8 rounded-full bg-card-2 flex items-center justify-center text-tx press-scale text-lg font-semibold"
        onClick={() => onChange(+(value + step).toFixed(4))}
      >
        +
      </button>
    </div>
  );
}

/* ── MacroGrid ─────────────────────────────────────────── */

function MacroGrid({ macros }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MACROS.map(m => {
        const val = macros[m.key] ?? 0;
        return (
          <div
            key={m.key}
            className="rounded-[10px] px-3 py-2"
            style={{ background: `color-mix(in oklab, var(${m.color}) 12%, transparent)`, borderLeft: `3px solid var(${m.color})` }}
          >
            <div className="font-num text-sm font-semibold text-tx">{Math.round(val)}{m.key !== 'calories' ? 'g' : ''}</div>
            <div className="text-[11px] text-tx-2">{m.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   LogPortionSheet
   ══════════════════════════════════════════════════════════ */

function LogPortionSheet({ open, onClose, recipe, scaleFactor, people, perPersonGrams }) {
  const [mode, setMode] = useState('servings'); // 'servings' | 'grams'
  const [servingsVal, setServingsVal] = useState(1);
  const [gramsVal, setGramsVal] = useState(100);
  const [mealType, setMealType] = useState(getMealTypeByTime);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (open) {
      setServingsVal(1);
      setGramsVal(perPersonGrams || 100);
      setMealType(getMealTypeByTime());
      setToast(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!recipe) return null;

  const ps = recipe.per_serving || {};
  const totalBatch = {};
  MACROS.forEach(m => { totalBatch[m.key] = (ps[m.key] || 0) * (recipe.servings || 1) * scaleFactor; });

  const portionMacros = {};
  if (mode === 'servings') {
    // 1 serving = 1 person's share = totalBatch / people
    MACROS.forEach(m => {
      const v = people > 0 ? (totalBatch[m.key] / people) * servingsVal : 0;
      portionMacros[m.key] = m.key === 'calories' ? roundCal(v) : roundMacro(v);
    });
  } else {
    const yieldG = (recipe.cooked_yield_g || 500) * scaleFactor;
    MACROS.forEach(m => {
      const v = yieldG > 0 ? (totalBatch[m.key] / yieldG) * gramsVal : 0;
      portionMacros[m.key] = m.key === 'calories' ? roundCal(v) : roundMacro(v);
    });
  }

  async function handleLog() {
    setSaving(true);
    try {
      const body = {
        recipe_id: recipe.id,
        meal_type: mealType,
        ...(mode === 'servings' ? { servings: servingsVal } : { grams: gramsVal }),
      };
      await api.logPortion(body);
      const msg = `Added to ${MEAL_LABELS[mealType]} \u00B7 ${Math.round(portionMacros.calories)} kcal \u00B7 ${Math.round(portionMacros.protein_g)}g protein`;
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => { setToast(null); onClose(); }, 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log a portion" height="tall">
      <div className="px-5 pb-4 space-y-5">
        {/* Mode toggle */}
        <div className="flex gap-2">
          {['servings', 'grams'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === m ? 'bg-card-2 text-tx' : 'text-tx-3'}`}
            >
              {m === 'servings' ? 'Servings' : 'Grams'}
            </button>
          ))}
        </div>

        {mode === 'servings' ? (
          <Stepper value={servingsVal} onChange={setServingsVal} min={0.5} step={0.5} label="Portions" />
        ) : (
          <div className="flex items-center gap-2">
            <label className="text-sm text-tx-2">Grams</label>
            <input
              type="number"
              value={gramsVal}
              onChange={e => setGramsVal(Math.max(0, +e.target.value))}
              className="w-24 px-3 py-1.5 rounded-lg bg-card-2 text-tx font-num text-center border border-hair"
            />
          </div>
        )}

        {/* Macro preview */}
        <MacroGrid macros={portionMacros} />

        {/* Meal picker */}
        <div>
          <p className="text-xs text-tx-3 mb-2">Meal</p>
          <div className="flex gap-2 flex-wrap">
            {MEAL_TYPES.map(mt => (
              <button
                key={mt}
                onClick={() => setMealType(mt)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: mealType === mt ? MEAL_COLORS[mt] : undefined,
                  color: mealType === mt ? 'var(--on-accent)' : undefined,
                }}
              >
                {MEAL_LABELS[mt]}
              </button>
            ))}
          </div>
        </div>

        {/* Log button */}
        <button
          onClick={handleLog}
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-sm press-scale"
          style={{ background: MEAL_COLORS[mealType], color: 'var(--on-accent)' }}
        >
          {saving ? 'Adding...' : `Add to ${MEAL_LABELS[mealType]}`}
        </button>

        {/* Toast */}
        {toast && (
          <div className="rounded-xl bg-card-2 px-4 py-3 text-sm text-tx flex items-center justify-between">
            <span>{toast}</span>
            <a href="/food" className="text-xs font-medium ml-3 whitespace-nowrap" style={{ color: 'var(--cook)' }}>
              View food log &rarr;
            </a>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ══════════════════════════════════════════════════════════
   ICookedThisSheet
   ══════════════════════════════════════════════════════════ */

function ICookedThisSheet({ open, onClose, recipe, scaleFactor, people, onSaved }) {
  const [portions, setPortions] = useState(Math.max(1, Math.round(people || 1)));
  const [weight, setWeight] = useState(Math.round((recipe?.cooked_yield_g || 500) * scaleFactor));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && recipe) {
      setPortions(Math.max(1, Math.round(people || 1)));
      setWeight(Math.round((recipe.cooked_yield_g || 500) * scaleFactor));
    }
  }, [open, recipe, scaleFactor, people]);

  if (!recipe) return null;

  const ps = recipe.per_serving || {};
  const totalBatch = {};
  MACROS.forEach(m => { totalBatch[m.key] = (ps[m.key] || 0) * (recipe.servings || 1) * scaleFactor; });
  const perPortion = {};
  MACROS.forEach(m => {
    const v = portions > 0 ? totalBatch[m.key] / portions : 0;
    perPortion[m.key] = m.key === 'calories' ? roundCal(v) : roundMacro(v);
  });

  async function handleSave() {
    setSaving(true);
    try {
      await api.createBatch({
        recipe_id: recipe.id,
        scale_factor: scaleFactor,
        portions,
        measured_weight_g: weight,
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="I cooked this" height="tall">
      <div className="px-5 pb-4 space-y-5">
        <Stepper value={portions} onChange={v => setPortions(Math.max(1, v))} min={1} step={1} label="Split the batch into" />

        <div>
          <label className="text-sm text-tx-2 block mb-1">Weigh the finished dish, minus the pan</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={weight}
              onChange={e => setWeight(Math.max(0, +e.target.value))}
              className="w-28 px-3 py-1.5 rounded-lg bg-card-2 text-tx font-num text-center border border-hair"
            />
            <span className="text-sm text-tx-3">g</span>
          </div>
        </div>

        <div>
          <p className="text-xs text-tx-3 mb-2">Per portion</p>
          <MacroGrid macros={perPortion} />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl font-semibold text-sm press-scale"
          style={{ background: 'var(--cook)', color: 'var(--on-accent)' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Sheet>
  );
}

/* ══════════════════════════════════════════════════════════
   RecipeForm (new / edit)
   ══════════════════════════════════════════════════════════ */

function RecipeForm({ recipe, isNew, navigate }) {
  const [title, setTitle] = useState(recipe?.title || '');
  const [servings, setServings] = useState(recipe?.servings || 4);
  const [totalTime, setTotalTime] = useState(recipe?.total_time_min || '');
  const [tags, setTags] = useState(recipe?.tags || []);
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients?.length
      ? recipe.ingredients.map(i => ({ ...i }))
      : [{ amount: '', unit: 'g', name: '', main_ingredient: false }]
  );
  const [steps, setSteps] = useState(
    recipe?.steps?.length
      ? recipe.steps.map(s => ({ ...s }))
      : [{ title: '', text: '', timer_seconds: '' }]
  );
  const [macros, setMacros] = useState({
    calories: recipe?.per_serving?.calories ?? '',
    protein_g: recipe?.per_serving?.protein_g ?? '',
    carbs_g: recipe?.per_serving?.carbs_g ?? '',
    fat_g: recipe?.per_serving?.fat_g ?? '',
    fiber_g: recipe?.per_serving?.fiber_g ?? '',
    sugar_g: recipe?.per_serving?.sugar_g ?? '',
  });
  const [notes, setNotes] = useState(recipe?.notes || '');
  const [cookedYield, setCookedYield] = useState(recipe?.cooked_yield_g || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function updateIngredient(idx, field, value) {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
  }

  function setMainIngredient(idx) {
    setIngredients(prev => prev.map((ing, i) => ({ ...ing, main_ingredient: i === idx })));
  }

  function removeIngredient(idx) {
    setIngredients(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  function addIngredient() {
    setIngredients(prev => [...prev, { amount: '', unit: 'g', name: '', main_ingredient: false }]);
  }

  function updateStep(idx, field, value) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function removeStep(idx) {
    setSteps(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  function addStep() {
    setSteps(prev => [...prev, { title: '', text: '', timer_seconds: '' }]);
  }

  function updateMacro(key, value) {
    setMacros(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!title.trim()) return;
    if (macros.calories === '' || macros.protein_g === '') return;

    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        servings: +servings || 4,
        total_time_min: totalTime ? +totalTime : null,
        tags,
        per_serving: {
          calories: +macros.calories || 0,
          protein_g: +macros.protein_g || 0,
          carbs_g: +macros.carbs_g || 0,
          fat_g: +macros.fat_g || 0,
          fiber_g: +macros.fiber_g || 0,
          sugar_g: +macros.sugar_g || 0,
        },
        ingredients: ingredients
          .filter(i => i.name.trim())
          .map(i => ({ amount: +i.amount || 0, unit: i.unit, name: i.name.trim(), main_ingredient: !!i.main_ingredient })),
        steps: steps
          .filter(s => s.text.trim())
          .map(s => ({ title: s.title?.trim() || '', text: s.text.trim(), timer_seconds: s.timer_seconds ? +s.timer_seconds * 60 : null })),
        notes: notes.trim() || null,
        cooked_yield_g: cookedYield ? +cookedYield : null,
      };

      if (isNew) {
        const created = await api.createRecipe(data);
        navigate(`/cook/recipes/${created.id}`, { replace: true });
      } else {
        await api.updateRecipe(recipe.id, data);
        navigate(`/cook/recipes/${recipe.id}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this recipe?')) return;
    setDeleting(true);
    try {
      await api.deleteRecipe(recipe.id);
      navigate('/cook/recipes', { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-card-2 text-tx border border-hair text-sm';
  const labelCls = 'text-xs text-tx-3 block mb-1';

  return (
    <div className="px-4 pb-8 space-y-5">
      {/* Title */}
      <div>
        <label className={labelCls}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Recipe name" />
      </div>

      {/* Servings & time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Servings</label>
          <input type="number" value={servings} onChange={e => setServings(e.target.value)} className={inputCls} min={1} />
        </div>
        <div>
          <label className={labelCls}>Total time (min)</label>
          <input type="number" value={totalTime} onChange={e => setTotalTime(e.target.value)} className={inputCls} placeholder="Optional" />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className={labelCls}>Tags</label>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${tags.includes(tag) ? 'text-[var(--on-accent)]' : 'bg-card-2 text-tx-2'}`}
              style={tags.includes(tag) ? { background: 'var(--cook)' } : undefined}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <label className={labelCls}>Ingredients</label>
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button
                onClick={() => setMainIngredient(idx)}
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{
                  borderColor: ing.main_ingredient ? 'var(--cook)' : 'var(--border-hair)',
                  background: ing.main_ingredient ? 'var(--cook)' : 'transparent',
                }}
                title="Main ingredient"
              >
                {ing.main_ingredient && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--on-accent)' }} />}
              </button>
              <input
                type="number"
                value={ing.amount}
                onChange={e => updateIngredient(idx, 'amount', e.target.value)}
                className="w-16 px-2 py-1.5 rounded-lg bg-card-2 text-tx font-num text-sm border border-hair text-center"
                placeholder="Amt"
              />
              <select
                value={ing.unit}
                onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-card-2 text-tx text-sm border border-hair"
              >
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input
                value={ing.name}
                onChange={e => updateIngredient(idx, 'name', e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-card-2 text-tx text-sm border border-hair"
                placeholder="Ingredient"
              />
              <button onClick={() => removeIngredient(idx)} className="text-tx-3 press-scale flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button onClick={addIngredient} className="mt-2 text-sm font-medium press-scale" style={{ color: 'var(--cook)' }}>
          + Add ingredient
        </button>
      </div>

      {/* Steps */}
      <div>
        <label className={labelCls}>Steps</label>
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-card-2 rounded-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-tx-3 font-medium">Step {idx + 1}</span>
                <button onClick={() => removeStep(idx)} className="text-tx-3 press-scale">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                value={step.title || ''}
                onChange={e => updateStep(idx, 'title', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-card text-tx text-sm border border-hair"
                placeholder="Step title (optional)"
              />
              <textarea
                value={step.text}
                onChange={e => updateStep(idx, 'text', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-card text-tx text-sm border border-hair resize-none"
                rows={2}
                placeholder="Instructions"
              />
              <input
                type="number"
                value={step.timer_seconds || ''}
                onChange={e => updateStep(idx, 'timer_seconds', e.target.value)}
                className="w-24 px-2 py-1.5 rounded-lg bg-card text-tx text-sm border border-hair font-num"
                placeholder="Timer (min)"
              />
            </div>
          ))}
        </div>
        <button onClick={addStep} className="mt-2 text-sm font-medium press-scale" style={{ color: 'var(--cook)' }}>
          + Add step
        </button>
      </div>

      {/* Macros */}
      <div>
        <label className={labelCls}>Macros per serving</label>
        <p className="text-xs text-tx-3 mb-2">Calories and protein are required. Anything you leave blank counts as 0.</p>
        <div className="grid grid-cols-3 gap-2">
          {MACROS.map(m => (
            <div key={m.key}>
              <label className="text-[11px] text-tx-3 mb-0.5 block">{m.label}{(m.key === 'calories' || m.key === 'protein_g') ? ' *' : ''}</label>
              <input
                type="number"
                value={macros[m.key]}
                onChange={e => updateMacro(m.key, e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-card-2 text-tx font-num text-sm border border-hair text-center"
                placeholder="0"
                style={{ borderColor: `color-mix(in oklab, var(${m.color}) 40%, transparent)` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className={`${inputCls} resize-none`}
          rows={3}
          placeholder="Recipe notes"
        />
      </div>

      {/* Cooked yield */}
      <div>
        <label className={labelCls}>Estimated cooked weight (g)</label>
        <input
          type="number"
          value={cookedYield}
          onChange={e => setCookedYield(e.target.value)}
          className={inputCls}
          placeholder="Optional"
        />
      </div>

      {/* Buttons */}
      <div className="space-y-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim() || macros.calories === '' || macros.protein_g === ''}
          className="w-full py-3 rounded-xl font-semibold text-sm press-scale disabled:opacity-40"
          style={{ background: 'var(--cook)', color: 'var(--on-accent)' }}
        >
          {saving ? 'Saving...' : isNew ? 'Create recipe' : 'Save changes'}
        </button>

        {!isNew && recipe?.source === 'user' && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-3 rounded-xl font-semibold text-sm text-red-500 bg-card-2 press-scale"
          >
            {deleting ? 'Deleting...' : 'Delete recipe'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DetailView
   ══════════════════════════════════════════════════════════ */

function DetailView({ recipe, navigate, onRecipeChange }) {
  const [macroMode, setMacroMode] = useState('person'); // 'person' | 'per100g'
  const [mainIngAmt, setMainIngAmt] = useState(null);
  const [people, setPeople] = useState(1);
  const [myNotes, setMyNotes] = useState(recipe.my_notes || '');
  const [showLog, setShowLog] = useState(false);
  const [showCooked, setShowCooked] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [isFav, setIsFav] = useState(recipe.is_favourite);

  // Original main ingredient amount
  const mainIng = recipe.ingredients?.find(i => i.main_ingredient);
  const origMainAmt = mainIng?.amount || 0;

  // Initialise from localStorage or recipe defaults
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(`cook_scale_${recipe.id}`) || 'null');
    if (saved) {
      if (saved.mainIngAmt != null) setMainIngAmt(saved.mainIngAmt);
      if (saved.people != null) setPeople(saved.people);
    } else {
      if (mainIng) setMainIngAmt(mainIng.amount);
      setPeople(1);
    }
    setMyNotes(recipe.my_notes || '');
    setIsFav(recipe.is_favourite);
  }, [recipe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage on change
  useEffect(() => {
    if (mainIngAmt !== null) {
      localStorage.setItem(`cook_scale_${recipe.id}`, JSON.stringify({ mainIngAmt, people }));
    }
  }, [mainIngAmt, people, recipe.id]);

  // Scale factor from main ingredient only
  const scaleFactor = origMainAmt > 0 && mainIngAmt !== null ? mainIngAmt / origMainAmt : 1;

  // Per-person macro computation
  const ps = recipe.per_serving || {};
  const batchMacros = {};
  MACROS.forEach(m => { batchMacros[m.key] = (ps[m.key] || 0) * (recipe.servings || 1) * scaleFactor; });

  const perPersonMacros = {};
  MACROS.forEach(m => {
    const v = people > 0 ? batchMacros[m.key] / people : 0;
    perPersonMacros[m.key] = m.key === 'calories' ? roundCal(v) : roundMacro(v);
  });

  const batchYieldG = (recipe.cooked_yield_g || 0) * scaleFactor;
  const perPersonGrams = people > 0 && batchYieldG > 0 ? roundGrams5(batchYieldG / people) : null;

  // Per 100g computation
  const per100gMacros = {};
  if (batchYieldG > 0) {
    MACROS.forEach(m => {
      const v = (batchMacros[m.key] / batchYieldG) * 100;
      per100gMacros[m.key] = m.key === 'calories' ? roundCal(v) : roundMacro(v);
    });
  }

  async function handleSaveNotes() {
    try {
      await api.updateRecipe(recipe.id, { my_notes: myNotes });
    } catch { /* silent */ }
  }

  async function handleToggleFav() {
    setFavLoading(true);
    try {
      const result = await api.toggleRecipeFavourite(recipe.id);
      setIsFav(result.is_favourite);
      if (onRecipeChange) onRecipeChange({ ...recipe, is_favourite: result.is_favourite });
    } finally {
      setFavLoading(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const dup = await api.duplicateRecipe(recipe.id);
      navigate(`/cook/recipes/${dup.id}`);
    } finally {
      setDuplicating(false);
    }
  }

  const pairsHeader = (ps.fiber_g || 0) < 3 ? 'Low in fibre \u2014 pairs with' : 'Pairs with';

  return (
    <>
      <div className="px-4 pb-8 space-y-5">
        {/* Header */}
        <div className="pt-1">
          <button onClick={() => navigate(-1)} className="text-sm text-tx-2 press-scale mb-3 flex items-center gap-1">
            <span className="text-lg leading-none">&lsaquo;</span> Recipes
          </button>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {recipe.icon && <span className="text-3xl">{recipe.icon}</span>}
              <div>
                <h1 className="text-xl font-bold text-tx">{recipe.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {recipe.source && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-card-2 text-tx-3">{recipe.source}</span>
                  )}
                  {recipe.total_time_min && (
                    <span className="text-[11px] text-tx-3">{recipe.total_time_min} min</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleToggleFav}
              disabled={favLoading}
              className="text-2xl press-scale mt-1"
              aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
            >
              {isFav ? '\u2605' : '\u2606'}
            </button>
          </div>
          {recipe.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {recipe.tags.map(tag => (
                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-card-2 text-tx-3">{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Scale & macros */}
        <div className="bg-card rounded-card p-4 space-y-4">
          {/* Main ingredient input */}
          {mainIng && mainIngAmt !== null && (
            <div>
              <p className="text-sm text-tx-2 mb-1.5">
                How much {mainIng.name.split(',')[0].trim().toLowerCase()} are you cooking?
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={mainIngAmt}
                  onChange={e => setMainIngAmt(Math.max(0, +e.target.value))}
                  className="w-20 px-2 py-1.5 rounded-lg bg-card-2 text-tx font-num text-sm text-center border border-hair"
                />
                <span className="text-sm text-tx-3">{mainIng.unit}</span>
              </div>
            </div>
          )}

          {/* People stepper */}
          <Stepper value={people} onChange={v => setPeople(Math.max(0.5, v))} min={0.5} step={0.5} label="How many people?" />

          {/* Per-person result */}
          <div className="pt-3 border-t border-hair">
            {perPersonGrams && (
              <p className="text-[15px] font-semibold text-tx mb-3">
                Each person gets ~{perPersonGrams}g
              </p>
            )}

            <div className="flex items-center gap-2 mb-3">
              {['person', 'per100g'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setMacroMode(mode)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${macroMode === mode ? 'bg-card-2 text-tx' : 'text-tx-3'}`}
                >
                  {mode === 'person' ? 'Per person' : 'Per 100g cooked'}
                </button>
              ))}
            </div>
            <MacroGrid macros={macroMode === 'person' ? perPersonMacros : per100gMacros} />
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-card rounded-card p-4">
          <h3 className="text-sm font-semibold text-tx mb-3">Ingredients</h3>
          <ul className="space-y-2">
            {recipe.ingredients?.map((ing, idx) => {
              const scaledAmt = (ing.amount || 0) * scaleFactor;
              const display = formatQuantity(scaledAmt, ing.unit, ing.name);
              return (
                <li key={idx} className="flex items-baseline gap-2 text-sm">
                  <span className="font-num text-tx min-w-[3.5rem] text-right">{display}</span>
                  <span className="text-tx-2">{ing.name}</span>
                  {ing.main_ingredient && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--cook)' }} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Steps */}
        {recipe.steps?.length > 0 && (
          <div className="bg-card rounded-card p-4">
            <h3 className="text-sm font-semibold text-tx mb-3">Steps</h3>
            <ol className="space-y-4">
              {recipe.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-0.5"
                    style={{ background: 'var(--cook-dim)', color: 'var(--cook)' }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {step.title && <p className="text-sm font-semibold text-tx">{step.title}</p>}
                    <p className="text-sm text-tx-2">{step.text}</p>
                    {step.timer_seconds && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-card-2 text-tx-3">
                        &#9201; {formatTimer(step.timer_seconds)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Notes */}
        {recipe.notes && (
          <div className="bg-card rounded-card p-4">
            <h3 className="text-sm font-semibold text-tx mb-2">Notes</h3>
            <p className="text-sm text-tx-2 whitespace-pre-wrap">{recipe.notes}</p>
          </div>
        )}

        {/* My notes */}
        <div className="bg-card rounded-card p-4">
          <h3 className="text-sm font-semibold text-tx mb-2">My notes</h3>
          <textarea
            value={myNotes}
            onChange={e => setMyNotes(e.target.value)}
            onBlur={handleSaveNotes}
            className="w-full px-3 py-2 rounded-lg bg-card-2 text-tx text-sm border border-hair resize-none"
            rows={3}
            placeholder="Add your own notes..."
          />
        </div>

        {/* Pairs with */}
        {(recipe.pairs_with || recipe.pair_recipes?.length > 0) && (
          <div className="bg-card rounded-card p-4">
            <h3 className="text-sm font-semibold text-tx mb-2">{pairsHeader}</h3>
            {recipe.pairs_with && <p className="text-sm text-tx-2 mb-2">{recipe.pairs_with}</p>}
            {recipe.pair_recipes?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {recipe.pair_recipes.map(pr => (
                  <button
                    key={pr.id}
                    onClick={() => navigate(`/cook/recipes/${pr.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card-2 text-sm text-tx press-scale"
                  >
                    {pr.icon && <span>{pr.icon}</span>}
                    <span>{pr.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => navigate(`/cook/recipes/${recipe.id}/cook`)}
            className="w-full py-3 rounded-xl font-semibold text-sm press-scale"
            style={{ background: 'var(--cook)', color: 'var(--on-accent)' }}
          >
            Start cooking
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowLog(true)}
              className="py-2.5 rounded-xl font-medium text-sm bg-card-2 text-tx press-scale"
            >
              Log a portion
            </button>
            <button
              onClick={() => setShowCooked(true)}
              className="py-2.5 rounded-xl font-medium text-sm bg-card-2 text-tx press-scale"
            >
              I cooked this
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate(`/cook/recipes/${recipe.id}/edit`)}
              className="py-2.5 rounded-xl font-medium text-sm bg-card-2 text-tx press-scale"
            >
              Edit
            </button>
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="py-2.5 rounded-xl font-medium text-sm bg-card-2 text-tx press-scale"
            >
              {duplicating ? 'Duplicating...' : 'Duplicate'}
            </button>
          </div>
        </div>
      </div>

      <LogPortionSheet
        open={showLog}
        onClose={() => setShowLog(false)}
        recipe={recipe}
        scaleFactor={scaleFactor}
        people={people}
        perPersonGrams={perPersonGrams}
      />
      <ICookedThisSheet
        open={showCooked}
        onClose={() => setShowCooked(false)}
        recipe={recipe}
        scaleFactor={scaleFactor}
        people={people}
        onSaved={() => localStorage.removeItem(`cook_scale_${recipe.id}`)}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   CookRecipeDetail — main export
   ══════════════════════════════════════════════════════════ */

export default function CookRecipeDetail({ onOpenSidebar, isNew, isEdit }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecipe(id);
      setRecipe(data);
    } catch (e) {
      setError(e.message || 'Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isNew) load();
  }, [isNew, load]);

  // Loading state
  if (loading) {
    return (
      <div className="px-4 pt-6">
        <div className="flex items-center gap-2 mb-4">
          {onOpenSidebar && <SidebarTrigger onClick={onOpenSidebar} />}
        </div>
        <div className="space-y-4">
          <div className="h-6 w-48 bg-card-2 rounded animate-pulse" />
          <div className="h-32 bg-card-2 rounded-card animate-pulse" />
          <div className="h-24 bg-card-2 rounded-card animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="px-4 pt-6">
        <button onClick={() => navigate(-1)} className="text-sm text-tx-2 press-scale mb-4 flex items-center gap-1">
          <span className="text-lg leading-none">&lsaquo;</span> Recipes
        </button>
        <div className="bg-card rounded-card p-6 text-center">
          <p className="text-tx-2 text-sm mb-3">{error}</p>
          <button onClick={load} className="text-sm font-medium press-scale" style={{ color: 'var(--cook)' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // New recipe form
  if (isNew) {
    return (
      <div>
        <div className="px-4 pt-5 pb-3 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-sm text-tx-2 press-scale flex items-center gap-1">
            <span className="text-lg leading-none">&lsaquo;</span> Back
          </button>
          <h1 className="text-lg font-bold text-tx ml-2">New recipe</h1>
        </div>
        <RecipeForm isNew navigate={navigate} />
      </div>
    );
  }

  // Edit form
  if (isEdit && recipe) {
    return (
      <div>
        <div className="px-4 pt-5 pb-3 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-sm text-tx-2 press-scale flex items-center gap-1">
            <span className="text-lg leading-none">&lsaquo;</span> Back
          </button>
          <h1 className="text-lg font-bold text-tx ml-2">Edit recipe</h1>
        </div>
        <RecipeForm recipe={recipe} isNew={false} navigate={navigate} />
      </div>
    );
  }

  // Detail view
  if (recipe) {
    return <DetailView recipe={recipe} navigate={navigate} onRecipeChange={setRecipe} />;
  }

  return null;
}
