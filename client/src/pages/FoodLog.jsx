import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import Sheet from '../components/Sheet';

const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner', 'drinks'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snacks', dinner: 'Dinner', drinks: 'Drinks' };
const MEAL_COLORS = {
  breakfast: 'var(--breakfast)',
  lunch: 'var(--lunch)',
  snack: 'var(--snack)',
  dinner: 'var(--dinner)',
  drinks: 'var(--drinks)',
};

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
  const [editEntry, setEditEntry] = useState(null);

  const load = useCallback(async () => {
    try {
      const [l, m, g] = await Promise.all([api.getFoodLogs(), api.getSavedMeals(), api.getGoal()]);
      setLogs(l);
      setSavedMeals(m);
      setGoal(g);
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
      // No entries to copy
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
  const carbTarget = goal?.current_carb_target_g || 250;
  const fatTarget = goal?.current_fat_target_g || 60;
  const fiberTarget = goal?.current_fiber_target_g || 32;
  const sugarLimit = goal?.current_sugar_limit_g || 50;

  // Determine which nutrient has the biggest gap for the suggestion card
  const gaps = [
    { key: 'fiber', label: 'Fiber', gap: fiberTarget - (totals.fiber_g || 0), color: 'var(--fiber)', token: 'fiber' },
    { key: 'protein', label: 'Protein', gap: proTarget - (totals.protein_g || 0), color: 'var(--protein)', token: 'protein' },
    { key: 'calories', label: 'Calories', gap: calTarget - (totals.calories || 0), color: 'var(--cal)', token: 'cal' },
  ];
  const biggestGap = gaps.reduce((a, b) => (b.gap / (b.key === 'calories' ? calTarget : b.key === 'protein' ? proTarget : fiberTarget)) > (a.gap / (a.key === 'calories' ? calTarget : a.key === 'protein' ? proTarget : fiberTarget)) ? b : a);

  return (
    <div className="px-4 pb-4">
      {/* Header */}
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-bold text-tx">Food log</h1>
        <p className="text-xs text-tx-3 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
      </div>

      {/* 3-column grid of 6 tinted macro cards */}
      <div className="grid grid-cols-3 gap-2 mb-3 stagger-enter">
        <MacroCard label="CALORIES" value={totals.calories} target={calTarget} unit="kcal" token="cal" />
        <MacroCard label="PROTEIN" value={totals.protein_g} target={proTarget} unit="g" token="protein" />
        <MacroCard label="CARBS" value={totals.carbs_g} target={carbTarget} unit="g" token="carbs" />
        <MacroCard label="FAT" value={totals.fat_g} target={fatTarget} unit="g" token="fat" />
        <MacroCard label="FIBER" value={totals.fiber_g} target={fiberTarget} unit="g" token="fiber" />
        <MacroCard label="SUGAR" value={totals.sugar_g} target={sugarLimit} unit="g" token="sugar" direction="limit" />
      </div>

      {/* Gap suggestion card */}
      {suggestions?.suggestions?.length > 0 && (
        <div className="bg-card rounded-card overflow-hidden mb-3 stagger-enter">
          <div className="flex">
            <div className="w-[5px] flex-shrink-0" style={{ backgroundColor: biggestGap.color }} />
            <div className="flex-1 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: biggestGap.color }}>
                Close the gap
              </p>
              <p className="text-sm text-tx mb-2">
                You're short on <span className="font-semibold" style={{ color: biggestGap.color }}>{biggestGap.label.toLowerCase()}</span>
                {suggestions.primary_gap && suggestions.primary_gap !== biggestGap.key && (
                  <> and <span className="font-semibold" style={{ color: gaps.find(g => g.key === suggestions.primary_gap)?.color }}>{suggestions.primary_gap}</span></>
                )}
                {' '}({suggestions.gap_amount}g remaining)
              </p>
              <div className="space-y-2">
                {suggestions.suggestions.map(s => (
                  <div key={s.food_id} className="flex items-center justify-between bg-card-2 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-tx truncate">{s.food_name}</p>
                      <p className="text-xs text-tx-3">{s.description}</p>
                    </div>
                    <button
                      onClick={() => handleAddSuggestion(s)}
                      className="ml-2 px-3 py-1.5 rounded-full text-xs press-scale flex-shrink-0 font-medium"
                      style={{
                        background: `color-mix(in oklab, ${biggestGap.color} 14%, transparent)`,
                        color: biggestGap.color,
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {suggestions?.reason === 'low_calories' && (
        <div className="bg-card rounded-card px-4 py-3 mb-3 stagger-enter">
          <p className="text-xs text-tx-3">{suggestions.message}</p>
        </div>
      )}

      {/* Saved meals quick-log */}
      {savedMeals.length > 0 && (
        <div className="mb-3 stagger-enter">
          <p className="text-xs text-tx-3 mb-2 px-1">Saved meals</p>
          <div className="-mx-4 px-4">
            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
              {savedMeals.map(meal => (
                <button
                  key={meal.id}
                  onClick={() => openSavedMealPicker(meal)}
                  className="flex-shrink-0 flex flex-col items-start tint-points border border-points/20 rounded-card px-4 py-3 min-w-[140px] press-scale"
                >
                  <span className="text-sm text-tx">{meal.name}</span>
                  <span className="text-xs text-tx-3 mt-0.5">{Math.round(meal.total_calories)} kcal · {Math.round(meal.total_protein_g)}g protein</span>
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
              color={MEAL_COLORS[mealType]}
              entries={logs.grouped?.[mealType] || []}
              onAdd={() => openLog(mealType)}
              onDelete={async (id) => { await api.deleteFoodLog(id); load(); }}
              onCopyYesterday={() => handleCopyYesterday(mealType)}
              onEdit={setEditEntry}
            />
          </div>
        ))}
      </div>

      {/* Suggest / custom buttons */}
      <div className="mt-3 flex gap-2 stagger-enter">
        <button
          onClick={() => api.getSuggestions(null, true).then(setSuggestions)}
          className="flex-1 py-3 border border-hair rounded-card text-sm text-tx-3 press-scale"
        >
          Suggest foods
        </button>
        <button
          onClick={() => setShowCustomFood(true)}
          className="flex-1 py-3 border border-dashed border-hair rounded-card text-sm text-tx-3 press-scale"
        >
          + Custom food
        </button>
      </div>

      {/* Sheets */}
      <FoodSearchSheet open={showLog} onClose={() => setShowLog(false)} mealType={selectedMeal} onLogged={load} />
      <CustomFoodSheet open={showCustomFood} onClose={() => setShowCustomFood(false)} onSaved={load} />
      <EditEntrySheet
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        entry={editEntry}
        mealColor={editEntry ? MEAL_COLORS[editEntry.meal_type] || 'var(--cal)' : 'var(--cal)'}
        onSaved={() => { setEditEntry(null); load(); }}
        onDeleted={() => { setEditEntry(null); load(); }}
      />

      <Sheet open={!!savedMealPicker} onClose={() => setSavedMealPicker(null)} title={savedMealPicker ? `Log "${savedMealPicker.name}"` : ''}>
        {savedMealPicker && (
          <div className="px-5 pb-6 space-y-4">
            <p className="text-sm text-tx-3">
              {Math.round(savedMealPicker.total_calories)} kcal · {Math.round(savedMealPicker.total_protein_g)}g protein · {Math.round(savedMealPicker.total_carbs_g)}g carbs · {Math.round(savedMealPicker.total_fat_g)}g fat
            </p>
            <div>
              <p className="text-xs text-tx-3 mb-2">Log as</p>
              <div className="grid grid-cols-5 gap-2">
                {MEAL_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setSavedMealType(t)}
                    className={`py-2.5 rounded-card text-xs border transition-colors press-scale ${
                      savedMealType === t
                        ? 'border-current bg-card-2'
                        : 'border-hair bg-card text-tx-3'
                    }`}
                    style={savedMealType === t ? { color: MEAL_COLORS[t], borderColor: MEAL_COLORS[t] } : undefined}
                  >
                    {MEAL_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleLogSavedMeal}
              disabled={loggingSavedMeal}
              className="w-full py-3.5 bg-points text-white rounded-card text-sm disabled:opacity-40 press-scale"
            >
              {loggingSavedMeal ? 'Logging...' : `Log to ${MEAL_LABELS[savedMealType]}`}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function MacroCard({ label, value, target, unit, token, direction }) {
  const isLimit = direction === 'limit';
  const over = isLimit && value > target;

  return (
    <div
      className="rounded-card p-3"
      style={{ background: `color-mix(in oklab, var(--${token}) 13%, transparent)` }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-tx-3 mb-1">{label}</p>
      <p className="text-[19px] font-num font-semibold leading-tight" style={{ color: over ? 'var(--danger)' : `var(--${token})` }}>
        {Math.round(value)}
      </p>
      <p className="text-[10px] text-tx-3 mt-0.5">
        {isLimit ? 'limit' : 'of'} {Math.round(target)} {unit}
      </p>
    </div>
  );
}

function MealSection({ type, label, color, entries, onAdd, onDelete, onCopyYesterday, onEdit }) {
  const total = entries.reduce((s, e) => ({ cal: s.cal + e.calories, pro: s.pro + e.protein_g }), { cal: 0, pro: 0 });

  return (
    <div className="bg-card rounded-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hair">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm text-tx">{label}</span>
          {entries.length > 0 && (
            <span className="text-xs text-tx-3">{Math.round(total.cal)} kcal</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onCopyYesterday && (
            <button
              onClick={onCopyYesterday}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-card-2 text-tx-3 text-xs press-scale"
              title="Copy previous day"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </button>
          )}
          <button
            onClick={onAdd}
            className="w-7 h-7 flex items-center justify-center rounded-full text-lg leading-none press-scale"
            style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color: color }}
          >
            +
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <button onClick={onAdd} className="w-full px-4 py-3 text-sm text-left press-scale" style={{ color }}>
          + Add to {label}
        </button>
      ) : (
        <>
          <div className="divide-y divide-hair">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center px-4 py-2.5">
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => onEdit?.(entry)}
                >
                  <p className="text-sm text-tx truncate">
                    {entry.quantity !== 1 ? `${entry.quantity}x ` : ''}{entry.food_name}
                  </p>
                  <p className="text-xs text-tx-3">{Math.round(entry.calories)} kcal · {Math.round(entry.protein_g)}g protein</p>
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="ml-3 text-tx-3 text-lg leading-none active:text-danger"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button onClick={onAdd} className="w-full px-4 py-2.5 text-sm text-left border-t border-hair press-scale" style={{ color }}>
            + Add to {label}
          </button>
        </>
      )}
    </div>
  );
}

function FoodSearchSheet({ open, onClose, mealType, onLogged, targetDate }) {
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

  // When Drinks meal slot is active, only show alcohol + beverage categories
  const drinkCategories = mealType === 'drinks' ? 'alcohol,beverage' : undefined;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      Promise.all([
        api.searchFoods('', drinkCategories),
        api.getFavorites(drinkCategories),
        api.getRecents(drinkCategories),
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
      const r = await api.searchFoods(query, drinkCategories);
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
        ...(targetDate && { date: targetDate }),
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
    const [favs, all] = await Promise.all([api.getFavorites(drinkCategories), api.searchFoods(query, drinkCategories)]);
    setFavorites(favs);
    setResults(all);
  }

  function selectFood(food) {
    setSelected(food);
    setQty('1');
    const units = food.units ? JSON.parse(food.units) : null;
    setSelectedUnit(food.default_unit || (units ? units[0]?.unit : null));
  }

  const mealColor = MEAL_COLORS[mealType] || 'var(--cal)';
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

  const showFavsRecents = !query && (favorites.length > 0 || recents.length > 0);

  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${MEAL_LABELS[mealType]}`} height="full">
      <div className="flex flex-col h-full">
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search foods..."
              className="w-full pl-9 pr-4 py-2.5 rounded-card border border-hair text-sm text-tx focus:outline-none bg-card-2"
              style={{ '--tw-ring-color': mealColor }}
            />
          </div>
        </div>

        {selected && (
          <div className="mx-4 mb-3 rounded-card p-3 flex-shrink-0 border"
            style={{
              background: `color-mix(in oklab, ${mealColor} 10%, transparent)`,
              borderColor: `color-mix(in oklab, ${mealColor} 25%, transparent)`,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-tx">{selected.name}</p>
                <p className="text-xs text-tx-3">{selected.serving_unit}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-tx-3 text-lg">×</button>
            </div>

            {units && units.length > 1 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-none">
                {units.map(u => (
                  <button
                    key={u.unit}
                    onClick={() => setSelectedUnit(u.unit)}
                    className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-colors ${
                      selectedUnit === u.unit
                        ? 'border-current'
                        : 'border-hair text-tx-3'
                    }`}
                    style={selectedUnit === u.unit ? { color: mealColor, borderColor: mealColor } : undefined}
                  >
                    {u.unit}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-2">
              <label className="text-xs text-tx-3">Qty:</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(q => String(Math.max(0.25, (parseFloat(q) || 1) - 0.25)))} className="w-7 h-7 rounded-lg bg-card-2 text-tx text-sm press-scale">-</button>
                <input
                  type="number"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-14 text-center px-1 py-1 rounded-lg border border-hair text-sm text-tx bg-card focus:outline-none"
                  step="0.25"
                  min="0.25"
                />
                <button onClick={() => setQty(q => String((parseFloat(q) || 1) + 0.25))} className="w-7 h-7 rounded-lg bg-card-2 text-tx text-sm press-scale">+</button>
              </div>
              {multiplied && (
                <span className="text-xs text-tx-3 ml-auto">{multiplied.cal} kcal · {multiplied.pro}g pro</span>
              )}
            </div>
            <button
              onClick={handleLog}
              disabled={saving}
              className="w-full mt-3 py-2.5 text-white rounded-card text-sm disabled:opacity-40 press-scale"
              style={{ backgroundColor: mealColor }}
            >
              {saving ? 'Adding...' : `Add to ${MEAL_LABELS[mealType]}`}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {showFavsRecents && favorites.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-tx-3 mb-1.5 px-1">Favorites</p>
              <div className="space-y-1">
                {favorites.map(food => (
                  <FoodRow key={food.id} food={food} selected={selected} onSelect={selectFood} onToggleFavorite={handleToggleFavorite} mealColor={mealColor} />
                ))}
              </div>
            </div>
          )}

          {showFavsRecents && recents.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-tx-3 mb-1.5 px-1">Recent</p>
              <div className="space-y-1">
                {recents.filter(r => !favorites.find(f => f.id === r.id)).slice(0, 10).map(food => (
                  <FoodRow key={food.id} food={food} selected={selected} onSelect={selectFood} onToggleFavorite={handleToggleFavorite} mealColor={mealColor} />
                ))}
              </div>
            </div>
          )}

          {showFavsRecents && <div className="border-t border-hair my-3" />}

          {searching && <p className="text-sm text-tx-3 text-center py-4">Searching...</p>}
          {!searching && results.length === 0 && (
            <p className="text-sm text-tx-3 text-center py-4">No foods found. Try a different search.</p>
          )}
          <div className="space-y-1">
            {results.map(food => (
              <FoodRow key={food.id} food={food} selected={selected} onSelect={selectFood} onToggleFavorite={handleToggleFavorite} mealColor={mealColor} />
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function FoodRow({ food, selected, onSelect, onToggleFavorite, mealColor }) {
  const isSelected = selected?.id === food.id;
  return (
    <button
      onClick={() => onSelect(food)}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-card text-left transition-colors ${
        isSelected ? 'border' : 'bg-card border border-transparent'
      }`}
      style={isSelected ? {
        background: `color-mix(in oklab, ${mealColor} 10%, transparent)`,
        borderColor: `color-mix(in oklab, ${mealColor} 25%, transparent)`,
      } : undefined}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-tx truncate">{food.name}</p>
        <p className="text-xs text-tx-3">{food.serving_unit}</p>
      </div>
      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
        <button
          onClick={(e) => onToggleFavorite(food, e)}
          className="text-sm"
          aria-label={food.is_favorite ? 'Unfavorite' : 'Favorite'}
        >
          <span style={{ color: food.is_favorite ? 'var(--star)' : 'var(--hair)' }}>
            {food.is_favorite ? '★' : '☆'}
          </span>
        </button>
        <div className="text-right">
          <p className="text-sm font-num text-tx">{Math.round(food.calories)}</p>
          <p className="text-xs text-tx-3">kcal</p>
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
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 bg-points text-white rounded-card text-sm disabled:opacity-40 press-scale"
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
      <label className="text-xs text-tx-3 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-card border border-hair text-sm text-tx focus:outline-none bg-card"
      />
    </div>
  );
}

function EditEntrySheet({ open, onClose, entry, mealColor, onSaved, onDeleted }) {
  const [food, setFood] = useState(null);
  const [qty, setQty] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && entry) {
      setQty(String(entry.quantity));
      setSelectedUnit(entry.unit_used);
      if (entry.food_id) {
        api.getFood(entry.food_id).then(setFood).catch(() => setFood(null));
      } else {
        setFood(null);
      }
    }
  }, [open, entry]);

  const units = food?.units ? JSON.parse(food.units) : null;
  const unitMultiplier = selectedUnit && units
    ? (units.find(u => u.unit === selectedUnit)?.multiplier || 1)
    : 1;
  const effectiveQty = (parseFloat(qty) || 1) * unitMultiplier;
  const multiplied = food ? {
    cal: Math.round(food.calories * effectiveQty),
    pro: Math.round(food.protein_g * effectiveQty * 10) / 10,
  } : null;

  async function handleSave() {
    if (!entry) return;
    setSaving(true);
    try {
      await api.updateFoodLog(entry.id, { quantity: parseFloat(qty) || 1, unit_used: selectedUnit });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    await api.deleteFoodLog(entry.id);
    onDeleted?.();
  }

  const color = mealColor || 'var(--cal)';

  return (
    <Sheet open={open} onClose={onClose} title="Edit entry">
      {entry && (
        <div className="px-5 pb-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-tx">{entry.food_name}</p>
            <p className="text-xs text-tx-3">{entry.unit_used || food?.serving_unit || 'default serving'}</p>
          </div>

          {units && units.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {units.map(u => (
                <button
                  key={u.unit}
                  onClick={() => setSelectedUnit(u.unit)}
                  className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-colors ${
                    selectedUnit === u.unit ? 'border-current' : 'border-hair text-tx-3'
                  }`}
                  style={selectedUnit === u.unit ? { color, borderColor: color } : undefined}
                >
                  {u.unit}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="text-xs text-tx-3">Qty:</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(q => String(Math.max(0.25, (parseFloat(q) || 1) - 0.25)))} className="w-7 h-7 rounded-lg bg-card-2 text-tx text-sm press-scale">-</button>
              <input
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                className="w-14 text-center px-1 py-1 rounded-lg border border-hair text-sm text-tx bg-card focus:outline-none"
                step="0.25"
                min="0.25"
              />
              <button onClick={() => setQty(q => String((parseFloat(q) || 1) + 0.25))} className="w-7 h-7 rounded-lg bg-card-2 text-tx text-sm press-scale">+</button>
            </div>
            {multiplied && (
              <span className="text-xs text-tx-3 ml-auto">{multiplied.cal} kcal · {multiplied.pro}g pro</span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 text-white rounded-card text-sm disabled:opacity-40 press-scale"
            style={{ backgroundColor: color }}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>

          <button
            onClick={handleDelete}
            className="w-full py-2.5 text-sm text-danger press-scale"
          >
            Delete entry
          </button>
        </div>
      )}
    </Sheet>
  );
}

export { MEAL_TYPES, MEAL_LABELS, MEAL_COLORS, MealSection, FoodSearchSheet, EditEntrySheet, CustomFoodSheet };
