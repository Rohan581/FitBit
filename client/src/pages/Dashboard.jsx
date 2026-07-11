import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { MacroBar, CalorieRing } from '../components/MacroBar';
import ExerciseSheet from '../components/ExerciseSheet';
import SleepSheet from '../components/SleepSheet';
import WeightSheet from '../components/WeightSheet';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExercise, setShowExercise] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showWeight, setShowWeight] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.getDashboard();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (!data) return <ErrorState onRetry={load} />;

  const { food_totals, goal, daily_points, weekly_points, threshold, treat_earned, treat_redeemed, exercise_logs, sleep_log, weight_log, rolling_avg_weight, notifications } = data;

  const calTarget = goal?.current_calorie_target || 2240;
  const proTarget = goal?.current_protein_target_g || 180;
  const carbTarget = goal?.current_carb_target_g || 240;
  const fatTarget = goal?.current_fat_target_g || 62;
  const weeklyPct = threshold > 0 ? Math.min((weekly_points / threshold) * 100, 100) : 0;

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <p className="text-xs text-warm-400 font-medium uppercase tracking-wide">{todayLabel}</p>
        <h1 className="text-2xl font-bold text-warm-800 mt-0.5">Today</h1>
      </div>

      {/* Notifications */}
      {notifications?.length > 0 && (
        <div className="px-4 mb-3 space-y-2">
          {notifications.map((n, i) => (
            <div key={i} className={`px-4 py-3 rounded-xl text-sm ${
              n.type === 'milestone' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
              n.type === 'stall' ? 'bg-warm-100 text-warm-600 border border-warm-200' :
              'bg-warm-100 text-warm-600 border border-warm-200'
            }`}>
              {n.type === 'milestone' && <span className="font-semibold">🎯 </span>}
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* Calories + Macros card */}
      <div className="mx-4 bg-white rounded-2xl shadow-card p-4 mb-3">
        <div className="flex items-center gap-4">
          <CalorieRing current={food_totals.calories} target={calTarget} size={88} />
          <div className="flex-1 space-y-3">
            <MacroBar label="Protein" current={food_totals.protein_g} target={proTarget} color="bg-blue-400" />
            <MacroBar label="Carbs" current={food_totals.carbs_g} target={carbTarget} color="bg-green-400" />
            <MacroBar label="Fat" current={food_totals.fat_g} target={fatTarget} color="bg-orange-300" />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-warm-100">
          <p className="text-xs text-warm-400">
            {Math.round(calTarget - food_totals.calories) > 0
              ? `${Math.round(calTarget - food_totals.calories)} kcal remaining`
              : `${Math.round(food_totals.calories - calTarget)} kcal over target`
            }
          </p>
        </div>
      </div>

      {/* Weekly Points */}
      <div className="mx-4 bg-white rounded-2xl shadow-card p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-warm-700">Weekly Points</span>
          <Link to="/points" className="text-xs text-amber-600 font-medium">View →</Link>
        </div>
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-bold text-warm-800">{Math.round(weekly_points)}</span>
          <span className="text-sm text-warm-400">/ {threshold} pts</span>
          {treat_earned && !treat_redeemed && (
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Treat earned!</span>
          )}
          {treat_redeemed && (
            <span className="ml-auto text-xs bg-warm-100 text-warm-500 px-2 py-0.5 rounded-full font-medium">Treat redeemed</span>
          )}
        </div>
        <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full progress-fill ${treat_earned ? 'bg-amber-400' : 'bg-amber-500'}`}
            style={{ width: `${weeklyPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] text-warm-400">
          <span>Today: {daily_points.total} pts</span>
          <span>{Math.round(threshold - weekly_points > 0 ? threshold - weekly_points : 0)} pts to treat</span>
        </div>
      </div>

      {/* Today status row */}
      <div className="mx-4 grid grid-cols-3 gap-2.5 mb-4">
        <StatusCard
          label="Exercise"
          value={exercise_logs?.length > 0 ? exercise_logs.map(e => e.type).join(', ') : null}
          empty="Not logged"
          onClick={() => setShowExercise(true)}
          emoji="🏋️"
          logged={exercise_logs?.length > 0}
        />
        <StatusCard
          label="Sleep"
          value={sleep_log ? `${sleep_log.hours}h` : null}
          empty="Not logged"
          onClick={() => setShowSleep(true)}
          emoji="😴"
          logged={!!sleep_log}
        />
        <StatusCard
          label="Weight"
          value={weight_log ? `${weight_log.weight_kg}kg` : null}
          empty="Not logged"
          onClick={() => setShowWeight(true)}
          emoji="⚖️"
          logged={!!weight_log}
          sub={rolling_avg_weight ? `avg ${rolling_avg_weight}kg` : null}
        />
      </div>

      {/* Quick log row */}
      <div className="mx-4">
        <p className="text-xs font-medium text-warm-400 mb-2">Quick log</p>
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            to="/food"
            className="flex items-center gap-3 px-4 py-3.5 bg-amber-500 text-white rounded-xl font-semibold text-sm active:bg-amber-600 transition-colors"
          >
            <span className="text-xl">🍽️</span>
            Log Food
          </Link>
          <button
            onClick={() => setShowExercise(true)}
            className="flex items-center gap-3 px-4 py-3.5 bg-white text-warm-700 rounded-xl font-semibold text-sm shadow-card border border-warm-100 active:bg-warm-50"
          >
            <span className="text-xl">🏋️</span>
            Exercise
          </button>
          <button
            onClick={() => setShowSleep(true)}
            className="flex items-center gap-3 px-4 py-3.5 bg-white text-warm-700 rounded-xl font-semibold text-sm shadow-card border border-warm-100 active:bg-warm-50"
          >
            <span className="text-xl">😴</span>
            Sleep
          </button>
          <button
            onClick={() => setShowWeight(true)}
            className="flex items-center gap-3 px-4 py-3.5 bg-white text-warm-700 rounded-xl font-semibold text-sm shadow-card border border-warm-100 active:bg-warm-50"
          >
            <span className="text-xl">⚖️</span>
            Weight
          </button>
        </div>
      </div>

      {/* Points breakdown */}
      {daily_points?.breakdown?.length > 0 && (
        <div className="mx-4 mt-4">
          <p className="text-xs font-medium text-warm-400 mb-2">Today's points</p>
          <div className="bg-white rounded-2xl shadow-card divide-y divide-warm-50">
            {daily_points.breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{categoryEmoji(b.category)}</span>
                  <span className="text-sm text-warm-600">{b.reason}</span>
                </div>
                <span className="text-sm font-semibold text-amber-600">+{b.points}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-2.5 bg-warm-50 rounded-b-2xl">
              <span className="text-sm font-semibold text-warm-700">Total today</span>
              <span className="text-sm font-bold text-amber-600">{daily_points.total} pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Sheets */}
      <ExerciseSheet open={showExercise} onClose={() => setShowExercise(false)} onLogged={load} />
      <SleepSheet open={showSleep} onClose={() => setShowSleep(false)} onLogged={load} existing={sleep_log} />
      <WeightSheet open={showWeight} onClose={() => setShowWeight(false)} onLogged={load} existing={weight_log} />
    </div>
  );
}

function StatusCard({ label, value, empty, onClick, emoji, logged, sub }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all active:scale-95 ${
        logged ? 'bg-amber-50 border-amber-200' : 'bg-white border-warm-200 shadow-card'
      }`}
    >
      <span className="text-xl mb-1">{emoji}</span>
      <span className="text-[10px] font-medium text-warm-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-semibold mt-0.5 truncate w-full ${logged ? 'text-amber-700' : 'text-warm-400'}`}>
        {value || empty}
      </span>
      {sub && <span className="text-[10px] text-warm-400">{sub}</span>}
    </button>
  );
}

function categoryEmoji(cat) {
  const map = { calories: '🔥', protein: '💪', exercise: '🏋️', sleep: '😴', streak: '⭐' };
  return map[cat] || '•';
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
      <p className="text-sm text-warm-400">Loading...</p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-8 text-center">
      <p className="text-warm-600">Couldn't load dashboard</p>
      <button onClick={onRetry} className="text-sm text-amber-600 font-medium">Try again</button>
    </div>
  );
}
