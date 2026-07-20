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

function getWeekStart() {
  const ist = new Date(Date.now() + 330 * 60000);
  const day = ist.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  ist.setUTCDate(ist.getUTCDate() + diff);
  return ist.toISOString().split('T')[0];
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExercise, setShowExercise] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [d, w] = await Promise.all([
        api.getDashboard(),
        api.getWeeklySummary(getWeekStart()),
      ]);
      setData(d);
      setWeekData(w);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setWaterTo(targetGlasses) {
    if (!data) return;
    const currentGlasses = data.water?.glasses || 0;
    const diff = targetGlasses - currentGlasses;
    if (diff === 0) return;

    // Optimistic update
    setData(d => ({ ...d, water: { ...d.water, glasses: targetGlasses } }));

    try {
      const fn = diff > 0 ? api.addWater : api.removeWater;
      for (let i = 0; i < Math.abs(diff); i++) {
        await fn();
      }
    } finally {
      load();
    }
  }

  if (loading) return <LoadingState />;
  if (!data) return <ErrorState onRetry={load} />;

  const { food_totals, goal, daily_points, weekly_points, threshold, treat_earned, rolling_avg_weight, notifications, water } = data;

  const calTarget = goal?.current_calorie_target || 2240;
  const proTarget = goal?.current_protein_target_g || 180;
  const carbTarget = goal?.current_carb_target_g || 250;
  const fatTarget = goal?.current_fat_target_g || 60;
  const fiberTarget = goal?.current_fiber_target_g || 32;
  const sugarLimit = goal?.current_sugar_limit_g || 50;
  const remaining = Math.max(0, Math.round(threshold - weekly_points));
  const streak = daily_points?.streak || 0;
  const pctWeek = threshold > 0 ? Math.round((weekly_points / threshold) * 100) : 0;

  // Water — 8 segments
  const waterGlasses = water?.glasses || 0;
  const waterTargetGlasses = water?.target_glasses || 12;
  const filledSegments = Math.min(8, Math.round(waterGlasses / waterTargetGlasses * 8));

  function handleSegmentTap(segNum) {
    let target;
    if (segNum <= filledSegments) {
      target = Math.round((segNum - 1) * waterTargetGlasses / 8);
    } else {
      target = Math.round(segNum * waterTargetGlasses / 8);
    }
    setWaterTo(target);
  }

  // Weight trend
  const weightTrendDown = rolling_avg_weight && goal?.goal_weight_kg && rolling_avg_weight > goal.goal_weight_kg;

  // Latest activity
  const latestActivity = daily_points?.breakdown?.length > 0
    ? daily_points.breakdown[daily_points.breakdown.length - 1]
    : null;

  // Week strip data
  const today = new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
  const byDay = weekData?.by_day || [];
  const dayThreshold = threshold > 0 ? threshold / 7 : 50;

  return (
    <div className="px-4 pb-4">
      {/* Notifications */}
      {notifications?.length > 0 && (
        <div className="mb-3 stagger-enter">
          {notifications.map((n, i) => (
            <div key={i} className="px-4 py-3 rounded-card tint-points border border-points/20 text-sm text-tx-2 mb-2">
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between pt-5 pb-5 stagger-enter">
        <div>
          <p className="text-xs text-tx-3">{formatTodayDate()}</p>
          <h1 className="text-[26px] font-bold text-tx mt-0.5">{getGreeting()}, Rohan</h1>
        </div>
        {rolling_avg_weight && (
          <button
            onClick={() => navigate('/trends')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card rounded-full press-scale"
          >
            <span className="text-sm font-num text-tx-2">{rolling_avg_weight} kg</span>
            <svg className={`w-3.5 h-3.5 text-tx-3 ${weightTrendDown ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Points ring hero card */}
      <div className="bg-card rounded-card p-5 mb-3 stagger-enter">
        <div className="flex flex-col items-center text-center">
          <PointsRing current={weekly_points} target={threshold} size={220} />

          {/* Percentage pill */}
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-num font-medium text-points tint-points">
              {pctWeek}% there
            </span>
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs tint-cal text-cal">
                <FlameIcon />
                {streak}-day streak
              </span>
            )}
          </div>

          {/* Week strip */}
          {byDay.length > 0 && (
            <div className="flex gap-3 mt-4">
              {byDay.map((day) => {
                const isToday = day.date === today;
                const completed = day.total >= dayThreshold;
                const isFuture = day.date > today;
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1">
                    {completed ? (
                      <div className="w-7 h-7 rounded-full bg-points flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isToday ? (
                      <div className="w-7 h-7 rounded-full border-2 border-points" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full border ${isFuture ? 'border-hair' : 'border-tx-3/30'}`} />
                    )}
                    <span className={`text-[10px] ${isToday ? 'text-points font-medium' : 'text-tx-3'}`}>
                      {['M','T','W','T','F','S','S'][new Date(day.date + 'T12:00:00Z').getUTCDay() === 0 ? 6 : new Date(day.date + 'T12:00:00Z').getUTCDay() - 1]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Today's fuel macro card */}
      <div className="bg-card rounded-card p-4 mb-3 stagger-enter">
        <h2 className="text-sm font-semibold text-tx mb-3">Today's fuel</h2>
        <div className="space-y-3">
          <MacroBar label="Calories" current={food_totals.calories} target={calTarget} token="cal" unit="kcal" />
          <MacroBar label="Protein" current={food_totals.protein_g} target={proTarget} token="protein" />
          <MacroBar label="Carbs" current={food_totals.carbs_g} target={carbTarget} token="carbs" />
          <MacroBar label="Fat" current={food_totals.fat_g} target={fatTarget} token="fat" />
          <MacroBar label="Fiber" current={food_totals.fiber_g} target={fiberTarget} token="fiber" direction="reach" />
          <MacroBar label="Sugar" current={food_totals.sugar_g} target={sugarLimit} token="sugar" direction="limit" />
        </div>
      </div>

      {/* Quick-log 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 stagger-enter">
        <Link to="/food" className="bg-card rounded-card p-3 flex flex-col items-center gap-2 press-scale">
          <div className="w-[34px] h-[34px] rounded-lg bg-cal flex items-center justify-center">
            <FoodIcon />
          </div>
          <span className="text-xs text-tx-2">Log food</span>
        </Link>
        <button onClick={() => setShowExercise(true)} className="bg-card rounded-card p-3 flex flex-col items-center gap-2 press-scale">
          <div className="w-[34px] h-[34px] rounded-lg bg-protein flex items-center justify-center">
            <ExerciseIcon />
          </div>
          <span className="text-xs text-tx-2">Log workout</span>
        </button>
        <button onClick={() => setShowSleep(true)} className="bg-card rounded-card p-3 flex flex-col items-center gap-2 press-scale">
          <div className="w-[34px] h-[34px] rounded-lg bg-fat flex items-center justify-center">
            <SleepIcon />
          </div>
          <span className="text-xs text-tx-2">Log sleep</span>
        </button>
        <button onClick={() => setShowWeight(true)} className="bg-card rounded-card p-3 flex flex-col items-center gap-2 press-scale">
          <div className="w-[34px] h-[34px] rounded-lg bg-carbs flex items-center justify-center">
            <ScaleIcon />
          </div>
          <span className="text-xs text-tx-2">Log weight</span>
        </button>
      </div>

      {/* Water card */}
      <div className="bg-card rounded-card p-4 mb-3 stagger-enter">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <WaterIcon />
            <span className="text-sm text-tx-2">Water</span>
          </div>
          <span className="text-sm font-num text-drinks">{filledSegments} of 8 glasses</span>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: 8 }, (_, i) => {
            const segNum = i + 1;
            const filled = segNum <= filledSegments;
            return (
              <button
                key={i}
                onClick={() => handleSegmentTap(segNum)}
                className={`h-10 rounded-lg transition-colors press-scale ${
                  filled
                    ? 'tint-drinks border border-drinks/30'
                    : 'border border-hair'
                }`}
                style={filled ? { background: 'color-mix(in oklab, var(--drinks) 25%, transparent)' } : undefined}
              />
            );
          })}
        </div>
        <p className="text-xs text-tx-3 text-center mt-2">Tap a glass to log a sip</p>
      </div>

      {/* Latest activity */}
      {latestActivity && (
        <Link
          to="/food"
          className="block bg-card rounded-card px-4 py-3 stagger-enter press-scale"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-tx-2 truncate">{latestActivity.reason}</p>
              <p className="text-xs text-points mt-0.5">+{latestActivity.points} pts</p>
            </div>
            <svg className="w-4 h-4 text-tx-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Settings link */}
      <div className="mt-4 stagger-enter">
        <Link to="/settings" className="flex items-center gap-2 text-xs text-tx-3 px-1">
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

function WaterIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ color: 'var(--drinks)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c4.418 0 8-3.582 8-8 0-4-3.5-8.5-8-13-4.5 4.5-8 9-8 13 0 4.418 3.582 8 8 8z" />
    </svg>
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
    <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
}

function ExerciseIcon() {
  return (
    <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m-15 0l3-3m-3 3l3 3m12-6l-3 3m3-3l-3-3" />
    </svg>
  );
}

function SleepIcon() {
  return (
    <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-8 text-center">
      <p className="text-sm text-tx-2">Couldn't load dashboard</p>
      <button onClick={onRetry} className="text-sm text-points">Try again</button>
    </div>
  );
}
