import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import Sheet from '../components/Sheet';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

function getMealTypeByTime() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}

export default function FoodLog() {
  const [logs, setLogs] = useState({ grouped: {}, totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 } });
  const [savedMeals, setSavedMeals] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [showCustomFood, setShowCustomFood] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedMealPicker, setSavedMealPicker] = useState(null);
  const [savedMealType, setSavedMealType] = useState(getMealTypeByTime);
  const [loggingSavedMeal, setLoggingSavedMeal] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [goal, setGoal] = useState(null);

  const load = useCallback(async () => {
    try {
      const [l, m, g] = await Promise.all([api.getFoodLogs(), api.getSavedMeals(), api.getGoal()]);
      setLogs(l);
      setSavedMeals(m);
      setGoal(g);
      // Load suggestions
      api.getSuggestions().then(setSuggestions).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openLog(mealType) {
    setSelectedMeal(mealType);
    setShowLog(true);
  }

  function openSavedMealPicker(meal) {
    setSavedMealPicker(meal);
    setSavedMealType(getMealTypeByTime());
  }

  async function handleLogSavedMeal() {
    if (!savedMealPicker) return;
    setLoggingSavedMeal(true);
    try {
      await api.logFood({ saved_meal_id: savedMealPicker.id, meal_type: savedMealType });
      load();
      setSavedMealPicker(null);
    } finally {
      setLoggingSavedMeal(false);
    }
  }

  async function handleCopyYesterday(mealType) {
    try {
      await api.copyYesterday(mealType);
      load();
    } catch (e) {
      // No entries to copy — ignore
    }
  }

  async function handleAddSuggestion(suggestion) {
    const mealType = suggestions?.default_meal_type || getMealTypeByTime();
    await api.logFood({ food_id: suggestion.food_id, quantity: 1, meal_type: mealType });
    load();
  }

  const { totals } = logs;
  const calTarget = goal?.current_calorie_target || 2240;
  const proTarget = goal?.current_protein_target_g || 180;
  const fiberTarget = goal?.current_fiber_target_g || 32;
  const sugarLimit = goal?.current_sugar_limit_g || 50;

  return (
    <div className="px-4 pb-4">
      {/* Header */}
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-medium text-warm-800">Food log</h1>
        <p className="text-xs text-warm-400 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* 2×2 Macro progress grid */}
      <div className="bg-warm-100 rounded-card p-4 mb-3 stagger-enter">
        <div className="grid grid-cols-2 gap-3">
          <MacroProgress label="Calories" current={totals.calories} target={calTarget} unit="kcal" color="var(--chart-accent)" />
          <MacroProgress label="Protein" current={totals.protein_g} target={proTarget} unit="g" color="var(--chart-success)" />
          <MacroProgress label="Fiber" current={totals.fiber_g} target={fiberTarget} unit="g" color="var(--fiber)" direction="reach" />
          <MacroProgress label="Sugar" current={totals.sugar_g} target={sugarLimit} unit="g" color="var(--sugar)" direction="limit" />
        </div>
      </div>

      {/* Suggestions card */}
      {suggestions?.suggestions?.length > 0 && (
        <div className="bg-warm-100 rounded-card p-4 mb-3 stagger-enter">
          <p className="text-xs text-warm-500 mb-2">
            Close the gap — {suggestions.primary_gap === 'protein' ? 'protein' : 'fiber'} ({suggestions.gap_amount}g remaining)
          </p>
          <div className="space-y-2">
            {suggestions.suggestions.map(s => (
              <div key={s.food_id} className="flex items-center justify-between bg-warm-200/50 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-warm-700 truncate">{s.food_name}</p>
                  <p className="text-xs text-warm-400">{s.description}</p>
                </div>
                <button
                  onClick={() => handleAddSuggestion(s)}
                  className="ml-2 px-3 py-1.5 bg-accent/10 text-accent text-xs rounded-lg press-scale flex-shrink-0"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions?.reason === 'low_calories' && (
        <div className="bg-warm-100 rounded-card px-4 py-3 mb-3 stagger-enter">
          <p className="text-xs text-warm-500">{suggestions.message}</p>
        </div>
      )}

      {/* Saved meals quick-log */}
      {savedMeals.length > 0 && (
        <div className="mb-3 stagger-enter">
          <p className="text-xs text-warm-400 mb-2 px-1">Saved meals</p>
          <div className="-mx-4 px-4">
            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
              {savedMeals.map(meal => (
                <button
                  key={meal.id}
                  onClick={() => openSavedMealPicker(meal)}
                  className="flex-shrink-0 flex flex-col items-start bg-accent-tint border border-accent/20 rounded-card px-4 py-3 min-w-[140px] press-scale"
                >
                  <span className="text-sm text-warm-800">{meal.name}</span>
                  <span className="text-xs text-warm-500 mt-0.5">{Math.round(meal.total_calories)} kcal · {Math.round(meal.total_protein_g)}g protein</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Meal sections */}
      <div className="space-y-2">
        {MEAL_TYPES.map(mealType => (
          <div key={mealType} className="stagger-enter">
            <MealSection
              type={mealType}
              label={MEAL_LABELS[mealType]}
              entries={logs.grouped?.[mealType] || []}
              onAdd={() => openLog(mealType)}
              onDelete={async (id) => { await api.deleteFoodLog(id); load(); }}
              onCopyYesterday={() => handleCopyYesterday(mealType)}
            />
          </div>
        ))}
      </div>

      {/* Suggest button */}
      <div className="mt-3 flex gap-2 stagger-enter">
        <button
          onClick={() => api.getSuggestions(null, true).then(setSuggestions)}
          className="flex-1 py-3 border border-warm-300 rounded-card text-sm text-warm-500 press-scale"
        >
          Suggest foods
        </button>
        <button
          onClick={() => setShowCustomFood(true)}
          className="flex-1 py-3 border border-dashed border-warm-300 rounded-card text-sm text-warm-500 press-scale"
        >
          + Custom food
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

      {/* Saved meal picker sheet */}
      <Sheet open={!!savedMealPicker} onClose={() => setSavedMealPicker(null)} title={savedMealPicker ? `Log "${savedMealPicker.name}"` : ''}>
        {savedMealPicker && (
          <div className="px-5 pb-6 space-y-4">
            <p className="text-sm text-warm-500">
              {Math.round(savedMealPicker.total_calories)} kcal · {Math.round(savedMealPicker.total_protein_g)}g protein · {Math.round(savedMealPicker.total_carbs_g)}g carbs · {Math.round(savedMealPicker.total_fat_g)}g fat
            </p>
            <div>
              <p className="text-xs text-warm-500 mb-2">Log as</p>
              <div className="grid grid-cols-4 gap-2">
                {MEAL_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setSavedMealType(t)}
                    className={`py-2.5 rounded-card text-sm border transition-colors press-scale ${
                      savedMealType === t
                        ? 'border-accent bg-accent-tint text-accent'
                        : 'border-warm-200 bg-surface text-warm-600'
                    }`}
                  >
                    {MEAL_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleLogSavedMeal}
              disabled={loggingSavedMeal}
              className="w-full py-3.5 bg-accent text-white rounded-card text-sm disabled:opacity-40 press-scale"
            >
              {loggingSavedMeal ? 'Logging...' : `Log to ${MEAL_LABELS[savedMealType]}`}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function MacroProgress({ label, current, target, unit, color, direction }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isLimit = direction === 'limit';
  const overLimit = isLimit && current > target;
  const nearLimit = isLimit && pct >= 80 && pct < 100;

  let barColor = color;
  if (isLimit && overLimit) barColor = 'var(--danger)';
  else if (isLimit && nearLimit) barColor = 'var(--warning)';

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] text-warm-500">{label}</span>
        <span className="text-xs text-warm-700">
          {Math.round(current)}<span className="text-warm-400">/{Math.round(target)} {unit}</span>
        </span>
      </div>
      <div className="h-2 bg-warm-200/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-fill"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}


function MealSection({ type, label, entries, onAdd, onDelete, onCopyYesterday }) {
  const total = entries.reduce((s, e) => ({ cal: s.cal + e.calories, pro: s.pro + e.protein_g }), { cal: 0, pro: 0 });

  return (
    <div className="bg-warm-100 rounded-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200/50">
        <div>
          <span className="text-sm text-warm-700">{label}</span>
          {entries.length > 0 && (
            <span className="text-xs text-warm-400 ml-2">{Math.round(total.cal)} kcal · {Math.round(total.pro)}g protein</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onCopyYesterday}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-warm-200/60 text-warm-400 text-xs press-scale"
            title="Copy yesterday"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </button>
          <button
            onClick={onAdd}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-accent/10 text-accent text-lg leading-none press-scale"
          >
            +
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-3 text-sm text-warm-300 italic">Nothing logged yet</div>
      ) : (
        <div className="divide-y divide-warm-200/50">
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-warm-700 truncate">
                  {entry.quantity !== 1 ? `${entry.quantity}x ` : ''}{entry.food_name}
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
  const [favorites, setFavorites] = useState([]);
  const [recents, setRecents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      Promise.all([
        api.searchFoods(''),
        api.getFavorites(),
        api.getRecents(),
      ]).then(([all, favs, rec]) => {
        setResults(all);
        setFavorites(favs);
        setRecents(rec);
      });
    } else {
      setQuery('');
      setSelected(null);
      setQty('1');
      setSelectedUnit(null);
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
      await api.logFood({
        food_id: selected.id,
        quantity: parseFloat(qty) || 1,
        meal_type: mealType,
        unit_used: selectedUnit,
      });
      onLogged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleFavorite(food, e) {
    e.stopPropagation();
    await api.toggleFavorite(food.id);
    const [favs, all] = await Promise.all([api.getFavorites(), api.searchFoods(query)]);
    setFavorites(favs);
    setResults(all);
  }

  function selectFood(food) {
    setSelected(food);
    setQty('1');
    // Use default_unit or first unit if available
    const units = food.units ? JSON.parse(food.units) : null;
    setSelectedUnit(food.default_unit || (units ? units[0]?.unit : null));
  }

  const units = selected?.units ? JSON.parse(selected.units) : null;
  const unitMultiplier = selectedUnit && units
    ? (units.find(u => u.unit === selectedUnit)?.multiplier || 1)
    : 1;
  const effectiveQty = (parseFloat(qty) || 1) * unitMultiplier;

  const multiplied = selected ? {
    cal: Math.round(selected.calories * effectiveQty),
    pro: Math.round(selected.protein_g * effectiveQty * 10) / 10,
    fiber: Math.round((selected.fiber_g || 0) * effectiveQty * 10) / 10,
  } : null;

  // Show favorites and recents when no query
  const showFavsRecents = !query && (favorites.length > 0 || recents.length > 0);

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
              className="w-full pl-9 pr-4 py-2.5 rounded-card border border-warm-200 text-sm text-warm-800 focus:outline-none focus:border-accent bg-surface"
            />
          </div>
        </div>

        {/* Selected food editor */}
        {selected && (
          <div className="mx-4 mb-3 bg-accent-tint border border-accent/20 rounded-card p-3 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-warm-800">{selected.name}</p>
                <p className="text-xs text-warm-500">{selected.serving_unit}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-warm-400 text-lg">×</button>
            </div>

            {/* Unit selector */}
            {units && units.length > 1 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-none">
                {units.map(u => (
                  <button
                    key={u.unit}
                    onClick={() => setSelectedUnit(u.unit)}
                    className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-colors ${
                      selectedUnit === u.unit
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-warm-200 text-warm-500'
                    }`}
                  >
                    {u.unit}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-2">
              <label className="text-xs text-warm-500">Qty:</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(q => String(Math.max(0.25, (parseFloat(q) || 1) - 0.25)))} className="w-7 h-7 rounded-lg bg-warm-100 text-warm-700 text-sm press-scale">-</button>
                <input
                  type="number"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-14 text-center px-1 py-1 rounded-lg border border-warm-200 text-sm text-warm-800 bg-surface focus:outline-none"
                  step="0.25"
                  min="0.25"
                />
                <button onClick={() => setQty(q => String((parseFloat(q) || 1) + 0.25))} className="w-7 h-7 rounded-lg bg-warm-100 text-warm-700 text-sm press-scale">+</button>
              </div>
              {multiplied && (
                <span className="text-xs text-warm-500 ml-auto">{multiplied.cal} kcal · {multiplied.pro}g pro</span>
              )}
            </div>
            <button
              onClick={handleLog}
              disabled={saving}
              className="w-full mt-3 py-2.5 bg-accent text-white rounded-card text-sm disabled:opacity-40 press-scale"
            >
              {saving ? 'Adding...' : `Add to ${MEAL_LABELS[mealType]}`}
            </button>
          </div>
        )}

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Favorites row */}
          {showFavsRecents && favorites.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-warm-400 mb-1.5 px-1">Favorites</p>
              <div className="space-y-1">
                {favorites.map(food => (
                  <FoodRow key={food.id} food={food} selected={selected} onSelect={selectFood} onToggleFavorite={handleToggleFavorite} />
                ))}
              </div>
            </div>
          )}

          {/* Recents row */}
          {showFavsRecents && recents.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-warm-400 mb-1.5 px-1">Recent</p>
              <div className="space-y-1">
                {recents.filter(r => !favorites.find(f => f.id === r.id)).slice(0, 10).map(food => (
                  <FoodRow key={food.id} food={food} selected={selected} onSelect={selectFood} onToggleFavorite={handleToggleFavorite} />
                ))}
              </div>
            </div>
          )}

          {showFavsRecents && <div className="border-t border-warm-200/50 my-3" />}

          {searching && <p className="text-sm text-warm-400 text-center py-4">Searching...</p>}
          {!searching && results.length === 0 && (
            <p className="text-sm text-warm-400 text-center py-4">No foods found. Try a different search.</p>
          )}
          <div className="space-y-1">
            {results.map(food => (
              <FoodRow key={food.id} food={food} selected={selected} onSelect={selectFood} onToggleFavorite={handleToggleFavorite} />
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function FoodRow({ food, selected, onSelect, onToggleFavorite }) {
  return (
    <button
      onClick={() => onSelect(food)}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-card text-left transition-colors ${
        selected?.id === food.id ? 'bg-accent-tint border border-accent/20' : 'bg-warm-100 border border-transparent'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-warm-800 truncate">{food.name}</p>
        <p className="text-xs text-warm-400">{food.serving_unit}</p>
      </div>
      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
        <button
          onClick={(e) => onToggleFavorite(food, e)}
          className="text-sm"
          aria-label={food.is_favorite ? 'Unfavorite' : 'Favorite'}
        >
          <span style={{ color: food.is_favorite ? 'var(--star)' : 'var(--chart-grid)' }}>
            {food.is_favorite ? '★' : '☆'}
          </span>
        </button>
        <div className="text-right">
          <p className="text-sm text-warm-700">{Math.round(food.calories)}</p>
          <p className="text-xs text-warm-400">kcal</p>
        </div>
      </div>
    </button>
  );
}

function CustomFoodSheet({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', serving_unit: '1 serving', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '', sugar_g: '' });
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
        fiber_g: parseFloat(form.fiber_g) || 0,
        sugar_g: parseFloat(form.sugar_g) || 0,
      });
      onSaved?.();
      onClose();
      setForm({ name: '', serving_unit: '1 serving', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '', sugar_g: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add custom food">
      <div className="px-5 pb-6 space-y-4">
        <Field label="Food name" value={form.name} onChange={v => set('name', v)} placeholder="e.g. Mum's dal tadka" />
        <Field label="Serving unit" value={form.serving_unit} onChange={v => set('serving_unit', v)} placeholder="1 cup, 100g, 1 piece..." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories" value={form.calories} onChange={v => set('calories', v)} type="number" placeholder="kcal" />
          <Field label="Protein (g)" value={form.protein_g} onChange={v => set('protein_g', v)} type="number" placeholder="0" />
          <Field label="Carbs (g)" value={form.carbs_g} onChange={v => set('carbs_g', v)} type="number" placeholder="0" />
          <Field label="Fat (g)" value={form.fat_g} onChange={v => set('fat_g', v)} type="number" placeholder="0" />
          <Field label="Fiber (g)" value={form.fiber_g} onChange={v => set('fiber_g', v)} type="number" placeholder="0" />
          <Field label="Sugar (g)" value={form.sugar_g} onChange={v => set('sugar_g', v)} type="number" placeholder="0" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 bg-accent text-white rounded-card text-sm disabled:opacity-40 press-scale"
        >
          {saving ? 'Saving...' : 'Save to food database'}
        </button>
      </div>
    </Sheet>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-xs text-warm-500 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-card border border-warm-200 text-sm text-warm-800 focus:outline-none focus:border-accent bg-surface"
      />
    </div>
  );
}
