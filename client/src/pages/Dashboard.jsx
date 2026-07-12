import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { MacroBar, PointsRing, CountUp } from '../components/MacroBar';
import ExerciseSheet from '../components/ExerciseSheet';
import SleepSheet from '../components/SleepSheet';
import WeightSheet from '../components/WeightSheet';
import { Link, useNavigate } from 'react-router-dom';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExercise, setShowExercise] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const navigate = useNavigate();

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

  const { food_totals, goal, daily_points, weekly_points, threshold, treat_earned, rolling_avg_weight, notifications } = data;

  const calTarget = goal?.current_calorie_target || 2240;
  const proTarget = goal?.current_protein_target_g || 180;
  const remaining = Math.max(0, Math.round(threshold - weekly_points));
  const streak = daily_points?.streak || 0;

  // Determine weight trend
  const weightTrendDown = rolling_avg_weight && goal?.goal_weight_kg && rolling_avg_weight > goal.goal_weight_kg;

  // Latest activity from today's points breakdown
  const latestActivity = daily_points?.breakdown?.length > 0
    ? daily_points.breakdown[daily_points.breakdown.length - 1]
    : null;

  return (
    <div className="px-4 pb-4">
      {/* Milestone notifications */}
      {notifications?.length > 0 && (
        <div className="mb-3 stagger-enter">
          {notifications.map((n, i) => (
            <div key={i} className="px-4 py-3 rounded-card bg-accent-tint border border-accent/20 text-sm text-warm-700 mb-2">
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between pt-5 pb-5 stagger-enter">
        <div>
          <p className="text-xs text-warm-400">{formatTodayDate()}</p>
          <h1 className="text-[22px] font-medium text-warm-800 mt-0.5">{getGreeting()}, Rohan</h1>
        </div>
        {rolling_avg_weight && (
          <button
            onClick={() => navigate('/trends')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-warm-100 rounded-full press-scale"
          >
            <span className="text-sm text-warm-700">{rolling_avg_weight} kg</span>
            <svg className={`w-3.5 h-3.5 text-warm-500 ${weightTrendDown ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Points hero card */}
      <div className="bg-warm-100 rounded-card p-4 mb-3 stagger-enter">
        <div className="flex items-center gap-4">
          <PointsRing current={weekly_points} target={threshold} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-warm-700">Weekly points</p>
            <p className="text-xs text-warm-400 mt-1">
              {treat_earned
                ? 'Flex meal unlocked!'
                : `${remaining} pts to your flex meal`
              }
            </p>
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-accent-tint text-accent text-[11px] rounded-full">
                <FlameIcon />
                {streak}-day streak
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Macros card */}
      <div className="bg-warm-100 rounded-card p-4 mb-3 stagger-enter">
        <MacroBar
          label="Calories"
          current={food_totals.calories}
          target={calTarget}
          variant="calories"
        />
        <div className="mt-3">
          <MacroBar
            label="Protein"
            current={food_totals.protein_g}
            target={proTarget}
            variant="protein"
          />
        </div>
      </div>

      {/* Quick log grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 stagger-enter">
        <Link
          to="/food"
          className="flex items-center gap-3 px-4 py-3.5 bg-accent text-white rounded-card text-sm press-scale"
        >
          <FoodIcon />
          Log food
        </Link>
        <button
          onClick={() => setShowExercise(true)}
          className="flex items-center gap-3 px-4 py-3.5 bg-warm-100 text-warm-700 rounded-card text-sm border border-warm-200 press-scale"
        >
          <ExerciseIcon />
          Log workout
        </button>
        <button
          onClick={() => setShowSleep(true)}
          className="flex items-center gap-3 px-4 py-3.5 bg-warm-100 text-warm-700 rounded-card text-sm border border-warm-200 press-scale"
        >
          <SleepIcon />
          Log sleep
        </button>
        <button
          onClick={() => setShowWeight(true)}
          className="flex items-center gap-3 px-4 py-3.5 bg-warm-100 text-warm-700 rounded-card text-sm border border-warm-200 press-scale"
        >
          <ScaleIcon />
          Log weight
        </button>
      </div>

      {/* Latest activity */}
      {latestActivity && (
        <Link
          to="/food"
          className="block bg-warm-100 rounded-card px-4 py-3 stagger-enter press-scale"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-warm-600 truncate">{latestActivity.reason}</p>
              <p className="text-xs text-warm-400 mt-0.5">+{latestActivity.points} pts</p>
            </div>
            <svg className="w-4 h-4 text-warm-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Settings link */}
      <div className="mt-4 stagger-enter">
        <Link
          to="/settings"
          className="flex items-center gap-2 text-xs text-warm-400 px-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
      </div>

      {/* Sheets */}
      <ExerciseSheet open={showExercise} onClose={() => setShowExercise(false)} onLogged={load} />
      <SleepSheet open={showSleep} onClose={() => setShowSleep(false)} onLogged={load} existing={data.sleep_log} />
      <WeightSheet open={showWeight} onClose={() => setShowWeight(false)} onLogged={load} existing={data.weight_log} />
    </div>
  );
}

function FlameIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1c.3 0 .5.2.6.4C9.8 4.2 11 5.5 11 7.5c0 .8-.3 1.5-.7 2 .2-.5.2-1 .1-1.5-.2-.8-.7-1.5-1.4-2-.1-.1-.3-.1-.4 0-.7.5-1.2 1.2-1.4 2-.1.5-.1 1 .1 1.5-.4-.5-.7-1.2-.7-2 0-2 1.2-3.3 2.4-6.1 0-.2.2-.4.4-.4z" />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
}

function ExerciseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m-15 0l3-3m-3 3l3 3m12-6l-3 3m3-3l-3-3" />
    </svg>
  );
}

function SleepIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-7 h-7 border-2 border-warm-200 border-t-accent rounded-full animate-spin" />
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-8 text-center">
      <p className="text-sm text-warm-600">Couldn't load dashboard</p>
      <button onClick={onRetry} className="text-sm text-accent">Try again</button>
    </div>
  );
}
