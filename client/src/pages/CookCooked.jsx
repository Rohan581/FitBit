import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

function getMealTypeByTime() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

/* ── Stepper ───────────────────────────────────────────── */

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
      <span className="font-num text-tx min-w-[2rem] text-center">
        {value % 1 === 0 ? value : value.toFixed(1)}
      </span>
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
            style={{
              background: `color-mix(in oklab, var(${m.color}) 12%, transparent)`,
              borderLeft: `3px solid var(${m.color})`,
            }}
          >
            <div className="font-num text-sm font-semibold text-tx">
              {Math.round(val)}{m.key !== 'calories' ? 'g' : ''}
            </div>
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

function LogPortionSheet({ open, onClose, batch, onLogged }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('servings');
  const [servingsVal, setServingsVal] = useState(1);
  const [gramsVal, setGramsVal] = useState(100);
  const [mealType, setMealType] = useState(getMealTypeByTime);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (open) {
      setServingsVal(1);
      setGramsVal(100);
      setMealType(getMealTypeByTime());
      setMode('servings');
      setToast(null);
    }
  }, [open]);

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  if (!batch) return null;

  const ps = batch.per_serving || {};
  const totalBatch = {};
  MACROS.forEach(m => {
    totalBatch[m.key] = (ps[m.key] || 0) * (batch.recipe_servings || 1) * (batch.scale_factor || 1);
  });

  const portionMacros = {};
  if (mode === 'servings') {
    const portions = batch.portions || 1;
    MACROS.forEach(m => { portionMacros[m.key] = (totalBatch[m.key] / portions) * servingsVal; });
  } else {
    const yieldG = batch.measured_weight_g || (batch.recipe_yield_g || 500) * (batch.scale_factor || 1);
    MACROS.forEach(m => { portionMacros[m.key] = yieldG > 0 ? (totalBatch[m.key] / yieldG) * gramsVal : 0; });
  }

  async function handleLog() {
    setSaving(true);
    try {
      const body = {
        recipe_id: batch.recipe_id,
        batch_id: batch.id,
        meal_type: mealType,
        ...(mode === 'servings' ? { servings: servingsVal } : { grams: gramsVal }),
      };
      await api.logPortion(body);
      const msg = `Added to ${MEAL_LABELS[mealType]} \u00B7 ${Math.round(portionMacros.calories)} kcal \u00B7 ${Math.round(portionMacros.protein_g)}g protein`;
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        setToast(null);
        onClose();
        if (onLogged) onLogged();
      }, 4000);
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
          <Stepper value={servingsVal} onChange={setServingsVal} min={0.5} step={0.5} label="Servings" />
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
            <button
              onClick={() => navigate('/food')}
              className="text-xs font-medium ml-3 whitespace-nowrap"
              style={{ color: 'var(--cook)' }}
            >
              View food log &rarr;
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ══════════════════════════════════════════════════════════
   ActiveBatchCard
   ══════════════════════════════════════════════════════════ */

function ActiveBatchCard({ batch, onLog, onFinish }) {
  const [finishing, setFinishing] = useState(false);
  const allLogged = batch.portions_left != null && batch.portions_left <= 0;

  async function handleFinish() {
    setFinishing(true);
    try {
      await api.updateBatch(batch.id, { finished: true });
      onFinish();
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="bg-card border border-hair rounded-[20px] p-3.5">
      {/* Top row: icon, title, meta */}
      <div className="flex items-start gap-2.5">
        {batch.icon && <span className="text-2xl flex-shrink-0 mt-0.5">{batch.icon}</span>}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[14.5px] text-tx block truncate">{batch.title}</span>
          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-tx-3">
            <span>{formatDate(batch.cooked_on)}</span>
            {batch.portions != null && <span>{batch.portions} portions</span>}
            {batch.measured_weight_g != null && <span>{batch.measured_weight_g}g</span>}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {batch.portions_left != null && (
          <span className="text-[12.5px] font-medium text-tx-2">
            {allLogged ? 'All portions logged' : `${batch.portions_left} portion${batch.portions_left !== 1 ? 's' : ''} left`}
          </span>
        )}
        {batch.per_portion_calories != null && (
          <span className="text-[12.5px] font-semibold font-num" style={{ color: 'var(--cal)' }}>
            {Math.round(batch.per_portion_calories)} kcal
          </span>
        )}
        {batch.per_portion_protein != null && (
          <span className="text-[12.5px] font-semibold font-num" style={{ color: 'var(--protein)' }}>
            {Math.round(batch.per_portion_protein)}g protein
          </span>
        )}
        {batch.per_100g_calories != null && (
          <span className="text-[12.5px] font-semibold font-num text-tx-3">
            {Math.round(batch.per_100g_calories)} kcal/100g
          </span>
        )}
      </div>

      {/* Suggestion when all logged */}
      {allLogged && (
        <p className="text-[12px] text-tx-3 mt-2">
          All done? Mark this batch as finished.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onLog(batch)}
          className="flex-1 py-2 rounded-xl font-medium text-sm press-scale"
          style={{ background: 'var(--cook)', color: 'var(--on-accent)' }}
        >
          Log a portion
        </button>
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="py-2 px-4 rounded-xl font-medium text-sm bg-card-2 text-tx-2 press-scale"
        >
          {finishing ? 'Done...' : 'Finished'}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   FinishedBatchCard
   ══════════════════════════════════════════════════════════ */

function FinishedBatchCard({ batch }) {
  const navigate = useNavigate();

  return (
    <div className="bg-card border border-hair rounded-[20px] p-3.5 opacity-70">
      <div className="flex items-center gap-2.5">
        {batch.icon && <span className="text-2xl flex-shrink-0">{batch.icon}</span>}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[14.5px] text-tx truncate block">{batch.title}</span>
          <span className="text-[12px] text-tx-3">{formatDate(batch.cooked_on)}</span>
        </div>
        <button
          onClick={() => navigate(`/cook/recipes/${batch.recipe_id}`)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium press-scale whitespace-nowrap"
          style={{ background: 'var(--cook-dim)', color: 'var(--cook)' }}
        >
          Cook again
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CookCooked — main export
   ══════════════════════════════════════════════════════════ */

export default function CookCooked({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logBatch, setLogBatch] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getBatches();
      setData(result);
    } catch {
      setError('Could not load batches');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => { load(); }, [load]);

  // Refresh on window focus
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // Split batches: active = not finished AND cooked within 4 days
  // Finished = marked finished OR cooked > 4 days ago
  const now = Date.now();
  const allActive = (data?.active || []).filter(b => {
    if (b.finished) return false;
    const age = now - new Date(b.cooked_on).getTime();
    return age <= FOUR_DAYS_MS;
  });
  const allFinished = [
    ...(data?.finished || []),
    ...(data?.active || []).filter(b => {
      if (b.finished) return true;
      const age = now - new Date(b.cooked_on).getTime();
      return age > FOUR_DAYS_MS;
    }),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 flex-shrink-0">
        {onOpenSidebar && <SidebarTrigger onClick={onOpenSidebar} />}
        <h1 className="font-num text-[22px] font-bold tracking-[-0.02em] text-tx">Cooked</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Loading */}
        {loading && !data && (
          <div className="flex justify-center items-center h-40">
            <div
              className="w-7 h-7 border-2 border-hair rounded-full animate-spin"
              style={{ borderTopColor: 'var(--cook)' }}
            />
          </div>
        )}

        {/* Error */}
        {error && !data && (
          <div className="p-4 text-center">
            <p className="text-tx-3 text-sm mb-3">{error}</p>
            <button onClick={load} className="text-sm font-medium press-scale" style={{ color: 'var(--cook)' }}>
              Retry
            </button>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-4">
            {/* Active batches */}
            <div>
              <h2 className="text-[13px] font-bold tracking-[0.05em] text-tx-2 uppercase mb-3 px-1">
                Active batches
              </h2>

              {allActive.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {allActive.map(b => (
                    <ActiveBatchCard
                      key={b.id}
                      batch={b}
                      onLog={setLogBatch}
                      onFinish={load}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-card border border-hair rounded-[20px] p-6 text-center">
                  <p className="text-sm text-tx-3 mb-2">Nothing cooking right now</p>
                  <button
                    onClick={() => navigate('/cook/recipes')}
                    className="text-sm font-medium press-scale"
                    style={{ color: 'var(--cook)' }}
                  >
                    Browse recipes &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* Finished batches */}
            {allFinished.length > 0 && (
              <div>
                <h2 className="text-[13px] font-bold tracking-[0.05em] text-tx-3 uppercase mb-3 px-1">
                  Finished
                </h2>
                <div className="flex flex-col gap-2">
                  {allFinished.map(b => (
                    <FinishedBatchCard key={b.id} batch={b} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Spinner for subsequent fetches */}
        {loading && data && (
          <div className="flex justify-center py-4">
            <div
              className="w-5 h-5 border-2 border-hair rounded-full animate-spin"
              style={{ borderTopColor: 'var(--cook)' }}
            />
          </div>
        )}
      </div>

      {/* Log portion sheet */}
      <LogPortionSheet
        open={!!logBatch}
        onClose={() => setLogBatch(null)}
        batch={logBatch}
        onLogged={load}
      />
    </div>
  );
}
