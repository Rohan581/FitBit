import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import MuscleHighlight from '../components/MuscleHighlight';
import Sheet from '../components/Sheet';

// ─── Offline exercise library ────────────────────────────────
import EXERCISE_LIB from '../data/exerciseLibrary';
function getExerciseLib() {
  return EXERCISE_LIB || {};
}

// ─── localStorage persistence for in-progress sessions ──────
const SESSION_KEY = 'earned_active_session';
function saveSession(state) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// ─── Timer helpers (timestamp-based, survives lock screen) ───
function useTimestamp(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Constants ───────────────────────────────────────────────
const COMPOUND_EXERCISES = new Set([
  'Barbell Back Squat', 'Barbell Bench Press', 'Conventional Deadlift',
  'Romanian Deadlift', 'Standing Overhead Press', 'Barbell Row',
  'Leg Press', 'Bulgarian Split Squat', 'Incline Dumbbell Press',
  'Pull-Up', 'Hip Thrust', 'Dips',
]);

const ACTIVITY_TYPES = [
  { id: 'swimming', label: 'Swim', color: 'var(--drinks)' },
  { id: 'running', label: 'Run', color: 'var(--cal)' },
  { id: 'cycling', label: 'Cycle', color: 'var(--carbs)' },
  { id: 'hiking', label: 'Hike', color: 'var(--fiber)' },
  { id: 'rowing', label: 'Rowing', color: 'var(--protein)' },
  { id: 'treadmill', label: 'Treadmill', color: 'var(--cal)' },
  { id: 'elliptical', label: 'Elliptical', color: 'var(--fat)' },
  { id: 'stair_machine', label: 'Stair machine', color: 'var(--carbs)' },
  { id: 'cycling_machine', label: 'Cycling machine', color: 'var(--fiber)' },
];

const GYM_CARDIO_TYPES = [
  { id: 'Rowing', label: 'Rowing' },
  { id: 'Treadmill', label: 'Treadmill' },
  { id: 'Elliptical', label: 'Elliptical' },
  { id: 'Stair machine', label: 'Stair machine' },
  { id: 'Cycling machine', label: 'Cycling machine' },
];

// ─── Main component ─────────────────────────────────────────
export default function Training() {
  const [screen, setScreen] = useState('home'); // home | workout | progression | complete
  const [data, setData] = useState(null);
  const [volume, setVolume] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active workout state
  const [session, setSession] = useState(null);
  const [sessionSets, setSessionSets] = useState({});
  const [startedAt, setStartedAt] = useState(null);
  const [completedExercises, setCompletedExercises] = useState(new Set());

  // Rest timer
  const [restStartedAt, setRestStartedAt] = useState(null);
  const [restDuration, setRestDuration] = useState(150);
  const [restExerciseName, setRestExerciseName] = useState('');

  // In-session cardio
  const [sessionCardio, setSessionCardio] = useState([]);
  const [showCardioAdd, setShowCardioAdd] = useState(false);

  // Cancel confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Sheets
  const [detailExercise, setDetailExercise] = useState(null);
  const [swapExercise, setSwapExercise] = useState(null);
  const [progExercise, setProgExercise] = useState(null);
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);

  // Exercise swaps: { oldExerciseId: { exercise_id, name, sets, reps } }
  const [swappedExercises, setSwappedExercises] = useState({});

  // Completion data
  const [completionData, setCompletionData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, v] = await Promise.all([api.getTraining(), api.getVolumeSummary()]);
      setData(t);
      setVolume(v);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Restore in-progress session from localStorage
  useEffect(() => {
    const saved = loadSession();
    if (saved && saved.session) {
      setSession(saved.session);
      setSessionSets(saved.sets || {});
      setStartedAt(saved.startedAt);
      setCompletedExercises(new Set(saved.completedExercises || []));
      setSessionCardio(saved.cardio || []);
      setSwappedExercises(saved.swaps || {});
      setScreen('workout');
    }
  }, []);

  // Persist session state to localStorage on every change
  useEffect(() => {
    if (session) {
      saveSession({
        session,
        sets: sessionSets,
        startedAt,
        completedExercises: [...completedExercises],
        cardio: sessionCardio,
        swaps: swappedExercises,
      });
    }
  }, [session, sessionSets, startedAt, completedExercises, sessionCardio, swappedExercises]);

  const elapsedSecs = useTimestamp(startedAt);
  const restSecs = useTimestamp(restStartedAt);
  const restRemaining = restStartedAt ? Math.max(0, restDuration - restSecs) : 0;

  // Auto-dismiss rest timer when complete (quiet visual, no auto-clear for 3s)
  useEffect(() => {
    if (restStartedAt && restRemaining <= 0) {
      const timeout = setTimeout(() => setRestStartedAt(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [restStartedAt, restRemaining]);

  if (loading && !data) return <LoadingState />;
  if (!data) return <div className="p-4 text-center text-tx-3 text-sm">Could not load training data</div>;

  const { next_workout, last_numbers, frequency } = data;

  // ─── Handlers ────────────────────────────────────────────
  async function handleStartWorkout() {
    const result = await api.startSession();
    const newSession = result;
    setSession(newSession);
    setStartedAt(Date.now());
    setCompletedExercises(new Set());
    setSessionCardio([]);
    setSwappedExercises({});

    // Initialize all sets from prescription, pre-filling from last session
    const initial = {};
    for (const ex of next_workout.exercises) {
      if (!ex.exercise_id) continue;
      const last = last_numbers[ex.exercise_id] || [];
      const sets = [];
      for (let s = 1; s <= ex.sets; s++) {
        const prev = last.find(l => l.set_number === s);
        sets.push({
          set_number: s,
          weight_kg: prev?.weight_kg != null ? String(prev.weight_kg) : '',
          reps: prev?.reps != null ? String(prev.reps) : '',
          done: false,
        });
      }
      initial[ex.exercise_id] = sets;
    }
    setSessionSets(initial);
    setScreen('workout');
  }

  function handleResumeWorkout() {
    setScreen('workout');
  }

  function handleSetChange(exId, setNum, field, value) {
    setSessionSets(prev => {
      const exSets = (prev[exId] || []).map(s =>
        s.set_number === setNum ? { ...s, [field]: value, done: false } : s
      );
      return { ...prev, [exId]: exSets };
    });
  }

  async function handleCompleteSet(exId, setNum, exName) {
    if (!session) return;
    const exSets = sessionSets[exId] || [];
    const set = exSets.find(s => s.set_number === setNum);
    if (!set) return;

    const weight = parseFloat(set.weight_kg) || 0;
    const reps = parseInt(set.reps) || 0;

    // Save to server
    try {
      await api.logSet(session.session_id, {
        exercise_id: exId,
        set_number: setNum,
        weight_kg: weight,
        reps: reps,
      });
    } catch { /* will retry on sync */ }

    // Mark done
    setSessionSets(prev => {
      const exSets = (prev[exId] || []).map(s =>
        s.set_number === setNum ? { ...s, done: true } : s
      );
      return { ...prev, [exId]: exSets };
    });

    // Start rest timer — use per-exercise rest_seconds from the template
    const exerciseData = next_workout.exercises.find(e => e.exercise_id === exId);
    const restSecs = exerciseData?.rest_seconds || (COMPOUND_EXERCISES.has(exName) ? 150 : 75);
    setRestDuration(restSecs);
    setRestStartedAt(Date.now());
    setRestExerciseName(exName);
  }

  function handleAddSet(exId) {
    setSessionSets(prev => {
      const exSets = [...(prev[exId] || [])];
      const nextNum = exSets.length + 1;
      const lastSet = exSets[exSets.length - 1];
      return {
        ...prev,
        [exId]: [...exSets, {
          set_number: nextNum,
          weight_kg: lastSet?.weight_kg || '',
          reps: lastSet?.reps || '',
          done: false,
        }],
      };
    });
  }

  function handleDeleteSet(exId, setNum) {
    setSessionSets(prev => {
      const exSets = (prev[exId] || []);
      if (exSets.length <= 1) return prev;
      const filtered = exSets.filter(s => s.set_number !== setNum);
      const resequenced = filtered.map((s, i) => ({ ...s, set_number: i + 1 }));
      return { ...prev, [exId]: resequenced };
    });
  }

  async function handleSwapExercise(oldEx, newExName) {
    // Look up the new exercise by name to get its ID
    let newExId = null;
    try {
      const allExercises = await api.getExercises();
      const found = allExercises.find(e => e.name === newExName);
      if (found) newExId = found.id;
    } catch {}

    // Fallback: check offline library (won't have a DB id but we can still swap visually)
    if (!newExId) {
      const lib = getExerciseLib();
      if (!lib[newExName]) return; // substitute doesn't exist at all
    }

    // Use the original template exercise ID as the swap map key
    const originalId = oldEx._originalId || oldEx.exercise_id;
    const currentId = oldEx.exercise_id;
    const effectiveNewId = newExId || `swap_${Date.now()}`;

    // Record the swap against the original template ID
    setSwappedExercises(prev => ({
      ...prev,
      [originalId]: { exercise_id: effectiveNewId, name: newExName, sets: oldEx.sets, reps: oldEx.reps },
    }));

    // Initialize sets for the new exercise, carrying over prescribed sets/reps
    const oldSets = sessionSets[currentId] || [];
    const newSets = [];
    for (let s = 1; s <= (oldEx.sets || 3); s++) {
      const existing = oldSets.find(os => os.set_number === s && !os.done);
      newSets.push({
        set_number: s,
        weight_kg: existing?.weight_kg || '',
        reps: existing?.reps || '',
        done: false,
      });
    }

    setSessionSets(prev => {
      const updated = { ...prev };
      // Keep already-logged (done) sets under the previous ID for the server record
      const doneSets = (prev[currentId] || []).filter(s => s.done);
      if (doneSets.length > 0) {
        updated[currentId] = doneSets;
      } else {
        delete updated[currentId];
      }
      updated[effectiveNewId] = newSets;
      return updated;
    });

    setSwapExercise(null);
  }

  async function handleAddCardio(type, durationMin) {
    if (!session) return;
    try {
      const result = await api.addSessionCardio(session.session_id, { type, duration_min: durationMin });
      setSessionCardio(prev => [...prev, { id: result.id, type, duration_min: durationMin }]);
    } catch { /* offline fallback */ }
    setShowCardioAdd(false);
  }

  async function handleRemoveCardio(cardioId) {
    if (!session) return;
    try {
      await api.removeSessionCardio(session.session_id, cardioId);
    } catch {}
    setSessionCardio(prev => prev.filter(c => c.id !== cardioId));
  }

  async function handleFinishWorkout() {
    if (!session) return;
    const duration = startedAt ? Math.round((Date.now() - startedAt) / 60000) : 60;

    let totalSets = 0;
    let totalVolume = 0;
    for (const exSets of Object.values(sessionSets)) {
      for (const s of exSets) {
        if (s.done) {
          totalSets++;
          totalVolume += (parseFloat(s.weight_kg) || 0) * (parseInt(s.reps) || 0);
        }
      }
    }

    try {
      const result = await api.completeSession(session.session_id, duration);
      setCompletionData({
        workout: next_workout,
        duration,
        totalSets,
        totalVolume: Math.round(totalVolume),
        nextIndex: result.next_index,
        gymThisWeek: (data.week_gym_sessions || 0) + 1,
        targetGym: data.target_gym_this_week || frequency,
        cardio: sessionCardio,
      });
    } catch {
      setCompletionData({
        workout: next_workout,
        duration,
        totalSets,
        totalVolume: Math.round(totalVolume),
        nextIndex: null,
        gymThisWeek: (data.week_gym_sessions || 0) + 1,
        targetGym: data.target_gym_this_week || frequency,
        cardio: sessionCardio,
      });
    }

    clearSession();
    setSession(null);
    setSessionSets({});
    setStartedAt(null);
    setRestStartedAt(null);
    setSessionCardio([]);
    setScreen('complete');
  }

  async function handleCancelWorkout() {
    if (!session) return;
    try {
      await api.cancelSession(session.session_id);
    } catch { /* offline */ }
    clearSession();
    setSession(null);
    setSessionSets({});
    setStartedAt(null);
    setRestStartedAt(null);
    setSessionCardio([]);
    setShowCancelConfirm(false);
    setScreen('home');
    load();
  }

  async function handleDiscardStale() {
    const activeSession = data?.active_session;
    if (!activeSession) return;
    try {
      await api.cancelSession(activeSession.session_id);
    } catch {}
    clearSession();
    setSession(null);
    setSessionSets({});
    setStartedAt(null);
    load();
  }

  async function handleFinishStale() {
    const activeSession = data?.active_session;
    if (!activeSession) return;
    // Complete it with whatever was logged
    try {
      const elapsedMin = Math.round(activeSession.elapsed_hours * 60);
      await api.completeSession(activeSession.session_id, Math.min(elapsedMin, 120));
    } catch {}
    clearSession();
    setSession(null);
    setSessionSets({});
    setStartedAt(null);
    load();
  }

  function handleBackToHome() {
    setScreen('home');
    setCompletionData(null);
    load();
  }

  async function handleFrequencyChange(f) {
    await api.setFrequency(f);
    load();
  }

  // ─── Render ──────────────────────────────────────────────
  if (screen === 'complete' && completionData) {
    return <CompleteScreen data={completionData} allData={data} onBack={handleBackToHome} />;
  }

  if (screen === 'workout' && session) {
    // Apply swaps to exercise list
    const effectiveExercises = next_workout.exercises.map(ex => {
      const swap = swappedExercises[ex.exercise_id];
      if (swap) return { ...ex, exercise_id: swap.exercise_id, name: swap.name, _originalId: ex.exercise_id };
      return ex;
    });

    const exCount = effectiveExercises.length;
    const doneCount = effectiveExercises.filter(
      ex => ex.exercise_id && (sessionSets[ex.exercise_id] || []).every(s => s.done) && (sessionSets[ex.exercise_id] || []).length > 0
    ).length;

    // Separate catch-up and template exercises
    const catchUpExercises = effectiveExercises.filter(e => e.is_catchup);
    const templateExercises = effectiveExercises.filter(e => !e.is_catchup);

    const isLastTenSecs = restRemaining > 0 && restRemaining <= 10;
    const isRestComplete = restStartedAt && restRemaining <= 0;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2.5 border-b border-hair flex-shrink-0">
          <button onClick={() => setScreen('home')} className="text-[15px] font-semibold text-tx-2 press-scale py-2">
            ‹ Train
          </button>
          <div className="text-center">
            <div className="text-[16px] font-bold font-num text-tx">{next_workout.label}</div>
            <div className="text-[12px] font-semibold text-tx-3">{doneCount} of {exCount} exercises</div>
          </div>
          <span className="text-[14px] font-semibold font-num text-tx-2 w-[52px] text-right">{fmtTime(elapsedSecs)}</span>
        </div>

        {/* Exercise cards */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex flex-col gap-3">
            {/* Template exercises */}
            {templateExercises.map((ex, i) => (
              <ExerciseCard
                key={ex.exercise_id || i}
                ex={ex}
                sets={sessionSets[ex.exercise_id] || []}
                last={last_numbers[ex.exercise_id] || []}
                onSetChange={handleSetChange}
                onCompleteSet={handleCompleteSet}
                onAddSet={handleAddSet}
                onDeleteSet={handleDeleteSet}
                onDetail={setDetailExercise}
                onProg={setProgExercise}
                onSwap={setSwapExercise}
              />
            ))}

            {/* Catch-up block */}
            {catchUpExercises.length > 0 && (
              <>
                <div className="rounded-[14px] px-4 py-2.5 mt-1" style={{ background: 'var(--accent-surface)' }}>
                  <div className="text-[12.5px] font-bold text-points">Catch-up</div>
                  <div className="text-[11.5px] text-tx-2 mt-0.5">
                    {catchUpExercises.map(e => e.catchup_reason).filter(Boolean).join(' · ')}
                  </div>
                </div>
                {catchUpExercises.map((ex, i) => (
                  <ExerciseCard
                    key={ex.exercise_id || `catch-${i}`}
                    ex={ex}
                    sets={sessionSets[ex.exercise_id] || []}
                    last={last_numbers[ex.exercise_id] || []}
                    onSetChange={handleSetChange}
                    onCompleteSet={handleCompleteSet}
                    onAddSet={handleAddSet}
                    onDeleteSet={handleDeleteSet}
                    onDetail={setDetailExercise}
                    onProg={setProgExercise}
                    onSwap={setSwapExercise}
                  />
                ))}
              </>
            )}

            {/* In-session cardio */}
            {sessionCardio.length > 0 && (
              <div className="bg-card rounded-[20px] border border-hair p-4">
                <div className="text-[13px] font-bold text-tx-3 mb-2">Cardio</div>
                {sessionCardio.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <span className="text-[14px] text-tx-2">{c.type} · {c.duration_min} min</span>
                    <button onClick={() => handleRemoveCardio(c.id)} className="text-tx-3 text-[16px] press-scale">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add cardio button */}
            <button
              onClick={() => setShowCardioAdd(true)}
              className="h-[48px] rounded-[14px] border border-dashed border-hair text-[14px] font-semibold text-tx-2 press-scale"
            >
              + Add cardio · rower, treadmill…
            </button>

            {/* Finish button */}
            <button
              onClick={handleFinishWorkout}
              className="h-[56px] rounded-[16px] text-[16.5px] font-bold press-scale mt-1"
              style={{ background: 'var(--points)', color: 'var(--accent-surface)' }}
            >
              Finish workout
            </button>

            {/* Cancel button */}
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="h-[44px] text-[14px] font-semibold text-tx-3 press-scale mb-4"
            >
              Cancel workout
            </button>
          </div>
        </div>

        {/* Rest timer — docked above tab bar */}
        {restStartedAt && (
          <div
            className="fixed left-4 right-4 rounded-[18px] border border-hair p-3 px-4 flex items-center gap-3.5"
            style={{
              bottom: 'calc(68px + env(safe-area-inset-bottom))',
              background: 'var(--accent-surface)',
              boxShadow: '0 12px 32px -12px rgba(0,0,0,.5)',
              animation: 'popin .18s ease-out',
              zIndex: 40,
            }}
          >
            <div className="flex-none">
              <div className="text-[11px] font-bold text-tx-3 truncate max-w-[80px]">{restExerciseName || 'Rest'}</div>
              <div
                className="text-[26px] font-bold font-num leading-tight"
                style={{
                  color: isRestComplete ? 'var(--text-3)' : isLastTenSecs ? 'var(--cal)' : 'var(--points)',
                  transition: 'color 0.3s',
                }}
              >
                {isRestComplete ? 'Done' : fmtTime(restRemaining)}
              </div>
            </div>
            <div className="flex-[2] h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: isLastTenSecs ? 'var(--cal)' : 'var(--points)',
                  width: isRestComplete ? '0%' : `${(restRemaining / restDuration) * 100}%`,
                  transition: 'width 1s linear',
                }}
              />
            </div>
            <button
              onClick={() => setRestStartedAt(null)}
              className="h-[44px] px-4 rounded-[12px] border border-hair bg-card text-[14px] font-bold text-tx-2 press-scale flex-shrink-0"
            >
              Skip
            </button>
          </div>
        )}

        {/* Cancel confirmation dialog */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-card rounded-[20px] p-6 mx-8 max-w-sm w-full">
              <h3 className="text-[17px] font-bold text-tx">Discard this session?</h3>
              <p className="text-[14px] text-tx-2 mt-2">Logged sets will be deleted.</p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 h-[48px] rounded-[13px] border border-hair text-[15px] font-bold text-tx-2 press-scale"
                >
                  Keep going
                </button>
                <button
                  onClick={handleCancelWorkout}
                  className="flex-1 h-[48px] rounded-[13px] text-[15px] font-bold press-scale"
                  style={{ background: 'var(--danger)', color: 'white' }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cardio add sheet */}
        {showCardioAdd && <CardioAddSheet onAdd={handleAddCardio} onClose={() => setShowCardioAdd(false)} />}

        {/* Sheets */}
        {detailExercise && <ExerciseDetailSheet exerciseId={detailExercise.id || detailExercise} exerciseName={detailExercise.name} onClose={() => setDetailExercise(null)} />}
        {swapExercise && <SwapSheet exercise={swapExercise} onSwap={(subName) => handleSwapExercise(swapExercise, subName)} onClose={() => setSwapExercise(null)} />}
        {progExercise && <ProgressionSheet exerciseId={progExercise} onClose={() => setProgExercise(null)} />}
      </div>
    );
  }

  // ─── Train Home ──────────────────────────────────────────
  const weekStrip = data.week_strip || [];
  const gymCount = data.week_gym_sessions || 0;
  const swimCount = data.week_swim_sessions || 0;
  const activeSession = data.active_session;
  const catchUpData = data.catch_up;
  const volumeNotes = data.volume_notes || {};

  // Determine hero card state
  let heroState = 'next_up'; // next_up | in_progress | left_open
  if (activeSession) {
    heroState = activeSession.stale ? 'left_open' : 'in_progress';
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-2 flex-shrink-0">
        <p className="text-[13px] font-semibold text-tx-3">{formatTodayLong()}</p>
        <h1 className="text-[26px] font-bold text-tx mt-0.5" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: '-0.02em' }}>
          Train
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex flex-col gap-3">
          {/* Hero card — three states */}
          {heroState === 'next_up' && (
            <div className="rounded-[20px] border border-hair p-[18px]" style={{ background: 'var(--accent-surface)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold text-points">Next up</span>
                <span className="text-[12.5px] font-semibold text-tx-3">Session {gymCount + 1} of {data.target_gym_this_week || frequency} this week</span>
              </div>
              <div className="text-[22px] font-bold mt-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: '-0.01em' }}>
                {next_workout.label}
              </div>
              <div className="text-[14px] font-medium text-tx-2 mt-0.5">
                {next_workout.subtitle}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3.5">
                {next_workout.exercises.map((ex, i) => (
                  <span
                    key={i}
                    className="text-[12.5px] font-semibold text-tx-2 rounded-full px-2.5 py-1"
                    style={{
                      background: ex.is_catchup
                        ? 'color-mix(in oklab, var(--points) 20%, transparent)'
                        : 'var(--card-2)',
                      color: ex.is_catchup ? 'var(--points)' : undefined,
                    }}
                  >
                    {ex.name}{ex.is_catchup ? ' ↺' : ''}
                  </span>
                ))}
              </div>
              <button
                onClick={handleStartWorkout}
                className="w-full mt-4 h-[54px] rounded-[14px] text-[16.5px] font-bold press-scale"
                style={{ background: 'var(--points)', color: 'var(--accent-surface)' }}
              >
                Start workout
              </button>
            </div>
          )}

          {heroState === 'in_progress' && (
            <div className="rounded-[20px] border border-hair p-[18px]" style={{ background: 'var(--accent-surface)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold text-points">In progress</span>
                <span className="text-[12.5px] font-semibold font-num text-tx-3">
                  {Math.floor(activeSession.elapsed_hours * 60)} min · {activeSession.sets_completed} sets
                </span>
              </div>
              <div className="text-[22px] font-bold mt-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: '-0.01em' }}>
                {formatWorkoutType(activeSession.workout_type)}
              </div>
              <button
                onClick={handleResumeWorkout}
                className="w-full mt-4 h-[54px] rounded-[14px] text-[16.5px] font-bold press-scale"
                style={{ background: 'var(--points)', color: 'var(--accent-surface)' }}
              >
                Resume
              </button>
            </div>
          )}

          {heroState === 'left_open' && (
            <div className="rounded-[20px] border border-hair p-[18px]" style={{ background: 'var(--accent-surface)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold text-cal">Left open</span>
              </div>
              <div className="text-[22px] font-bold mt-2" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: '-0.01em' }}>
                {formatWorkoutType(activeSession.workout_type)}
              </div>
              <p className="text-[13px] text-tx-3 mt-1">
                Started {new Date(activeSession.started_at + 'Z').toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · {activeSession.sets_completed} sets logged
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleFinishStale}
                  className="flex-1 h-[48px] rounded-[14px] text-[15px] font-bold press-scale"
                  style={{ background: 'var(--points)', color: 'var(--accent-surface)' }}
                >
                  Finish with what you logged
                </button>
                <button
                  onClick={handleDiscardStale}
                  className="h-[48px] px-5 rounded-[14px] border border-hair text-[15px] font-bold text-tx-3 press-scale"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Log other activity */}
          <button
            onClick={() => setActivitySheetOpen(true)}
            className="flex items-center gap-3 text-left bg-card rounded-[20px] border border-hair p-3.5 px-4 press-scale"
          >
            <span className="w-10 h-10 rounded-[12px] bg-card-2 flex items-center justify-center text-[19px] text-drinks flex-shrink-0">+</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold text-tx">Log other activity</span>
              <span className="block text-[13px] font-semibold text-tx-3 mt-0.5">Swim, run, cycle, hike — just type and time</span>
            </span>
            <span className="text-tx-3 text-[17px] flex-shrink-0">›</span>
          </button>

          {/* This week strip */}
          <div className="bg-card rounded-[20px] border border-hair p-[18px]">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-bold text-tx">This week</span>
              <span className="text-[12.5px] font-semibold text-tx-3">{gymCount} gym · {swimCount} swim</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 mt-3.5">
              {weekStrip.map((d) => {
                const isToday = d.date === todayStr();
                let bg = 'transparent';
                let border = `1px solid var(--hair)`;
                let fg = 'var(--text-3)';
                let mark = '';
                if (d.gym) {
                  bg = 'color-mix(in oklab, var(--points) 18%, transparent)';
                  border = '1px solid color-mix(in oklab, var(--points) 30%, transparent)';
                  fg = 'var(--points)';
                  mark = '✓';
                } else if (d.swim) {
                  bg = 'color-mix(in oklab, var(--drinks) 18%, transparent)';
                  border = '1px solid color-mix(in oklab, var(--drinks) 30%, transparent)';
                  fg = 'var(--drinks)';
                  mark = '~';
                } else if (isToday) {
                  border = '2px solid var(--points)';
                }
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-tx-3">{d.label}</span>
                    <div
                      className="w-[38px] h-[44px] rounded-[12px] flex items-center justify-center text-[14px] font-bold font-num"
                      style={{ background: bg, border, color: fg }}
                    >
                      {mark}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3.5 mt-3">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-tx-3">
                <span className="w-2 h-2 rounded-full bg-points" /> Gym
              </span>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-tx-3">
                <span className="w-2 h-2 rounded-full bg-drinks" /> Swim
              </span>
            </div>
          </div>

          {/* Weekly volume + conditioning */}
          <WeeklyVolumeCard volume={volume} volumeNotes={volumeNotes} />

          {/* Frequency selector */}
          <div className="bg-card rounded-[20px] border border-hair p-[18px]">
            <p className="text-[12.5px] font-bold text-tx-3 mb-2">Gym frequency</p>
            <div className="flex gap-2">
              {[3, 4].map(f => (
                <button
                  key={f}
                  onClick={() => handleFrequencyChange(f)}
                  className="flex-1 py-2.5 rounded-[13px] text-[14px] font-bold press-scale"
                  style={{
                    background: frequency === f ? 'color-mix(in oklab, var(--points) 14%, transparent)' : 'transparent',
                    border: frequency === f ? '2px solid var(--points)' : '1px solid var(--hair)',
                    color: frequency === f ? 'var(--points)' : 'var(--text-3)',
                  }}
                >
                  {f} days · {f === 3 ? 'Full Body' : 'Upper/Lower'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sheets */}
      {detailExercise && <ExerciseDetailSheet exerciseId={detailExercise.id || detailExercise} exerciseName={detailExercise.name} onClose={() => setDetailExercise(null)} />}
      {activitySheetOpen && <LogActivitySheet onClose={() => { setActivitySheetOpen(false); load(); }} />}
    </div>
  );
}

// ─── Exercise Card (reusable for template + catch-up) ───────
function ExerciseCard({ ex, sets, last, onSetChange, onCompleteSet, onAddSet, onDeleteSet, onDetail, onProg, onSwap }) {
  const exId = ex.exercise_id;
  const allDone = sets.length > 0 && sets.every(s => s.done);
  const lastTxt = last.length > 0
    ? last.map(l => `${l.weight_kg}×${l.reps}`).join(', ')
    : '—';

  return (
    <div className="bg-card rounded-[20px] border border-hair p-4" style={allDone ? { borderColor: 'color-mix(in oklab, var(--points) 30%, var(--hair))' } : undefined}>
      {/* Exercise header */}
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => exId && onDetail({ id: exId, name: ex.name })}>
          <div className="flex items-center gap-2">
            <span className="text-[16.5px] font-bold text-tx truncate">{ex.name}</span>
            <span className="text-tx-3 text-[13px] flex-shrink-0">›</span>
          </div>
          <div className="text-[13px] font-semibold text-tx-3 mt-0.5">
            {ex.sets}×{ex.reps} · last: {lastTxt}
          </div>
        </div>
        <button onClick={() => exId && onProg(exId)} title="Progression" className="w-[38px] h-[38px] rounded-[11px] border border-hair bg-card-2 text-tx-2 text-[14px] press-scale flex-shrink-0 flex items-center justify-center">
          ▁▄▆
        </button>
        <button onClick={() => onSwap(ex)} title="Swap" className="w-[38px] h-[38px] rounded-[11px] border border-hair bg-card-2 text-tx-2 text-[15px] press-scale flex-shrink-0 flex items-center justify-center">
          ⇄
        </button>
      </div>

      {/* Set header row */}
      <div className="grid gap-2 items-center mt-3.5 px-0.5" style={{ gridTemplateColumns: '22px 54px 1fr 1fr 42px 24px' }}>
        <span className="text-[11px] font-bold text-tx-3">set</span>
        <span className="text-[11px] font-bold text-tx-3">prev</span>
        <span className="text-[11px] font-bold text-tx-3 text-center">kg</span>
        <span className="text-[11px] font-bold text-tx-3 text-center">reps</span>
        <span className="text-[11px] font-bold text-tx-3 text-center">✓</span>
        <span />
      </div>

      {/* Set rows */}
      <div className="flex flex-col gap-2 mt-1.5">
        {sets.map((set) => {
          const prev = last.find(l => l.set_number === set.set_number);
          const prevTxt = prev ? `${prev.weight_kg}×${prev.reps}` : '—';
          return (
            <div key={`${exId}-${set.set_number}`} className="grid gap-2 items-center" style={{ gridTemplateColumns: '22px 54px 1fr 1fr 42px 24px' }}>
              <span className="text-[14px] font-semibold font-num text-tx-3">{set.set_number}</span>
              <span className="text-[13px] font-medium font-num text-tx-3 truncate">{prevTxt}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={set.weight_kg}
                onChange={e => onSetChange(exId, set.set_number, 'weight_kg', e.target.value)}
                placeholder={prev?.weight_kg != null ? String(prev.weight_kg) : '—'}
                className="h-[52px] w-full rounded-[13px] border border-hair text-[18px] font-semibold text-center text-tx font-num min-w-0"
                style={{ background: set.done ? 'color-mix(in oklab, var(--points) 8%, var(--card-2))' : 'var(--card-2)' }}
              />
              <input
                type="number"
                inputMode="numeric"
                step="1"
                value={set.reps}
                onChange={e => onSetChange(exId, set.set_number, 'reps', e.target.value)}
                placeholder={prev?.reps != null ? String(prev.reps) : '—'}
                className="h-[52px] w-full rounded-[13px] border border-hair text-[18px] font-semibold text-center text-tx font-num min-w-0"
                style={{ background: set.done ? 'color-mix(in oklab, var(--points) 8%, var(--card-2))' : 'var(--card-2)' }}
              />
              <button
                onClick={() => onCompleteSet(exId, set.set_number, ex.name)}
                className="h-[52px] rounded-[13px] text-[18px] press-scale flex items-center justify-center"
                style={{
                  background: set.done ? 'var(--points)' : 'transparent',
                  border: set.done ? '1px solid var(--points)' : '1px solid var(--hair)',
                  color: set.done ? 'var(--accent-surface)' : 'var(--text-3)',
                }}
              >
                ✓
              </button>
              <button
                onClick={() => onDeleteSet(exId, set.set_number)}
                className="h-[52px] text-[17px] text-tx-3 press-scale flex items-center justify-center"
                style={{ opacity: sets.length <= 1 ? 0.3 : 1 }}
                disabled={sets.length <= 1}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Add set */}
      <button
        onClick={() => onAddSet(exId)}
        className="mt-2.5 h-[44px] w-full rounded-[12px] border border-dashed border-hair text-[14px] font-bold text-tx-2 press-scale"
      >
        + add set
      </button>
    </div>
  );
}

// ─── Cardio Add Sheet ───────────────────────────────────────
function CardioAddSheet({ onAdd, onClose }) {
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');

  return (
    <Sheet open={true} onClose={onClose} title="Add cardio">
      <div className="px-5 pb-6 space-y-4">
        <div>
          <p className="text-[12.5px] font-bold text-tx-3 mb-2">Machine</p>
          <div className="flex flex-wrap gap-2">
            {GYM_CARDIO_TYPES.map(ct => (
              <button
                key={ct.id}
                onClick={() => setType(ct.id)}
                className="px-4 py-2.5 rounded-[13px] text-[14px] font-semibold press-scale"
                style={{
                  background: type === ct.id ? 'color-mix(in oklab, var(--points) 14%, transparent)' : 'transparent',
                  border: type === ct.id ? '2px solid var(--points)' : '1px solid var(--hair)',
                  color: 'var(--text)',
                }}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[12.5px] font-bold text-tx-3 mb-2">Duration</p>
          <div className="flex gap-2">
            {[10, 15, 20, 30].map(d => (
              <button
                key={d}
                onClick={() => setDuration(String(d))}
                className="flex-1 h-[48px] rounded-[12px] text-[15px] font-semibold font-num press-scale"
                style={{
                  background: duration === String(d) ? 'color-mix(in oklab, var(--points) 14%, transparent)' : 'transparent',
                  border: duration === String(d) ? '2px solid var(--points)' : '1px solid var(--hair)',
                  color: 'var(--text)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={!['10','15','20','30'].includes(duration) ? duration : ''}
            onChange={e => setDuration(e.target.value)}
            placeholder="Custom minutes"
            className="mt-2 w-full px-3 py-2.5 rounded-[13px] border border-hair text-[14px] text-tx bg-card-2"
          />
        </div>
        <button
          onClick={() => type && duration && onAdd(type, parseInt(duration))}
          disabled={!type || !duration}
          className="w-full h-[54px] rounded-[14px] text-[16px] font-bold press-scale disabled:opacity-40"
          style={{ background: 'var(--points)', color: 'var(--accent-surface)' }}
        >
          Add
        </button>
      </div>
    </Sheet>
  );
}

// ─── Weekly Volume Card ──────────────────────────────────────
function WeeklyVolumeCard({ volume, volumeNotes }) {
  if (!volume) return null;

  const muscleOrder = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Biceps', 'Triceps', 'Abs', 'Calves'];
  const muscleMap = {
    chest: 'Chest', lats: 'Back', upper_back: 'Back', traps: 'Back',
    front_delts: 'Shoulders', side_delts: 'Shoulders', rear_delts: 'Shoulders',
    quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
    biceps: 'Biceps', triceps: 'Triceps', abs: 'Abs', calves: 'Calves',
    lower_back: 'Back', obliques: 'Abs',
  };

  // Reverse map for notes
  const muscleKeyMap = {};
  for (const [key, display] of Object.entries(muscleMap)) {
    if (!muscleKeyMap[display]) muscleKeyMap[display] = [];
    muscleKeyMap[display].push(key);
  }

  const grouped = {};
  for (const [muscle, sets] of Object.entries(volume.sets_per_muscle || {})) {
    const display = muscleMap[muscle] || muscle;
    grouped[display] = (grouped[display] || 0) + sets;
  }

  const maxSets = Math.max(1, ...Object.values(grouped));
  const volumeRows = muscleOrder.filter(m => grouped[m]).map(m => {
    // Check if any sub-muscle has a note
    const keys = muscleKeyMap[m] || [];
    const note = keys.map(k => volumeNotes?.[k]).filter(Boolean)[0] || null;
    return {
      name: m,
      sets: grouped[m],
      pct: `${Math.round((grouped[m] / maxSets) * 100)}%`,
      sessions: Math.ceil(grouped[m] / 6),
      note,
    };
  });

  const conditioning = volume.conditioning || [];

  return (
    <div className="bg-card rounded-[20px] border border-hair p-[18px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-bold text-tx">Weekly volume</span>
        <span className="text-[12.5px] font-semibold text-tx-3">strength · sets · times hit</span>
      </div>
      {volumeRows.length > 0 ? (
        <div className="flex flex-col gap-2.5 mt-3.5">
          {volumeRows.map(v => (
            <div key={v.name}>
              <div className="grid items-center gap-2.5" style={{ gridTemplateColumns: '80px 1fr 30px 36px' }}>
                <span className="text-[13.5px] font-semibold text-tx-2">{v.name}</span>
                <div className="h-2 rounded-full overflow-hidden bg-card-2">
                  <div className="h-full rounded-full bg-points progress-fill" style={{ width: v.pct }} />
                </div>
                <span className="text-[13.5px] font-semibold font-num text-right">{v.sets}</span>
                <div className="flex gap-1 justify-end">
                  {Array.from({ length: Math.min(v.sessions, 3) }, (_, i) => (
                    <span key={i} className="w-[9px] h-[9px] rounded-full bg-points" />
                  ))}
                </div>
              </div>
              {v.note && (
                <div className="text-[11px] text-tx-3 ml-[84px] mt-0.5">{v.note}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-tx-3 mt-3">Complete a gym session to see volume data</p>
      )}

      {/* Conditioning section */}
      {conditioning.length > 0 && (
        <>
          <div className="flex items-baseline justify-between mt-4 pt-4 border-t border-hair">
            <span className="text-[15px] font-bold text-tx">Conditioning</span>
            <span className="text-[13px] font-semibold font-num text-drinks">{conditioning.length} this week</span>
          </div>
          <div className="flex flex-col gap-2.5 mt-3">
            {conditioning.map((a, i) => (
              <div key={i} className="grid items-center gap-2.5" style={{ gridTemplateColumns: '20px 1fr 44px 58px' }}>
                <span className="w-[10px] h-[10px] rounded-full" style={{ background: a.type.toLowerCase() === 'swimming' ? 'var(--drinks)' : 'var(--cal)' }} />
                <span className="text-[13.5px] font-semibold text-tx-2 capitalize">{a.type}{a.in_session ? ' (gym)' : ''}</span>
                <span className="text-[12.5px] font-semibold text-tx-3">{formatDate(a.date)}</span>
                <span className="text-[13.5px] font-semibold font-num text-right">{a.duration_min} min</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Session Complete Screen ─────────────────────────────────
function CompleteScreen({ data: cd, allData, onBack }) {
  const nextWorkoutLabel = cd.nextIndex != null
    ? formatWorkoutType(allData?.rotation?.[cd.nextIndex % (allData?.rotation?.length || 1)]?.type || '')
    : 'Next session';

  return (
    <div className="flex flex-col h-full px-5">
      <div className="flex-1 flex flex-col justify-center items-center text-center">
        <div
          className="w-[76px] h-[76px] rounded-full flex items-center justify-center text-[34px]"
          style={{ background: 'var(--points)', color: 'var(--accent-surface)', animation: 'popin .3s ease-out' }}
        >
          ✓
        </div>
        <div className="text-[26px] font-bold mt-[18px]" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          Session logged
        </div>
        <div className="text-[15px] font-semibold text-tx-2 mt-1">
          {cd.workout.label} · that's {cd.gymThisWeek} of {cd.targetGym} this week
        </div>
        <div
          className="mt-2.5 text-[14px] font-bold text-points rounded-full px-4 py-1.5"
          style={{ background: 'var(--card)', border: '1px solid var(--hair)' }}
        >
          +{cd.duration >= 60 ? 30 : cd.duration >= 45 ? 25 : cd.duration >= 30 ? 20 : 12} points earned
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2.5 w-full mt-6">
          {[
            { val: `${cd.duration}m`, label: 'duration' },
            { val: cd.totalVolume > 1000 ? `${Math.round(cd.totalVolume / 100) / 10}t` : `${cd.totalVolume}`, label: 'volume (kg)' },
            { val: String(cd.totalSets), label: 'sets done' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-[16px] border border-hair p-3.5">
              <div className="text-[21px] font-bold font-num">{s.val}</div>
              <div className="text-[12px] font-semibold text-tx-3 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Cardio summary */}
        {cd.cardio?.length > 0 && (
          <div className="w-full mt-3 bg-card rounded-[16px] border border-hair p-3.5 text-left">
            <div className="text-[12px] font-bold text-tx-3 mb-1">Cardio</div>
            {cd.cardio.map((c, i) => (
              <div key={i} className="text-[13px] text-tx-2">{c.type} · {c.duration_min} min</div>
            ))}
          </div>
        )}

        {/* Up next card */}
        <div className="w-full mt-3.5 bg-card rounded-[18px] border border-hair p-4 text-left flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[12.5px] font-bold text-points">Up next in your queue</div>
            <div className="text-[17px] font-bold mt-1 font-num">{nextWorkoutLabel}</div>
          </div>
          <span className="text-tx-3 text-[18px]">›</span>
        </div>
      </div>

      <button
        onClick={onBack}
        className="h-[54px] rounded-[14px] bg-card-2 text-[16px] font-bold text-tx press-scale mb-7"
      >
        Back to Train
      </button>
    </div>
  );
}

// ─── Exercise Detail Sheet (offline-capable) ─────────────────
function ExerciseDetailSheet({ exerciseId, exerciseName, onClose }) {
  const [ex, setEx] = useState(null);

  useEffect(() => {
    api.getExercise(exerciseId).then(setEx).catch(() => {
      if (exerciseName) {
        const lib = getExerciseLib();
        const found = lib[exerciseName];
        if (found) setEx(found);
      }
    });
  }, [exerciseId, exerciseName]);

  if (!ex) return null;

  const youtubeUrl = ex.youtube_search_term
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.youtube_search_term)}`
    : null;

  return (
    <Sheet open={true} onClose={onClose} title={ex.name} height="tall">
      <div className="px-5 pb-6 space-y-5">
        <MuscleHighlight primaryMuscles={ex.primary_muscles} secondaryMuscles={ex.secondary_muscles} />

        <div className="flex flex-wrap gap-1.5">
          {ex.primary_muscles.map(m => (
            <span key={m} className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'color-mix(in oklab, var(--protein) 15%, transparent)', color: 'var(--protein)' }}>
              {m.replace(/_/g, ' ')}
            </span>
          ))}
          {ex.secondary_muscles.map(m => (
            <span key={m} className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'color-mix(in oklab, var(--cal) 12%, transparent)', color: 'var(--cal)' }}>
              {m.replace(/_/g, ' ')}
            </span>
          ))}
        </div>

        <div>
          <p className="text-[12.5px] font-bold text-tx-3 mb-2">Form cues</p>
          <ol className="space-y-2">
            {ex.form_cues.map((cue, i) => (
              <li key={i} className="text-[14px] text-tx-2 flex gap-2.5 leading-[1.5]">
                <span className="text-points font-bold flex-shrink-0 w-5 text-right">{i + 1}.</span>
                <span>{cue}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="text-[12.5px] font-bold text-tx-3 mb-2">Common mistakes</p>
          <ul className="space-y-2">
            {ex.common_mistakes.map((m, i) => (
              <li key={i} className="text-[14px] text-tx-2 flex gap-2.5 leading-[1.5]">
                <span className="text-cal font-bold flex-shrink-0">!</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>

        {youtubeUrl && (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 rounded-[14px] border border-hair text-[14px] font-semibold text-tx-2 press-scale"
          >
            <span className="text-[18px]">▶</span>
            Watch form demo
          </a>
        )}
      </div>
    </Sheet>
  );
}

// ─── Progression Sheet ───────────────────────────────────────
function ProgressionSheet({ exerciseId, onClose }) {
  const [ex, setEx] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getExercise(exerciseId),
      api.getExerciseHistory(exerciseId),
    ]).then(([e, h]) => { setEx(e); setHistory(h); }).catch(() => {});
  }, [exerciseId]);

  if (!ex || !history) return null;

  const h = history.history || [];
  const topSet = h.length > 0 ? h[h.length - 1] : null;
  const twelveWeeksAgo = h.length > 0 ? h[0] : null;
  const delta = topSet && twelveWeeksAgo && h.length >= 2
    ? Math.round((topSet.top_weight - twelveWeeksAgo.top_weight) * 10) / 10
    : null;

  const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--hair)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--text-2)',
  };

  return (
    <Sheet open={true} onClose={onClose} title={ex.name} height="tall">
      <div className="px-5 pb-6 space-y-4">
        <div className="text-[14px] font-semibold text-tx-3">Top set weight · last {h.length} sessions</div>

        <div className="flex gap-3">
          <div className="flex-1 bg-card rounded-[16px] border border-hair p-3.5">
            <div className="text-[12px] font-bold text-tx-3">Current top set</div>
            <div className="text-[22px] font-bold font-num mt-1">
              {topSet ? `${topSet.top_weight}×${topSet.top_reps}` : '—'}
            </div>
          </div>
          <div className="flex-1 bg-card rounded-[16px] border border-hair p-3.5">
            <div className="text-[12px] font-bold text-tx-3">12-week change</div>
            <div className="text-[22px] font-bold font-num text-points mt-1">
              {delta != null ? `${delta > 0 ? '+' : ''}${delta} kg` : '—'}
            </div>
          </div>
        </div>

        {h.length >= 2 && (
          <div className="bg-card rounded-[20px] border border-hair p-[18px]">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={h.map(d => ({ date: formatDate(d.date), weight: d.top_weight }))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} kg`, 'Top set']} />
                <Line type="monotone" dataKey="weight" stroke="var(--points)" strokeWidth={3} dot={{ r: 4, fill: 'var(--points)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {history.progression_note && (
          <div className="bg-card rounded-[16px] border border-hair p-3.5 px-4 flex gap-3 items-start">
            <span className="w-[10px] h-[10px] rounded-full bg-points flex-shrink-0 mt-1.5" />
            <div className="text-[14px] font-semibold text-tx-2 leading-[1.5]">{history.progression_note}</div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ─── Swap Sheet ──────────────────────────────────────────────
function SwapSheet({ exercise, onSwap, onClose }) {
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    if (!exercise.exercise_id) return;
    api.getExercise(exercise.exercise_id)
      .then(ex => setSubs(ex.substitutes || []))
      .catch(() => {
        const lib = getExerciseLib();
        const found = lib[exercise.name];
        if (found) setSubs(found.substitutes || []);
      });
  }, [exercise.exercise_id, exercise.name]);

  return (
    <Sheet open={true} onClose={onClose} title={`Swap ${exercise.name}`}>
      <div className="px-5 pb-6 space-y-2">
        <p className="text-[13px] font-semibold text-tx-3 mb-1">Same muscle group alternatives:</p>
        {subs.map((sub, i) => (
          <button
            key={i}
            onClick={() => onSwap(sub)}
            className="w-full text-left px-4 py-3.5 rounded-[14px] border border-hair text-[14px] font-semibold text-tx-2 press-scale hover:border-points transition-colors"
          >
            {sub}
          </button>
        ))}
        <p className="text-[12px] text-tx-3 mt-3">Tap a substitute to swap it in. Prescribed sets carry over.</p>
      </div>
    </Sheet>
  );
}

// ─── Log Activity Sheet ──────────────────────────────────────
function LogActivitySheet({ onClose }) {
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  async function handleLog() {
    if (!type || !duration) return;
    setSaving(true);

    // Double-count guard
    try {
      const check = await api.checkDuplicate(type);
      if (check.exists && !duplicateWarning) {
        setDuplicateWarning(check.existing);
        setSaving(false);
        return;
      }
    } catch { /* offline, proceed */ }

    try {
      await api.logExercise({ type, duration_min: parseInt(duration), intensity: 'moderate' });
    } catch { /* offline */ }
    setSaving(false);
    onClose();
  }

  return (
    <Sheet open={true} onClose={onClose} title="Log activity">
      <div className="px-5 pb-6 space-y-4">
        {/* Activity type chips */}
        <div>
          <p className="text-[12.5px] font-bold text-tx-3 mb-2">Activity</p>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_TYPES.map(at => (
              <button
                key={at.id}
                onClick={() => { setType(at.id); setDuplicateWarning(null); }}
                className="h-[52px] rounded-[13px] text-[15px] font-bold press-scale flex items-center justify-center gap-2"
                style={{
                  background: type === at.id ? 'color-mix(in oklab, var(--points) 14%, transparent)' : 'transparent',
                  border: type === at.id ? '2px solid var(--points)' : '1px solid var(--hair)',
                  color: 'var(--text)',
                }}
              >
                <span className="w-[10px] h-[10px] rounded-full" style={{ background: at.color }} />
                {at.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <p className="text-[12.5px] font-bold text-tx-3 mb-2">Duration</p>
          <div className="flex gap-2">
            {[20, 30, 45, 60].map(d => (
              <button
                key={d}
                onClick={() => setDuration(String(d))}
                className="flex-1 h-[48px] rounded-[12px] text-[15px] font-semibold font-num press-scale"
                style={{
                  background: duration === String(d) ? 'color-mix(in oklab, var(--points) 14%, transparent)' : 'transparent',
                  border: duration === String(d) ? '2px solid var(--points)' : '1px solid var(--hair)',
                  color: 'var(--text)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={!['20','30','45','60'].includes(duration) ? duration : ''}
            onChange={e => setDuration(e.target.value)}
            placeholder="Custom minutes"
            className="mt-2 w-full px-3 py-2.5 rounded-[13px] border border-hair text-[14px] text-tx bg-card-2"
          />
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="p-3.5 rounded-[14px] border border-star/30 tint-cal text-[13px] text-tx-2">
            You've already logged a {duplicateWarning.type} session today ({duplicateWarning.duration_min} min).
            <button onClick={handleLog} className="block mt-2 text-points font-bold">Add a second session anyway</button>
          </div>
        )}

        <button
          onClick={handleLog}
          disabled={!type || !duration || saving}
          className="w-full h-[54px] rounded-[14px] text-[16px] font-bold press-scale disabled:opacity-40"
          style={{ background: 'var(--points)', color: 'var(--accent-surface)' }}
        >
          {saving ? 'Saving...' : 'Log it'}
        </button>
      </div>
    </Sheet>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00Z');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getUTCDay()];
}

function formatWorkoutType(type) {
  const map = {
    fullbody_a: 'Full Body A', fullbody_b: 'Full Body B', fullbody_c: 'Full Body C',
    upper_a: 'Upper A', lower_a: 'Lower A', upper_b: 'Upper B', lower_b: 'Lower B',
  };
  return map[type] || type;
}

function formatTodayLong() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function todayStr() {
  return new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
}

function LoadingState() {
  return (
    <div className="flex justify-center items-center h-40">
      <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
    </div>
  );
}
