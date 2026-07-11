import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import Sheet from '../components/Sheet';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export default function FoodLog() {
  const [logs, setLogs] = useState({ grouped: {}, totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } });
  const [savedMeals, setSavedMeals] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [showCustomFood, setShowCustomFood] = useState(false);
  const [showSaveMeal, setShowSaveMeal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [l, m] = await Promise.all([api.getFoodLogs(), api.getSavedMeals()]);
      setLogs(l);
      setSavedMeals(m);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openLog(mealType) {
    setSelectedMeal(mealType);
    setShowLog(true);
  }

  const { totals } = logs;

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-warm-800">Food Log</h1>
        <p className="text-sm text-warm-400 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* Daily totals */}
      <div className="mx-4 bg-white rounded-2xl shadow-card p-4 mb-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <MacroStat label="Calories" value={Math.round(totals.calories)} unit="kcal" />
          <MacroStat label="Protein" value={Math.round(totals.protein_g)} unit="g" accent />
          <MacroStat label="Carbs" value={Math.round(totals.carbs_g)} unit="g" />
          <MacroStat label="Fat" value={Math.round(totals.fat_g)} unit="g" />
        </div>
      </div>

      {/* Saved meals quick-log */}
      {savedMeals.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-warm-400 uppercase tracking-wide px-5 mb-2">Saved Meals</p>
          <div className="px-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {savedMeals.map(meal => (
              <SavedMealChip key={meal.id} meal={meal} onLog={load} />
            ))}
          </div>
        </div>
      )}

      {/* Meal sections */}
      <div className="px-4 space-y-3">
        {MEAL_TYPES.map(mealType => (
          <MealSection
            key={mealType}
            type={mealType}
            label={MEAL_LABELS[mealType]}
            entries={logs.grouped?.[mealType] || []}
            onAdd={() => openLog(mealType)}
            onDelete={async (id) => { await api.deleteFoodLog(id); load(); }}
          />
        ))}
      </div>

      {/* Add custom food button */}
      <div className="mx-4 mt-4">
        <button
          onClick={() => setShowCustomFood(true)}
          className="w-full py-3 border border-dashed border-warm-300 rounded-xl text-sm text-warm-500 font-medium"
        >
          + Add custom food to database
        </button>
      </div>

      {/* Food search sheet */}
      <FoodSearchSheet
        open={showLog}
        onClose={() => setShowLog(false)}
        mealType={selectedMeal}
        onLogged={load}
      />

      {/* Custom food sheet */}
      <CustomFoodSheet
        open={showCustomFood}
        onClose={() => setShowCustomFood(false)}
        onSaved={load}
      />
    </div>
  );
}

function MacroStat({ label, value, unit, accent }) {
  return (
    <div>
      <div className={`text-lg font-bold ${accent ? 'text-amber-600' : 'text-warm-800'}`}>{value}</div>
      <div className="text-[10px] text-warm-400">{unit}</div>
      <div className="text-[10px] text-warm-500 font-medium">{label}</div>
    </div>
  );
}

function SavedMealChip({ meal, onLog }) {
  const [logging, setLogging] = useState(false);
  const [mealType, setMealType] = useState('breakfast');
  const [showPicker, setShowPicker] = useState(false);

  async function handleLog(type) {
    setLogging(true);
    try {
      await api.logFood({ saved_meal_id: meal.id, meal_type: type });
      onLog?.();
    } finally {
      setLogging(false);
      setShowPicker(false);
    }
  }

  return (
    <div className="flex-shrink-0">
      <button
        onClick={() => setShowPicker(true)}
        className="flex flex-col items-start bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 min-w-[140px]"
      >
        <span className="text-sm font-semibold text-amber-800">{meal.name}</span>
        <span className="text-xs text-amber-600 mt-0.5">{Math.round(meal.total_calories)} kcal · {Math.round(meal.total_protein_g)}g protein</span>
      </button>

      {showPicker && (
        <Sheet open={showPicker} onClose={() => setShowPicker(false)} title={`Log "${meal.name}"`}>
          <div className="px-5 pb-6 space-y-3">
            <p className="text-sm text-warm-500">
              {Math.round(meal.total_calories)} kcal · {Math.round(meal.total_protein_g)}g protein · {Math.round(meal.total_carbs_g)}g carbs · {Math.round(meal.total_fat_g)}g fat
            </p>
            <p className="text-xs font-medium text-warm-500">Which meal?</p>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => handleLog(t)}
                  disabled={logging}
                  className="py-3 rounded-xl border border-warm-200 bg-white text-sm font-medium text-warm-700 active:bg-warm-50 disabled:opacity-40"
                >
                  {MEAL_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function MealSection({ type, label, entries, onAdd, onDelete }) {
  const total = entries.reduce((s, e) => ({ cal: s.cal + e.calories, pro: s.pro + e.protein_g }), { cal: 0, pro: 0 });

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-warm-50">
        <div>
          <span className="text-sm font-semibold text-warm-700">{label}</span>
          {entries.length > 0 && (
            <span className="text-xs text-warm-400 ml-2">{Math.round(total.cal)} kcal · {Math.round(total.pro)}g protein</span>
          )}
        </div>
        <button
          onClick={onAdd}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 text-lg font-bold leading-none"
        >
          +
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-3 text-sm text-warm-300 italic">Nothing logged yet</div>
      ) : (
        <div className="divide-y divide-warm-50">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-warm-700 font-medium truncate">
                  {entry.quantity !== 1 ? `${entry.quantity}× ` : ''}{entry.food_name}
                </p>
                <p className="text-xs text-warm-400">{Math.round(entry.calories)} kcal · {Math.round(entry.protein_g)}g protein</p>
              </div>
              <button
                onClick={() => onDelete(entry.id)}
                className="ml-3 text-warm-300 text-lg leading-none active:text-red-400"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FoodSearchSheet({ open, onClose, mealType, onLogged }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Load all foods initially
      api.searchFoods('').then(setResults);
    } else {
      setQuery('');
      setSelected(null);
      setQty('1');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      const r = await api.searchFoods(query);
      setResults(r);
      setSearching(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  async function handleLog() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.logFood({ food_id: selected.id, quantity: parseFloat(qty) || 1, meal_type: mealType });
      onLogged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const multiplied = selected ? {
    cal: Math.round(selected.calories * (parseFloat(qty) || 1)),
    pro: Math.round(selected.protein_g * (parseFloat(qty) || 1) * 10) / 10,
  } : null;

  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${MEAL_LABELS[mealType]}`} height="full">
      <div className="flex flex-col h-full">
        {/* Search bar */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search foods..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-warm-200 text-sm text-warm-800 focus:outline-none focus:border-amber-400 bg-white"
            />
          </div>
        </div>

        {/* Selected food editor */}
        {selected && (
          <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">{selected.name}</p>
                <p className="text-xs text-amber-600">{selected.serving_unit}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-amber-400 text-lg">×</button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label className="text-xs text-amber-700">Servings:</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(q => String(Math.max(0.25, (parseFloat(q) || 1) - 0.25)))} className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold text-sm">−</button>
                <input
                  type="number"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-14 text-center px-1 py-1 rounded-lg border border-amber-200 text-sm font-semibold text-amber-800 bg-white focus:outline-none"
                  step="0.25"
                  min="0.25"
                />
                <button onClick={() => setQty(q => String((parseFloat(q) || 1) + 0.25))} className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold text-sm">+</button>
              </div>
              {multiplied && (
                <span className="text-xs text-amber-600 ml-auto">{multiplied.cal} kcal · {multiplied.pro}g protein</span>
              )}
            </div>
            <button
              onClick={handleLog}
              disabled={saving}
              className="w-full mt-3 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              {saving ? 'Adding...' : `Add to ${MEAL_LABELS[mealType]}`}
            </button>
          </div>
        )}

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {searching && <p className="text-sm text-warm-400 text-center py-4">Searching...</p>}
          {!searching && results.length === 0 && (
            <p className="text-sm text-warm-400 text-center py-4">No foods found. Try a different search.</p>
          )}
          <div className="space-y-1">
            {results.map(food => (
              <button
                key={food.id}
                onClick={() => { setSelected(food); setQty('1'); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all ${
                  selected?.id === food.id ? 'bg-amber-50 border border-amber-200' : 'bg-warm-50 border border-transparent'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-warm-800 truncate">{food.name}</p>
                  <p className="text-xs text-warm-400">{food.serving_unit}</p>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className="text-sm font-semibold text-warm-700">{Math.round(food.calories)}</p>
                  <p className="text-xs text-warm-400">kcal</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function CustomFoodSheet({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', serving_unit: '1 serving', calories: '', protein_g: '', carbs_g: '', fat_g: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name || !form.calories) { setError('Name and calories are required'); return; }
    setSaving(true);
    setError('');
    try {
      await api.addCustomFood({
        name: form.name,
        serving_unit: form.serving_unit,
        calories: parseFloat(form.calories),
        protein_g: parseFloat(form.protein_g) || 0,
        carbs_g: parseFloat(form.carbs_g) || 0,
        fat_g: parseFloat(form.fat_g) || 0,
      });
      onSaved?.();
      onClose();
      setForm({ name: '', serving_unit: '1 serving', calories: '', protein_g: '', carbs_g: '', fat_g: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add Custom Food">
      <div className="px-5 pb-6 space-y-4">
        <Field label="Food name *" value={form.name} onChange={v => set('name', v)} placeholder="e.g. Mum's dal tadka" />
        <Field label="Serving unit" value={form.serving_unit} onChange={v => set('serving_unit', v)} placeholder="1 cup, 100g, 1 piece..." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories *" value={form.calories} onChange={v => set('calories', v)} type="number" placeholder="kcal" />
          <Field label="Protein (g)" value={form.protein_g} onChange={v => set('protein_g', v)} type="number" placeholder="0" />
          <Field label="Carbs (g)" value={form.carbs_g} onChange={v => set('carbs_g', v)} type="number" placeholder="0" />
          <Field label="Fat (g)" value={form.fat_g} onChange={v => set('fat_g', v)} type="number" placeholder="0" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-semibold text-sm disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save to Food Database'}
        </button>
      </div>
    </Sheet>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-medium text-warm-500 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-warm-200 text-sm text-warm-800 focus:outline-none focus:border-amber-400 bg-white"
      />
    </div>
  );
}
