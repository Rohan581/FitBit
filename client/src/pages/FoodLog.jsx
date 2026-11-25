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

const STATUS_COLOR = {
  good: 'var(--fiber)',
  warn: 'var(--warning)',
  bad: 'var(--danger)',
  todo: 'var(--text-3)',
};

const METRIC_TOKEN = {
  calories: 'cal', protein: 'protein', carbs: 'carbs',
  fat: 'fat', fiber: 'fiber', sugar: 'sugar',
};

const VALUE_UNIT = { calories: 'kcal', protein: 'g', carbs: 'g', fat: 'g', fiber: 'g', sugar: 'g' };

/**
 * Day review. The macro cards above already say 64 of 166 g; this says which
 * items are responsible, which is the only part you can act on.
 */
function DayReviewCard({ review, verdict }) {
  const [open, setOpen] = useState(true);
  if (!review?.length) return null;

  return (
    <div className="mb-3 rounded-card bg-card border border-hair overflow-hidden stagger-enter">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 press-scale"
      >
        <span className="text-xs font-semibold tracking-wide text-tx-3 uppercase">Day review</span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: STATUS_COLOR[verdict?.status] }}>
            {verdict?.text}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-tx-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-1">
          {review.map(note => (
            <div key={note.metric} className="flex gap-3 py-3 border-t border-hair">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                style={
                  note.status === 'todo'
                    ? { border: `2px solid ${STATUS_COLOR.todo}` }
                    : { backgroundColor: STATUS_COLOR[note.status] }
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-tx-3">
                  {note.metric === 'fiber' ? 'Fibre' : note.metric}
                </p>
                <p className={`text-sm leading-snug text-tx ${note.status === 'good' ? 'font-normal' : 'font-semibold'}`}>
                  {note.title}
                </p>
                {note.items?.length > 0 && (
                  <>
                    <p className="text-[11px] text-tx-3 mt-1.5">{note.lead}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {note.items.map((it, i) => (
                        <span
                          key={i}
                          className="inline-flex items-baseline gap-1.5 max-w-full rounded-full px-2.5 py-1 text-[11px]"
                          style={{ background: `color-mix(in oklab, var(--${METRIC_TOKEN[note.valueMetric]}) 13%, transparent)` }}
                        >
                          <span className="font-semibold text-tx truncate">{it.entry.food_name}</span>
                          <span className="font-num text-tx-2 whitespace-nowrap">
                            {Math.round(it.value)}{VALUE_UNIT[note.valueMetric]} · {Math.round(it.share * 100)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shrink a photo on the phone before it goes anywhere.
 *
 * Three reasons, in order of importance: re-encoding through a canvas drops all
 * EXIF, which is where the GPS coordinates of your house live; a 1280px JPEG is
 * a fraction of the upload; and the estimate is no better from a 12-megapixel
 * original than from this.
 */
function shrinkImage(file, maxEdge = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ base64: dataUrl.split(',')[1], preview: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

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

  const suggestionCards = suggestions?.cards || [];

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

      {/* Day review — not the score, but which items produced it */}
      <DayReviewCard review={logs.review} verdict={logs.verdict} />

      {/* Suggestion cards (max 2) */}
      {suggestionCards.map((card, idx) => (
        <SuggestionCard
          key={card.type + idx}
          card={card}
          onAddSuggestion={handleAddSuggestion}
          defaultMealType={suggestions?.default_meal_type}
        />
      ))}

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

function SuggestionCard({ card, onAddSuggestion }) {
  const color = card.color || 'var(--text-3)';

  // Type D: over-target
  if (card.type === 'over_target') {
    return (
      <div className="bg-card rounded-card overflow-hidden mb-3 stagger-enter">
        <div className="flex">
          <div className="w-[5px] flex-shrink-0" style={{ backgroundColor: 'var(--text-3)' }} />
          <div className="flex-1 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">
              {card.title}
            </p>
            <p className="text-sm text-tx-2">{card.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Type A: swap
  if (card.type === 'swap') {
    return (
      <div className="bg-card rounded-card overflow-hidden mb-3 stagger-enter">
        <div className="flex">
          <div className="w-[5px] flex-shrink-0" style={{ backgroundColor: color }} />
          <div className="flex-1 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color }}>
              {card.title}
            </p>
            <p className="text-sm text-tx-2">{card.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Type E: cooking fat
  if (card.type === 'cooking_fat') {
    return (
      <div className="bg-card rounded-card overflow-hidden mb-3 stagger-enter">
        <div className="flex">
          <div className="w-[5px] flex-shrink-0" style={{ backgroundColor: color }} />
          <div className="flex-1 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color }}>
              {card.title}
            </p>
            <p className="text-sm text-tx-2">{card.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Type B (gap) and C (headroom) — both have suggestions
  if (card.suggestions?.length > 0) {
    return (
      <div className="bg-card rounded-card overflow-hidden mb-3 stagger-enter">
        <div className="flex">
          <div className="w-[5px] flex-shrink-0" style={{ backgroundColor: color }} />
          <div className="flex-1 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color }}>
              {card.title}
            </p>
            <p className="text-sm text-tx mb-2">{card.message}</p>
            <div className="space-y-2">
              {card.suggestions.map(s => (
                <div key={s.food_id} className="flex items-center justify-between bg-card-2 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-tx truncate">{s.food_name}</p>
                    <p className="text-xs text-tx-3">{s.description}</p>
                  </div>
                  <button
                    onClick={() => onAddSuggestion(s)}
                    className="ml-2 px-3 py-1.5 rounded-full text-xs press-scale flex-shrink-0 font-medium"
                    style={{
                      background: `color-mix(in oklab, ${color} 14%, transparent)`,
                      color,
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
    );
  }

  return null;
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
                  className="flex-1 min-w-0 text-left press-scale"
                  onClick={() => onEdit?.(entry)}
                >
                  <p className="text-sm text-tx truncate">
                    {entry.quantity !== 1 ? `${entry.quantity}x ` : ''}{entry.food_name}
                  </p>
                  <p className="text-xs text-tx-3">
                    {Math.round(entry.calories)} kcal · {Math.round(entry.protein_g)}g protein
                    {entry.quick_add ? <span className="text-tx-3/50"> · logged without macros</span> : ''}
                  </p>
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="ml-3 text-tx-3 text-lg leading-none active:text-danger press-scale"
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
  const [quickAdds, setQuickAdds] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [recipeResults, setRecipeResults] = useState({ recipes: [], batches: [] });
  // 'search' | 'quick' | 'paste'
  const [mode, setMode] = useState('search');
  const showQuickAdd = mode === 'quick';
  const [qaName, setQaName] = useState('');
  const [qaCal, setQaCal] = useState('');
  const [qaSaving, setQaSaving] = useState(false);
  const inputRef = useRef(null);

  // Paste-to-log, and the photo/description estimate that feeds the same cards
  const [pasteText, setPasteText] = useState('');
  const [pasteRows, setPasteRows] = useState(null);   // null = not parsed yet
  const [pasteErrors, setPasteErrors] = useState([]);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [photo, setPhoto] = useState(null);           // { base64, preview }
  const [photoNote, setPhotoNote] = useState('');
  const [estimateErr, setEstimateErr] = useState('');
  const [estimateModel, setEstimateModel] = useState('');
  const [aiReady, setAiReady] = useState(null);       // null = unknown yet
  const fileRef = useRef(null);

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
        // Handle both old array format and new { foods, quick_adds } format
        if (Array.isArray(rec)) {
          setRecents(rec);
        } else {
          setRecents(rec.foods || []);
          setQuickAdds(rec.quick_adds || []);
        }
      });
      if (mealType !== 'drinks') {
        api.searchRecipesForFoodLog('').then(setRecipeResults).catch(() => {});
      }
    } else {
      setQuery('');
      setSelected(null);
      setQty('1');
      setSelectedUnit(null);
      setRecipeResults({ recipes: [], batches: [] });
      setMode('search');
      setQaName('');
      setQaCal('');
      setPasteText('');
      setPasteRows(null);
      setPasteErrors([]);
      setPhoto(null);
      setPhotoNote('');
      setEstimateErr('');
      setEstimateModel('');
    }
  }, [open]);

  // Only offer the estimate tab if the server actually has a key.
  useEffect(() => {
    if (!open || aiReady !== null) return;
    api.estimateStatus().then(s => setAiReady(!!s.configured)).catch(() => setAiReady(false));
  }, [open, aiReady]);

  async function handlePickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEstimateErr('');
    try {
      setPhoto(await shrinkImage(file));
    } catch (err) {
      setEstimateErr(err.message);
    }
  }

  // Photo and/or description -> Gemini -> the same editable cards as a paste.
  async function handleEstimate() {
    if (!photo && !photoNote.trim()) return;
    setPasteBusy(true);
    setEstimateErr('');
    try {
      const r = await api.estimateMeal({
        ...(photo ? { image: photo.base64, mime_type: 'image/jpeg' } : {}),
        ...(photo ? { note: photoNote } : { description: photoNote }),
      });
      setPasteRows(r.entries.map((en, i) => ({ ...en, _key: i, meal_type: en.mealGuessed ? mealType : en.meal_type })));
      setPasteErrors(r.errors || []);
      setEstimateModel(r.model || '');
    } catch (err) {
      setEstimateErr(err.message || 'Could not get an estimate');
    } finally {
      setPasteBusy(false);
    }
  }

  // Parse pasted text into editable rows. Nothing is saved until Save is tapped.
  async function handleParse() {
    if (!pasteText.trim()) return;
    setPasteBusy(true);
    try {
      const { entries, errors } = await api.parseFoodText(pasteText);
      setPasteRows(entries.map((e, i) => ({ ...e, _key: i, meal_type: e.mealGuessed ? mealType : e.meal_type })));
      setPasteErrors(errors);
    } catch (err) {
      setPasteErrors([{ line: 0, raw: '', error: err.message || 'Could not parse that' }]);
      setPasteRows([]);
    } finally {
      setPasteBusy(false);
    }
  }

  function updatePasteRow(key, field, value) {
    setPasteRows(rows => rows.map(r => (r._key === key ? { ...r, [field]: value } : r)));
  }

  async function handleSavePasted() {
    if (!pasteRows?.length) return;
    setPasteBusy(true);
    try {
      for (const r of pasteRows) {
        await api.logFood({
          date: targetDate,
          meal_type: r.meal_type,
          food_name: r.food_name,
          calories: Number(r.calories) || 0,
          protein_g: Number(r.protein_g) || 0,
          carbs_g: Number(r.carbs_g) || 0,
          fat_g: Number(r.fat_g) || 0,
          fiber_g: Number(r.fiber_g) || 0,
          sugar_g: Number(r.sugar_g) || 0,
        });
      }
      onLogged?.();
      onClose?.();
    } finally {
      setPasteBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      const r = await api.searchFoods(query, drinkCategories);
      setResults(r);
      setSearching(false);
      if (mealType !== 'drinks') {
        api.searchRecipesForFoodLog(query).then(setRecipeResults).catch(() => {});
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  async function handleLog() {
    if (!selected) return;
    setSaving(true);
    try {
      if (selected._recipeType) {
        await api.logPortion({
          recipe_id: selected._recipeType === 'batch' ? selected.recipe_id : selected.id,
          batch_id: selected._recipeType === 'batch' ? selected.id : undefined,
          servings: parseFloat(qty) || 1,
          meal_type: mealType,
          ...(targetDate && { date: targetDate }),
        });
      } else {
        await api.logFood({
          food_id: selected.id,
          quantity: parseFloat(qty) || 1,
          meal_type: mealType,
          unit_used: selectedUnit,
          ...(targetDate && { date: targetDate }),
        });
      }
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
    if (food._recipeType) {
      setSelectedUnit(null);
    } else {
      const units = food.units ? JSON.parse(food.units) : null;
      setSelectedUnit(food.default_unit || (units ? units[0]?.unit : null));
    }
  }

  const mealColor = MEAL_COLORS[mealType] || 'var(--cal)';
  const units = selected?.units && !selected._recipeType ? JSON.parse(selected.units) : null;
  const unitMultiplier = selectedUnit && units
    ? (units.find(u => u.unit === selectedUnit)?.multiplier || 1)
    : 1;
  const effectiveQty = (parseFloat(qty) || 1) * unitMultiplier;

  const multiplied = selected ? (() => {
    if (selected._recipeType === 'batch') {
      const ps = selected.per_serving || {};
      const scale = selected.scale_factor || 1;
      const recipeSrv = selected.recipe_servings || 1;
      const portions = selected.portions || 1;
      const ppCal = (ps.calories || 0) * recipeSrv * scale / portions;
      const ppPro = (ps.protein_g || 0) * recipeSrv * scale / portions;
      const q = parseFloat(qty) || 1;
      return { cal: Math.round(ppCal * q), pro: Math.round(ppPro * q * 10) / 10 };
    }
    if (selected._recipeType === 'recipe') {
      const ps = selected.per_serving || {};
      const q = parseFloat(qty) || 1;
      return { cal: Math.round((ps.calories || 0) * q), pro: Math.round((ps.protein_g || 0) * q * 10) / 10 };
    }
    return {
      cal: Math.round(selected.calories * effectiveQty),
      pro: Math.round(selected.protein_g * effectiveQty * 10) / 10,
      fiber: Math.round((selected.fiber_g || 0) * effectiveQty * 10) / 10,
    };
  })() : null;

  const showFavsRecents = !query && mode === 'search' && (favorites.length > 0 || recents.length > 0);

  async function handleQuickAdd() {
    if (!qaName || !qaCal) return;
    setQaSaving(true);
    try {
      await api.logFood({
        food_name: qaName.trim(),
        calories: parseFloat(qaCal),
        meal_type: mealType,
        quick_add: true,
        ...(targetDate && { date: targetDate }),
      });
      onLogged?.();
      onClose();
    } finally {
      setQaSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Add to ${MEAL_LABELS[mealType]}`} height="full">
      <div className="flex flex-col h-full">
        {/* Tab strip: Search / Quick add / Paste */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex rounded-card border border-hair overflow-hidden mb-3">
            {[
              { id: 'search', label: 'Search' },
              { id: 'quick', label: 'Quick' },
              { id: 'paste', label: 'Paste' },
              ...(aiReady ? [{ id: 'estimate', label: 'Photo' }] : []),
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  mode === t.id ? 'text-white' : 'text-tx-3 bg-card-2'
                }`}
                style={mode === t.id ? { backgroundColor: mealColor } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mode === 'search' && (
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
          )}
        </div>

        {/* Quick add form */}
        {showQuickAdd && (
          <div className="mx-4 mb-3 flex-shrink-0">
            <p className="text-xs text-tx-3 mb-3">Log calories only — no food entry needed</p>
            <div className="space-y-2">
              <input type="text" placeholder="What did you eat?" value={qaName} onChange={e => setQaName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-card border border-hair text-sm text-tx bg-card-2 focus:outline-none" autoFocus />
              <input type="number" placeholder="Calories" value={qaCal} onChange={e => setQaCal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-card border border-hair text-sm font-num text-tx bg-card-2 focus:outline-none" />
              <button onClick={handleQuickAdd} disabled={!qaName || !qaCal || qaSaving}
                className="w-full py-2.5 rounded-card text-sm text-white disabled:opacity-40 press-scale"
                style={{ backgroundColor: mealColor }}
              >
                {qaSaving ? 'Logging...' : 'Log it'}
              </button>
            </div>

            {/* Quick-add recents */}
            {quickAdds.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] text-tx-3 mb-1.5">Recent quick adds</p>
                <div className="space-y-1">
                  {quickAdds.map(qa => (
                    <button key={qa.name} onClick={() => { setQaName(qa.name); setQaCal(String(Math.round(qa.calories))); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-card-2 press-scale">
                      <span className="text-sm text-tx truncate">{qa.name}</span>
                      <span className="text-xs font-num text-tx-3 ml-2">{Math.round(qa.calories)} kcal</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paste a line of macros — from a chat, a message, a label you typed out.
            Parsed by plain code on the server; nothing saves until Save is tapped. */}
        {(mode === 'paste' || mode === 'estimate') && (
          <div className="mx-4 mb-3 flex-1 min-h-0 overflow-y-auto">
            {!pasteRows && mode === 'paste' && (
              <>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder={'Dinner | Chicken 65, half plate | 350 kcal | 21g P | 11g C | 23g F | 1g Fib'}
                  className="w-full px-3 py-2.5 rounded-card border border-hair text-sm text-tx bg-card-2 focus:outline-none resize-none leading-relaxed"
                />
                <p className="text-[11px] text-tx-3 mt-2 leading-relaxed">
                  One item per line. Only calories are required — anything missing stays blank rather than
                  counting as zero. Meal, order and labels are flexible (<span className="font-num">32g P</span> or{' '}
                  <span className="font-num">Protein 32g</span>), ranges become their midpoint, and markdown is ignored.
                </p>
                <button
                  onClick={handleParse}
                  disabled={!pasteText.trim() || pasteBusy}
                  className="w-full mt-3 py-2.5 rounded-card text-sm text-white disabled:opacity-40 press-scale"
                  style={{ backgroundColor: mealColor }}
                >
                  {pasteBusy ? 'Reading…' : 'Read it'}
                </button>
              </>
            )}

            {/* Photo or description estimate. A first draft you correct — it goes
                through the same editable cards and saves nothing on its own. */}
            {!pasteRows && mode === 'estimate' && (
              <>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePickPhoto} className="hidden" />

                {photo ? (
                  <div className="relative">
                    <img src={photo.preview} alt="" className="w-full max-h-52 object-cover rounded-card" />
                    <button
                      onClick={() => setPhoto(null)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white text-lg leading-none press-scale"
                      aria-label="Remove photo"
                    >×</button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-8 rounded-card border border-dashed border-hair text-sm text-tx-3 press-scale"
                  >
                    Take or choose a photo
                  </button>
                )}

                <textarea
                  value={photoNote}
                  onChange={e => setPhotoNote(e.target.value)}
                  rows={2}
                  placeholder={photo ? 'Optional: "I only ate half", "no oil"' : 'Or just describe it: "2 rotis, dal, half a bowl of curd"'}
                  className="w-full mt-2 px-3 py-2.5 rounded-card border border-hair text-sm text-tx bg-card-2 focus:outline-none resize-none"
                />

                {estimateErr && <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{estimateErr}</p>}

                <button
                  onClick={handleEstimate}
                  disabled={(!photo && !photoNote.trim()) || pasteBusy}
                  className="w-full mt-3 py-2.5 rounded-card text-sm text-white disabled:opacity-40 press-scale"
                  style={{ backgroundColor: mealColor }}
                >
                  {pasteBusy ? 'Estimating…' : 'Estimate'}
                </button>

                <p className="text-[11px] text-tx-3 mt-2 leading-relaxed">
                  Shrunk on your phone and stripped of location data before it is sent to Google for
                  an estimate. On the free tier Google may use it to improve their products. Portion
                  size and oil are guesses — check the numbers before saving.
                </p>
              </>
            )}

            {pasteRows && (
              <>
                {pasteErrors.length > 0 && (
                  <div className="mb-3 rounded-card p-3 border" style={{ borderColor: 'var(--danger)', background: 'color-mix(in oklab, var(--danger) 10%, transparent)' }}>
                    <p className="text-xs font-semibold text-tx mb-1">
                      {pasteErrors.length} line{pasteErrors.length > 1 ? 's' : ''} couldn’t be read
                    </p>
                    {pasteErrors.map(e => (
                      <p key={e.line} className="text-[11px] text-tx-2 truncate">
                        {e.raw ? `“${e.raw}” — ` : ''}{e.error}
                      </p>
                    ))}
                  </div>
                )}

                {pasteRows.length === 0 && (
                  <p className="text-sm text-tx-3 py-4 text-center">Nothing recognisable in that. Edit and try again.</p>
                )}

                <div className="space-y-3">
                  {pasteRows.map(r => (
                    <div key={r._key} className="rounded-card border border-hair p-3 bg-card-2">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          value={r.food_name}
                          onChange={e => updatePasteRow(r._key, 'food_name', e.target.value)}
                          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-card text-sm text-tx border border-hair focus:outline-none"
                        />
                        <select
                          value={r.meal_type}
                          onChange={e => updatePasteRow(r._key, 'meal_type', e.target.value)}
                          className="px-2 py-1.5 rounded-lg bg-card text-xs text-tx border border-hair focus:outline-none"
                        >
                          {MEAL_TYPES.map(m => <option key={m} value={m}>{MEAL_LABELS[m]}</option>)}
                        </select>
                        <button
                          onClick={() => setPasteRows(rows => rows.filter(x => x._key !== r._key))}
                          className="text-tx-3 text-lg leading-none px-1 press-scale"
                          aria-label="Remove"
                        >×</button>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[
                          ['calories', 'kcal'], ['protein_g', 'P'], ['carbs_g', 'C'],
                          ['fat_g', 'F'], ['fiber_g', 'Fib'], ['sugar_g', 'Sug'],
                        ].map(([field, label]) => (
                          <label key={field} className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-tx-3 text-center">{label}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={r[field] ?? ''}
                              placeholder="—"
                              onChange={e => updatePasteRow(r._key, field, e.target.value === '' ? null : e.target.value)}
                              className="w-full px-1 py-1.5 rounded-lg bg-card text-sm font-num text-tx text-center border border-hair focus:outline-none"
                            />
                          </label>
                        ))}
                      </div>
                      {r.warnings?.length > 0 && (
                        <p className="text-[10px] text-tx-3 mt-1.5">{r.warnings.join(' · ')}</p>
                      )}
                    </div>
                  ))}
                </div>

                {estimateModel && (
                  <p className="text-[10px] text-tx-3 mt-2">Estimated by {estimateModel} — check before saving.</p>
                )}

                <div className="flex gap-2 mt-3 pb-2">
                  <button
                    onClick={() => { setPasteRows(null); setPasteErrors([]); setEstimateModel(''); }}
                    className="px-4 py-2.5 rounded-card text-sm text-tx-2 bg-card-2 border border-hair press-scale"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSavePasted}
                    disabled={!pasteRows.length || pasteBusy}
                    className="flex-1 py-2.5 rounded-card text-sm text-white disabled:opacity-40 press-scale"
                    style={{ backgroundColor: mealColor }}
                  >
                    {pasteBusy ? 'Saving…' : `Save ${pasteRows.length} item${pasteRows.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {selected && mode === 'search' && (
          <div className="mx-4 mb-3 rounded-card p-3 flex-shrink-0 border"
            style={{
              background: `color-mix(in oklab, ${mealColor} 10%, transparent)`,
              borderColor: `color-mix(in oklab, ${mealColor} 25%, transparent)`,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-tx">
                  {selected._recipeType && <span className="mr-1">{selected.icon || '🍳'}</span>}
                  {selected._recipeType ? selected.title : selected.name}
                </p>
                <p className="text-xs text-tx-3">
                  {selected._recipeType === 'batch'
                    ? `batch · ${new Date(selected.cooked_on).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${selected.portions_left ?? selected.portions} portions left`
                    : selected._recipeType === 'recipe'
                    ? `${selected.servings || 1} serving${(selected.servings || 1) > 1 ? 's' : ''} per recipe`
                    : selected.serving_unit}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-tx-3 text-lg press-scale">×</button>
            </div>

            {!selected._recipeType && units && units.length > 1 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-none">
                {units.map(u => (
                  <button
                    key={u.unit}
                    onClick={() => setSelectedUnit(u.unit)}
                    className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-colors press-scale ${
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

        <div className={`flex-1 overflow-y-auto px-4 pb-4 ${mode === 'paste' || mode === 'estimate' ? 'hidden' : ''}`}>
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

          {/* Recipe & batch results */}
          {mealType !== 'drinks' && (recipeResults.batches.length > 0 || recipeResults.recipes.length > 0) && (
            <div className="mb-3">
              <p className="text-[11px] text-tx-3 mb-1.5 px-1 flex items-center gap-1">
                <span>🧑‍🍳</span> Recipes
              </p>
              <div className="space-y-1">
                {recipeResults.batches.map(b => (
                  <RecipeResultRow
                    key={`batch-${b.id}`}
                    item={{ ...b, _recipeType: 'batch' }}
                    selected={selected}
                    onSelect={selectFood}
                    mealColor={mealColor}
                  />
                ))}
                {recipeResults.recipes.map(r => (
                  <RecipeResultRow
                    key={`recipe-${r.id}`}
                    item={{ ...r, _recipeType: 'recipe' }}
                    selected={selected}
                    onSelect={selectFood}
                    mealColor={mealColor}
                  />
                ))}
              </div>
              <div className="border-t border-hair my-3" />
            </div>
          )}

          {searching && <p className="text-sm text-tx-3 text-center py-4">Searching...</p>}
          {!searching && results.length === 0 && (recipeResults.recipes.length === 0 && recipeResults.batches.length === 0) && (
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
      className={`w-full flex items-center justify-between px-4 py-3 rounded-card text-left transition-colors press-scale ${
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
          className="text-sm press-scale"
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

function RecipeResultRow({ item, selected, onSelect, mealColor }) {
  const isSelected = selected?._recipeType === item._recipeType &&
    ((item._recipeType === 'batch' && selected?.id === item.id) ||
     (item._recipeType === 'recipe' && selected?.id === item.id));
  const ps = item.per_serving || {};
  const isBatch = item._recipeType === 'batch';

  let subtitle = '';
  if (isBatch) {
    const d = new Date(item.cooked_on);
    subtitle = `batch ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else {
    subtitle = `${Math.round(ps.calories || 0)} kcal · ${Math.round(ps.protein_g || 0)}g pro per serving`;
  }

  const displayCal = isBatch
    ? Math.round((ps.calories || 0) * (item.recipe_servings || 1) * (item.scale_factor || 1) / (item.portions || 1))
    : Math.round(ps.calories || 0);

  return (
    <button
      onClick={() => onSelect(item)}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-card text-left transition-colors press-scale ${
        isSelected ? 'border' : 'bg-card border border-transparent'
      }`}
      style={isSelected ? {
        background: `color-mix(in oklab, ${mealColor} 10%, transparent)`,
        borderColor: `color-mix(in oklab, ${mealColor} 25%, transparent)`,
      } : undefined}
    >
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <span className="text-base flex-shrink-0">{item.icon || '🍳'}</span>
        <div className="min-w-0">
          <p className="text-sm text-tx truncate">{item.title}</p>
          <p className="text-xs text-tx-3">{subtitle}</p>
        </div>
      </div>
      <div className="text-right ml-3 flex-shrink-0">
        <p className="text-sm font-num text-tx">{displayCal}</p>
        <p className="text-xs text-tx-3">kcal</p>
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
