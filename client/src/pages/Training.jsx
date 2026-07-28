import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import MuscleHighlight from '../components/MuscleHighlight';
import Sheet from '../components/Sheet';

export default function Training() {
  const [tab, setTab] = useState('workout');
  const [data, setData] = useState(null);
  const [volume, setVolume] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <LoadingState />;
  if (!data) return <div className="p-4 text-center text-tx-3 text-sm">Could not load training data</div>;

  return (
    <div className="px-4 pb-4 tab-fade-enter">
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-bold text-tx">Training</h1>
      </div>

      {/* Tab bar */}
      <div className="mb-4">
        <div className="flex bg-card rounded-card p-1 gap-1">
          {[
            { id: 'workout', label: 'Workout' },
            { id: 'exercises', label: 'Exercises' },
            { id: 'progress', label: 'Progress' },
            { id: 'volume', label: 'Volume' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-[12px] text-sm transition-colors ${
                tab === t.id ? 'bg-card-2 text-tx shadow-subtle' : 'text-tx-3'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tab-fade-enter">
        {tab === 'workout' && <WorkoutTab data={data} onReload={load} />}
        {tab === 'exercises' && <ExercisesTab />}
        {tab === 'progress' && <ProgressTab />}
        {tab === 'volume' && <VolumeTab data={data} volume={volume} />}
      </div>
    </div>
  );
}

// ─── Workout Tab ─────────────────────────────────────────────
function WorkoutTab({ data, onReload }) {
  const [activeSession, setActiveSession] = useState(null);
  const [sessionSets, setSessionSets] = useState({});
  const [startTime, setStartTime] = useState(null);
  const { frequency, next_workout, last_numbers, swim_note, rotation } = data;

  async function handleStartWorkout() {
    const result = await api.startSession();
    setActiveSession(result);
    setStartTime(Date.now());
    // Pre-fill from last session
    const prefilled = {};
    for (const ex of next_workout.exercises) {
      if (ex.exercise_id && last_numbers[ex.exercise_id]) {
        prefilled[ex.exercise_id] = last_numbers[ex.exercise_id].map(s => ({
          set_number: s.set_number,
          weight_kg: s.weight_kg || '',
          reps: s.reps || '',
          saved: false,
        }));
      }
    }
    setSessionSets(prefilled);
  }

  async function handleSaveSet(exerciseId, setNum, weight, reps) {
    if (!activeSession) return;
    await api.logSet(activeSession.session_id, {
      exercise_id: exerciseId,
      set_number: setNum,
      weight_kg: parseFloat(weight) || 0,
      reps: parseInt(reps) || 0,
    });
    // Mark saved
    setSessionSets(prev => {
      const exSets = [...(prev[exerciseId] || [])];
      const idx = exSets.findIndex(s => s.set_number === setNum);
      if (idx >= 0) exSets[idx] = { ...exSets[idx], saved: true };
      return { ...prev, [exerciseId]: exSets };
    });
  }

  function handleAddSet(exerciseId) {
    setSessionSets(prev => {
      const exSets = [...(prev[exerciseId] || [])];
      const nextNum = exSets.length > 0 ? Math.max(...exSets.map(s => s.set_number)) + 1 : 1;
      const lastSet = exSets[exSets.length - 1];
      exSets.push({
        set_number: nextNum,
        weight_kg: lastSet?.weight_kg || '',
        reps: lastSet?.reps || '',
        saved: false,
      });
      return { ...prev, [exerciseId]: exSets };
    });
  }

  function handleSetChange(exerciseId, setNum, field, value) {
    setSessionSets(prev => {
      const exSets = [...(prev[exerciseId] || [])];
      const idx = exSets.findIndex(s => s.set_number === setNum);
      if (idx >= 0) exSets[idx] = { ...exSets[idx], [field]: value, saved: false };
      return { ...prev, [exerciseId]: exSets };
    });
  }

  async function handleFinishWorkout() {
    if (!activeSession) return;
    const duration = startTime ? Math.round((Date.now() - startTime) / 60000) : 60;
    await api.completeSession(activeSession.session_id, duration);
    setActiveSession(null);
    setSessionSets({});
    setStartTime(null);
    onReload();
  }

  async function handleFrequencyChange(newFreq) {
    await api.setFrequency(newFreq);
    onReload();
  }

  return (
    <div className="space-y-3">
      {/* Frequency selector */}
      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Gym frequency this week</p>
        <div className="flex gap-2">
          {[3, 4].map(f => (
            <button
              key={f}
              onClick={() => handleFrequencyChange(f)}
              className={`flex-1 py-2.5 rounded-card text-sm border transition-colors press-scale ${
                frequency === f
                  ? 'border-points tint-points text-points'
                  : 'border-hair bg-card text-tx-3'
              }`}
            >
              {f} days — {f === 3 ? 'Full Body' : 'Upper/Lower'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-tx-3 mt-2">
          {frequency === 3 ? 'Full Body A / B / C rotation — every muscle 3x/week' : 'Upper A / Lower A / Upper B / Lower B — every muscle 2x/week'}
        </p>
      </div>

      {/* Rotation overview */}
      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Programme rotation</p>
        <div className="flex gap-2">
          {rotation.map((w, i) => (
            <div
              key={w.type}
              className={`flex-1 py-2 px-1 rounded-card text-center border transition-colors ${
                i === data.workout_index
                  ? 'border-points tint-points'
                  : 'border-hair'
              }`}
            >
              <p className={`text-xs font-medium ${i === data.workout_index ? 'text-points' : 'text-tx-2'}`}>{w.label}</p>
              <p className="text-[10px] text-tx-3 mt-0.5">{w.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Swim note */}
      {swim_note && (
        <div className="px-4 py-3 rounded-card tint-drinks border border-drinks/20 text-sm text-tx-2 stagger-enter">
          {swim_note}
        </div>
      )}

      {/* Active workout session */}
      {activeSession ? (
        <ActiveWorkout
          workout={next_workout}
          sessionSets={sessionSets}
          lastNumbers={last_numbers}
          onSaveSet={handleSaveSet}
          onAddSet={handleAddSet}
          onSetChange={handleSetChange}
          onFinish={handleFinishWorkout}
          startTime={startTime}
        />
      ) : (
        <>
          {/* Next workout card */}
          <div className="bg-card rounded-card p-4 stagger-enter">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">Next workout</p>
            <h3 className="text-lg font-semibold text-tx">{next_workout.label}</h3>
            <p className="text-xs text-tx-3 mb-3">{next_workout.subtitle}</p>

            <div className="space-y-2 mb-4">
              {next_workout.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-hair last:border-0">
                  <span className="text-sm text-tx-2">{ex.name}</span>
                  <span className="text-xs font-num text-tx-3">{ex.sets}×{ex.reps}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartWorkout}
              className="w-full py-3.5 bg-points text-white rounded-card text-sm press-scale"
            >
              Start workout
            </button>
          </div>

          {/* Recent sessions */}
          {data.recent_sessions.length > 0 && (
            <div className="bg-card rounded-card p-4 stagger-enter">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Recent sessions</p>
              <div className="space-y-2">
                {data.recent_sessions.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between py-1">
                    <div>
                      <span className="text-sm text-tx-2">{formatWorkoutType(s.workout_type)}</span>
                      <span className="text-xs text-tx-3 ml-2">{formatDate(s.date)}</span>
                    </div>
                    {s.duration_min && <span className="text-xs font-num text-tx-3">{s.duration_min} min</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Active Workout ──────────────────────────────────────────
function ActiveWorkout({ workout, sessionSets, lastNumbers, onSaveSet, onAddSet, onSetChange, onFinish, startTime }) {
  const [swapExercise, setSwapExercise] = useState(null);
  const [exerciseDetail, setExerciseDetail] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime) / 60000));
    }, 30000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-card p-4 stagger-enter">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-tx">{workout.label}</h3>
            <p className="text-xs text-tx-3">{workout.subtitle} {elapsed > 0 && `— ${elapsed} min`}</p>
          </div>
          <button
            onClick={onFinish}
            className="px-4 py-2 bg-points text-white rounded-card text-sm press-scale"
          >
            Finish
          </button>
        </div>
      </div>

      {workout.exercises.map((ex, i) => {
        const exId = ex.exercise_id;
        const sets = sessionSets[exId] || [];
        const last = lastNumbers[exId] || [];
        const targetSets = ex.sets;

        // Initialize sets if empty
        if (sets.length === 0 && exId) {
          const initial = [];
          for (let s = 1; s <= targetSets; s++) {
            const lastSet = last.find(l => l.set_number === s);
            initial.push({
              set_number: s,
              weight_kg: lastSet?.weight_kg || '',
              reps: lastSet?.reps || '',
              saved: false,
            });
          }
          if (initial.length > 0) {
            // Trigger state update on mount
            setTimeout(() => {
              for (const s of initial) {
                onSetChange(exId, s.set_number, 'weight_kg', s.weight_kg);
              }
            }, 0);
          }
        }

        return (
          <div key={i} className="bg-card rounded-card p-4 stagger-enter">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => exId && setExerciseDetail(exId)} className="text-left flex-1">
                <p className="text-sm font-medium text-tx">{ex.name}</p>
                <p className="text-[10px] text-tx-3">{ex.sets}×{ex.reps} target</p>
              </button>
              <button
                onClick={() => setSwapExercise(ex)}
                className="text-[10px] text-tx-3 px-2 py-1 rounded border border-hair press-scale"
              >
                Swap
              </button>
            </div>

            {/* Last session reference */}
            {last.length > 0 && (
              <p className="text-[10px] text-tx-3 mb-2">
                Last: {last.map(l => `${l.weight_kg}kg×${l.reps}`).join(', ')}
              </p>
            )}

            {/* Set logging rows */}
            <div className="space-y-1.5">
              {(sets.length > 0 ? sets : Array.from({ length: targetSets }, (_, s) => ({
                set_number: s + 1,
                weight_kg: last[s]?.weight_kg || '',
                reps: last[s]?.reps || '',
                saved: false,
              }))).map((set) => (
                <div key={set.set_number} className="flex items-center gap-2">
                  <span className="text-[10px] text-tx-3 w-4">{set.set_number}</span>
                  <input
                    type="number"
                    value={set.weight_kg}
                    onChange={e => onSetChange(exId, set.set_number, 'weight_kg', e.target.value)}
                    placeholder="kg"
                    className="flex-1 px-2 py-1.5 rounded-lg border border-hair text-sm text-tx bg-card-2 text-center font-num"
                  />
                  <span className="text-tx-3 text-xs">×</span>
                  <input
                    type="number"
                    value={set.reps}
                    onChange={e => onSetChange(exId, set.set_number, 'reps', e.target.value)}
                    placeholder="reps"
                    className="flex-1 px-2 py-1.5 rounded-lg border border-hair text-sm text-tx bg-card-2 text-center font-num"
                  />
                  <button
                    onClick={() => onSaveSet(exId, set.set_number, set.weight_kg, set.reps)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center press-scale ${
                      set.saved ? 'bg-points' : 'border border-hair'
                    }`}
                  >
                    <svg className={`w-4 h-4 ${set.saved ? 'text-white' : 'text-tx-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => onAddSet(exId)}
              className="mt-2 w-full py-1.5 text-xs text-points border border-points/20 rounded-lg press-scale"
            >
              + Add set
            </button>
          </div>
        );
      })}

      {/* Exercise detail sheet */}
      {exerciseDetail && (
        <ExerciseDetailSheet
          exerciseId={exerciseDetail}
          onClose={() => setExerciseDetail(null)}
        />
      )}

      {/* Swap exercise sheet */}
      {swapExercise && (
        <SwapSheet
          exercise={swapExercise}
          onClose={() => setSwapExercise(null)}
        />
      )}
    </div>
  );
}

// ─── Exercise Detail Sheet ───────────────────────────────────
function ExerciseDetailSheet({ exerciseId, onClose }) {
  const [ex, setEx] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getExercise(exerciseId),
      api.getExerciseHistory(exerciseId),
    ]).then(([e, h]) => {
      setEx(e);
      setHistory(h);
    });
  }, [exerciseId]);

  if (!ex) return null;

  const youtubeUrl = ex.youtube_search_term
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.youtube_search_term)}`
    : null;

  return (
    <Sheet open={true} onClose={onClose} title={ex.name} height="tall">
      <div className="px-5 pb-6 space-y-5">
        {/* Muscle diagram */}
        <MuscleHighlight
          primaryMuscles={ex.primary_muscles}
          secondaryMuscles={ex.secondary_muscles}
        />

        <div className="flex gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'color-mix(in oklab, var(--protein) 60%, transparent)' }} />
            <span className="text-tx-3">Primary</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'color-mix(in oklab, var(--cal) 40%, transparent)' }} />
            <span className="text-tx-3">Secondary</span>
          </div>
        </div>

        {/* Target muscles */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">Target muscles</p>
          <p className="text-sm text-tx-2">
            <span className="text-protein">{ex.primary_muscles.map(m => m.replace(/_/g, ' ')).join(', ')}</span>
            {ex.secondary_muscles.length > 0 && (
              <span className="text-tx-3"> + {ex.secondary_muscles.map(m => m.replace(/_/g, ' ')).join(', ')}</span>
            )}
          </p>
        </div>

        {/* Form cues */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">Form cues</p>
          <ul className="space-y-1.5">
            {ex.form_cues.map((cue, i) => (
              <li key={i} className="text-sm text-tx-2 flex gap-2">
                <span className="text-points font-medium flex-shrink-0">{i + 1}.</span>
                {cue}
              </li>
            ))}
          </ul>
        </div>

        {/* Common mistakes */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">Common mistakes</p>
          <ul className="space-y-1.5">
            {ex.common_mistakes.map((m, i) => (
              <li key={i} className="text-sm text-tx-2 flex gap-2">
                <span className="text-cal flex-shrink-0">!</span>
                {m}
              </li>
            ))}
          </ul>
        </div>

        {/* Progression chart */}
        {history && history.history.length >= 2 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Estimated 1RM trend</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={history.history.map(h => ({ date: formatDate(h.date), e1rm: h.e1rm }))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--hair)', borderRadius: 12, fontSize: 12 }} formatter={v => [`${v} kg`, 'Est. 1RM']} />
                <Line type="monotone" dataKey="e1rm" stroke="var(--points)" strokeWidth={2} dot={{ r: 2.5, fill: 'var(--points)' }} />
              </LineChart>
            </ResponsiveContainer>
            {history.progression_note && (
              <p className="text-xs text-points mt-2">{history.progression_note}</p>
            )}
          </div>
        )}

        {/* YouTube link */}
        {youtubeUrl && (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 rounded-card border border-hair text-sm text-tx-2 press-scale"
          >
            <svg className="w-5 h-5 text-danger" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            Watch form demo
          </a>
        )}
      </div>
    </Sheet>
  );
}

// ─── Swap Sheet ──────────────────────────────────────────────
function SwapSheet({ exercise, onClose }) {
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    if (!exercise.exercise_id) return;
    api.getExercise(exercise.exercise_id).then(ex => {
      setSubs(ex.substitutes || []);
    });
  }, [exercise.exercise_id]);

  return (
    <Sheet open={true} onClose={onClose} title={`Swap ${exercise.name}`}>
      <div className="px-5 pb-6 space-y-3">
        <p className="text-sm text-tx-3">Same muscle group alternatives:</p>
        {subs.length > 0 ? subs.map((sub, i) => (
          <div key={i} className="px-4 py-3 rounded-card border border-hair text-sm text-tx-2">
            {sub}
          </div>
        )) : (
          <p className="text-sm text-tx-3">No alternatives available</p>
        )}
        <p className="text-[10px] text-tx-3 mt-2">Swap manually — pick any equivalent from the list and perform it instead.</p>
      </div>
    </Sheet>
  );
}

// ─── Exercises Tab ───────────────────────────────────────────
function ExercisesTab() {
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getExercises().then(data => {
      setExercises(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState />;

  // Group by primary muscle
  const grouped = {};
  for (const ex of exercises) {
    const primary = ex.primary_muscles[0] || 'other';
    if (!grouped[primary]) grouped[primary] = [];
    grouped[primary].push(ex);
  }

  const muscleOrder = ['chest', 'quads', 'hamstrings', 'glutes', 'lats', 'upper_back', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'abs', 'calves', 'traps', 'lower_back'];

  return (
    <div className="space-y-3">
      {muscleOrder.filter(m => grouped[m]).map(muscle => (
        <div key={muscle} className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">{muscle.replace(/_/g, ' ')}</p>
          <div className="space-y-1">
            {grouped[muscle].map(ex => (
              <button
                key={ex.id}
                onClick={() => setSelected(ex.id)}
                className="w-full flex items-center justify-between py-2 border-b border-hair last:border-0 text-left press-scale"
              >
                <span className="text-sm text-tx-2">{ex.name}</span>
                <svg className="w-4 h-4 text-tx-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <ExerciseDetailSheet exerciseId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Progress Tab ────────────────────────────────────────────
function ProgressTab() {
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getExercises().then(data => {
      setExercises(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selected) {
      api.getExerciseHistory(selected).then(setHistory);
    }
  }, [selected]);

  if (loading) return <LoadingState />;

  const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--hair)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--text-2)',
  };

  return (
    <div className="space-y-3">
      {/* Exercise selector */}
      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Select exercise</p>
        <select
          value={selected || ''}
          onChange={e => setSelected(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-3 py-2.5 rounded-card border border-hair text-sm text-tx bg-card-2"
        >
          <option value="">Choose an exercise...</option>
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </select>
      </div>

      {/* History chart */}
      {history && history.history.length >= 2 && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-xs text-tx-3 mb-3">Estimated 1RM over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history.history.map(h => ({ date: formatDate(h.date), e1rm: h.e1rm, weight: h.top_weight }))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="e1rm" stroke="var(--points)" strokeWidth={2} dot={{ r: 2.5, fill: 'var(--points)' }} name="Est. 1RM" />
              <Line type="monotone" dataKey="weight" stroke="var(--cal)" strokeWidth={1.5} dot={{ r: 2, fill: 'var(--cal)' }} name="Top set" />
            </LineChart>
          </ResponsiveContainer>
          {history.progression_note && (
            <p className="text-sm text-points mt-3 px-1">{history.progression_note}</p>
          )}
        </div>
      )}

      {history && history.history.length > 0 && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-xs text-tx-3 mb-2">Session history</p>
          <div className="space-y-1.5">
            {history.history.slice(-10).reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-hair last:border-0">
                <span className="text-sm text-tx-2">{formatDate(h.date)}</span>
                <span className="text-sm font-num text-tx-3">{h.top_weight}kg × {h.top_reps} ({h.total_sets} sets)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history && history.history.length === 0 && selected && (
        <div className="bg-card rounded-card p-6 text-center text-tx-3 text-sm">
          No data yet for this exercise
        </div>
      )}
    </div>
  );
}

// ─── Volume Tab ──────────────────────────────────────────────
function VolumeTab({ data, volume }) {
  const muscleOrder = ['chest', 'quads', 'hamstrings', 'glutes', 'lats', 'upper_back', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'abs', 'calves', 'lower_back'];

  return (
    <div className="space-y-3">
      {/* Weekly summary */}
      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">This week</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xl font-num font-semibold text-tx">{data.week_gym_sessions}</div>
            <div className="text-[10px] text-tx-3">gym sessions</div>
          </div>
          <div>
            <div className="text-xl font-num font-semibold text-drinks">{data.week_swim_sessions}</div>
            <div className="text-[10px] text-tx-3">swim sessions</div>
          </div>
          <div>
            <div className="text-xl font-num font-semibold text-points">{volume?.total_exercise_sessions || 0}</div>
            <div className="text-[10px] text-tx-3">total sessions</div>
          </div>
        </div>
      </div>

      {/* Sets per muscle */}
      {volume && Object.keys(volume.sets_per_muscle).length > 0 && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Sets per muscle group</p>
          <div className="space-y-2">
            {muscleOrder.filter(m => volume.sets_per_muscle[m]).map(muscle => {
              const sets = volume.sets_per_muscle[muscle];
              const maxSets = Math.max(...Object.values(volume.sets_per_muscle));
              const pct = maxSets > 0 ? (sets / maxSets) * 100 : 0;
              return (
                <div key={muscle}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-tx-2 capitalize">{muscle.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-num text-tx-3">{sets} sets</span>
                  </div>
                  <div className="h-1.5 bg-card-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-points progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gym details */}
      {volume?.gym_details?.length > 0 && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Gym sessions</p>
          <div className="space-y-1.5">
            {volume.gym_details.map(s => (
              <div key={s.id} className="flex items-center justify-between py-1 border-b border-hair last:border-0">
                <span className="text-sm text-tx-2">{formatWorkoutType(s.workout_type)}</span>
                <div className="text-right">
                  <span className="text-xs text-tx-3">{formatDate(s.date)}</span>
                  {s.duration_min && <span className="text-xs font-num text-tx-3 ml-2">{s.duration_min} min</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Swim details */}
      {volume?.swim_details?.length > 0 && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Swim sessions</p>
          <div className="space-y-1.5">
            {volume.swim_details.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-hair last:border-0">
                <span className="text-sm text-tx-2">Swimming</span>
                <div className="text-right">
                  <span className="text-xs text-tx-3">{formatDate(s.date)}</span>
                  <span className="text-xs font-num text-tx-3 ml-2">{s.duration_min} min</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!volume || Object.keys(volume.sets_per_muscle).length === 0) && (
        <div className="bg-card rounded-card p-6 text-center text-tx-3 text-sm stagger-enter">
          Complete a gym session to see volume data
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00Z');
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

function formatWorkoutType(type) {
  const map = {
    fullbody_a: 'Full Body A',
    fullbody_b: 'Full Body B',
    fullbody_c: 'Full Body C',
    upper_a: 'Upper A',
    lower_a: 'Lower A',
    upper_b: 'Upper B',
    lower_b: 'Lower B',
  };
  return map[type] || type;
}

function LoadingState() {
  return (
    <div className="flex justify-center items-center h-40">
      <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
    </div>
  );
}
