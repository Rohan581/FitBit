import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Sheet from '../components/Sheet';

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

  tsp = Math.round(tsp * 8) / 8;

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

/* ── timer helpers ─────────────────────────────────────── */

function fmtTimer(totalSeconds) {
  if (totalSeconds <= 0) return '0:00';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtTimerLabel(seconds) {
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

/* ══════════════════════════════════════════════════════════
   CookMode — step-by-step cooking screen
   ══════════════════════════════════════════════════════════ */

export default function CookMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Recipe data
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scale
  const scaleFactor = parseFloat(searchParams.get('scale')) || 1;

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);

  // Timers: array of { stepIndex, startedAt, duration, label, dismissed }
  const [timers, setTimers] = useState([]);
  const [timerTick, setTimerTick] = useState(Date.now());

  // Sheets
  const [showIngredients, setShowIngredients] = useState(false);
  const [showCooked, setShowCooked] = useState(false);

  // "I cooked this" form state
  const [portions, setPortions] = useState(4);
  const [measuredWeight, setMeasuredWeight] = useState('');
  const [saving, setSaving] = useState(false);

  // Touch swipe
  const touchStartX = useRef(null);

  // Wake lock
  const wakeLockRef = useRef(null);

  // Track which timers have already fired notifications
  const notifiedTimers = useRef(new Set());

  /* ── Load recipe ───────────────────────────────────────── */

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecipe(id);
      setRecipe(data);
      const defaultPortions = Math.round((data.servings || 4) * scaleFactor);
      setPortions(defaultPortions);
      const defaultWeight = Math.round((data.cooked_yield_g || 500) * scaleFactor);
      setMeasuredWeight(String(defaultWeight));
    } catch (e) {
      setError(e.message || 'Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [id, scaleFactor]);

  useEffect(() => { load(); }, [load]);

  /* ── Wake Lock ─────────────────────────────────────────── */

  useEffect(() => {
    let active = true;
    async function acquireLock() {
      try {
        const lock = await navigator.wakeLock?.request('screen');
        if (active) wakeLockRef.current = lock;
      } catch { /* fail silently */ }
    }
    acquireLock();

    // Re-acquire on visibility change (lock is released when tab goes hidden)
    function onVisChange() {
      if (document.visibilityState === 'visible' && active) {
        acquireLock();
      }
    }
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  /* ── Timer tick (1-second interval + visibilitychange) ── */

  useEffect(() => {
    const tick = () => setTimerTick(Date.now());
    const interval = setInterval(tick, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  /* ── Timer notification when done ──────────────────────── */

  useEffect(() => {
    for (const timer of timers) {
      if (timer.dismissed) continue;
      const key = `${timer.stepIndex}-${timer.startedAt}`;
      if (notifiedTimers.current.has(key)) continue;
      const elapsed = Math.floor((timerTick - timer.startedAt) / 1000);
      const remaining = timer.duration - elapsed;
      if (remaining <= 0) {
        notifiedTimers.current.add(key);
        try {
          navigator.serviceWorker?.ready?.then(reg => {
            reg.showNotification('Timer done!', {
              body: `${timer.label} timer is up`,
              tag: `cook-timer-${timer.stepIndex}`,
            });
          }).catch(() => {});
        } catch { /* fail silently */ }
      }
    }
  }, [timerTick, timers]);

  /* ── Touch swipe handlers ──────────────────────────────── */

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (!recipe?.steps?.length) return;
    const total = recipe.steps.length;
    if (diff < -50 && currentStep < total - 1) {
      setCurrentStep(prev => prev + 1);
    } else if (diff > 50 && currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }

  /* ── Timer actions ─────────────────────────────────────── */

  function startTimer(stepIndex, duration, label) {
    // Don't start if one already running for this step
    const existing = timers.find(t => t.stepIndex === stepIndex && !t.dismissed);
    if (existing) return;
    setTimers(prev => [...prev, {
      stepIndex,
      startedAt: Date.now(),
      duration,
      label: label || `Step ${stepIndex + 1}`,
      dismissed: false,
    }]);
  }

  function dismissTimer(stepIndex) {
    setTimers(prev => prev.map(t =>
      t.stepIndex === stepIndex ? { ...t, dismissed: true } : t
    ));
  }

  function getTimerRemaining(timer) {
    const elapsed = Math.floor((timerTick - timer.startedAt) / 1000);
    return Math.max(0, timer.duration - elapsed);
  }

  /* ── "I cooked this" handler ───────────────────────────── */

  async function handleCookedThis() {
    setSaving(true);
    try {
      await api.createBatch({
        recipe_id: Number(id),
        scale_factor: scaleFactor,
        portions,
        measured_weight_g: measuredWeight ? Number(measuredWeight) : null,
      });
      navigate('/cook/cooked');
    } catch {
      // Stay on sheet so user can retry
    } finally {
      setSaving(false);
    }
  }

  /* ── Active (non-dismissed) timers ─────────────────────── */

  const activeTimers = timers.filter(t => !t.dismissed);

  /* ── Render: loading ───────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-page">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="h-5 w-32 bg-card-2 rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-7 h-7 border-2 border-hair rounded-full animate-spin"
            style={{ borderTopColor: 'var(--cook)' }}
          />
        </div>
      </div>
    );
  }

  /* ── Render: error ─────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex flex-col h-full bg-page px-5 pt-6">
        <button
          onClick={() => navigate(`/cook/recipes/${id}`)}
          className="text-sm text-tx-2 press-scale mb-4 flex items-center gap-1"
        >
          <span className="text-lg leading-none">&lsaquo;</span> Back
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

  /* ── Render: no steps ──────────────────────────────────── */

  const steps = recipe?.steps || [];
  const totalSteps = steps.length;

  if (totalSteps === 0) {
    return (
      <div className="flex flex-col h-full bg-page px-5 pt-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-tx">{recipe?.title || 'Cook'}</h1>
          <button
            onClick={() => navigate(`/cook/recipes/${id}`)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-card-2 text-tx-3 press-scale"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bg-card rounded-card p-6 text-center">
          <p className="text-tx-2 text-sm">This recipe has no steps.</p>
        </div>
      </div>
    );
  }

  /* ── Current step data ─────────────────────────────────── */

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // Check if a timer is already running for current step
  const currentStepTimer = timers.find(t => t.stepIndex === currentStep && !t.dismissed);
  const currentStepTimerRemaining = currentStepTimer ? getTimerRemaining(currentStepTimer) : null;
  const currentStepTimerDone = currentStepTimer && currentStepTimerRemaining === 0;

  /* ── Main render ───────────────────────────────────────── */

  return (
    <div
      className="flex flex-col h-full bg-page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-bold text-tx truncate">{recipe.title}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowIngredients(true)}
            className="h-8 px-3 rounded-full text-[13px] font-semibold press-scale"
            style={{
              border: '1px solid var(--cook)',
              color: 'var(--cook)',
              background: 'transparent',
            }}
          >
            Ingredients
          </button>
          <button
            onClick={() => navigate(`/cook/recipes/${id}`)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-card-2 text-tx-3 press-scale"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress label + dots */}
      <div className="px-5 pb-3 flex-shrink-0">
        <p className="font-num text-[13px] font-bold tracking-[0.05em] text-tx-2 uppercase">
          Step {currentStep + 1} of {totalSteps}
        </p>
        <div className="flex gap-1.5 mt-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-[5px] rounded-full flex-1 transition-colors duration-200"
              style={{
                background: i === currentStep
                  ? 'var(--cook)'
                  : i < currentStep
                  ? 'var(--cook-dim)'
                  : 'var(--card-2)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="bg-card rounded-card p-5">
          {step.title && (
            <h2 className="text-[18px] font-bold text-tx mb-2">{step.title}</h2>
          )}
          <p className="text-[17px] leading-[1.45] text-tx-2">{step.text}</p>

          {/* Timer button for this step */}
          {step.timer_seconds > 0 && !currentStepTimer && (
            <button
              onClick={() => startTimer(currentStep, step.timer_seconds, step.title || `Step ${currentStep + 1}`)}
              className="mt-4 w-full h-[50px] rounded-[14px] text-[15px] font-semibold press-scale flex items-center justify-center gap-2"
              style={{
                border: '1px solid var(--cook)',
                color: 'var(--cook)',
                background: 'transparent',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Start {fmtTimerLabel(step.timer_seconds)} timer
            </button>
          )}

          {/* Timer running inline for current step */}
          {currentStepTimer && (
            <div
              className="mt-4 w-full h-[50px] rounded-[14px] text-[15px] font-semibold flex items-center justify-center gap-2"
              style={{
                border: `1px solid ${currentStepTimerDone ? 'var(--cal)' : 'var(--cook)'}`,
                color: currentStepTimerDone ? 'var(--cal)' : 'var(--cook)',
                background: currentStepTimerDone
                  ? 'color-mix(in oklab, var(--cal) 10%, transparent)'
                  : 'color-mix(in oklab, var(--cook) 8%, transparent)',
              }}
            >
              <span className="font-num font-bold">
                {currentStepTimerDone ? 'Done!' : fmtTimer(currentStepTimerRemaining)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Running timers bar — visible across all steps */}
      {activeTimers.length > 0 && (
        <div
          className="flex-shrink-0 px-4 pb-2"
          style={{ maxHeight: 120, overflowY: 'auto' }}
        >
          <div className="flex flex-col gap-1.5">
            {activeTimers.map(timer => {
              const remaining = getTimerRemaining(timer);
              const isDone = remaining === 0;
              return (
                <div
                  key={`${timer.stepIndex}-${timer.startedAt}`}
                  className="flex items-center gap-3 px-4 py-2 rounded-[12px]"
                  style={{
                    background: isDone
                      ? 'color-mix(in oklab, var(--cal) 12%, var(--card))'
                      : 'color-mix(in oklab, var(--cook) 8%, var(--card))',
                    border: `1px solid ${isDone ? 'var(--cal)' : 'var(--cook-dim)'}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold text-tx-2 truncate block">
                      {timer.label}
                    </span>
                  </div>
                  <span
                    className="font-num text-[15px] font-bold flex-shrink-0"
                    style={{ color: isDone ? 'var(--cal)' : 'var(--cook)' }}
                  >
                    {isDone ? 'Done!' : fmtTimer(remaining)}
                  </span>
                  <button
                    onClick={() => dismissTimer(timer.stepIndex)}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-tx-3 press-scale flex-shrink-0"
                    style={{ background: 'var(--card-2)' }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div
        className="flex-shrink-0 px-5 pt-2"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-3">
          {!isFirstStep && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="h-12 rounded-[14px] font-semibold text-[14px] text-tx bg-card border border-hair press-scale flex-1"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (isLastStep) {
                setShowCooked(true);
              } else {
                setCurrentStep(prev => prev + 1);
              }
            }}
            className="h-12 rounded-[14px] font-semibold text-[14px] press-scale"
            style={{
              background: 'var(--cook)',
              color: 'var(--on-accent)',
              flex: isFirstStep ? '1' : '2',
            }}
          >
            {isLastStep ? 'I cooked this' : 'Next step'}
          </button>
        </div>
      </div>

      {/* ── Ingredients Sheet ─────────────────────────────── */}
      <Sheet open={showIngredients} onClose={() => setShowIngredients(false)} title="Ingredients" height="tall">
        <div className="px-5 pb-4">
          {scaleFactor !== 1 && (
            <p className="text-[12px] text-tx-3 mb-3">
              Scaled {scaleFactor > 1 ? 'up' : 'down'} {scaleFactor}x
            </p>
          )}
          <ul className="space-y-2.5">
            {(recipe?.ingredients || []).map((ing, idx) => {
              const scaledAmt = (ing.amount || 0) * scaleFactor;
              const display = formatQuantity(scaledAmt, ing.unit, ing.name);
              return (
                <li key={idx} className="flex items-baseline gap-3 text-[15px]">
                  <span className="font-num text-tx min-w-[4rem] text-right font-semibold">{display}</span>
                  <span className="text-tx-2">{ing.name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </Sheet>

      {/* ── "I cooked this" Sheet ─────────────────────────── */}
      <Sheet open={showCooked} onClose={() => setShowCooked(false)} title="I cooked this">
        <div className="px-5 pb-4 space-y-5">
          <Stepper
            value={portions}
            onChange={v => setPortions(Math.max(1, v))}
            min={1}
            step={1}
            label="Split into"
          />

          <div>
            <label className="text-sm text-tx-2 block mb-1">Weigh the finished dish (optional)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={measuredWeight}
                onChange={e => setMeasuredWeight(e.target.value)}
                className="w-28 px-3 py-1.5 rounded-lg bg-card-2 text-tx font-num text-center border border-hair"
                placeholder="—"
              />
              <span className="text-sm text-tx-3">g</span>
            </div>
          </div>

          <button
            onClick={handleCookedThis}
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm press-scale disabled:opacity-40"
            style={{ background: 'var(--cook)', color: 'var(--on-accent)' }}
          >
            {saving ? 'Saving...' : 'Save batch'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
