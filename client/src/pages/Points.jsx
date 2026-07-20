import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { PointsRing } from '../components/MacroBar';

const TREAT_SUGGESTIONS = {
  sweet: [
    { name: 'Gulab jamun (1-2 pieces)', cal: 150, emoji: '🍮' },
    { name: 'A scoop of ice cream', cal: 200, emoji: '🍦' },
    { name: 'A small piece of chocolate cake', cal: 250, emoji: '🍰' },
    { name: 'Dark chocolate bar', cal: 220, emoji: '🍫' },
  ],
  'fried-savory': [
    { name: 'Plate of pani puri', cal: 200, emoji: '🥟' },
    { name: 'Vada pav', cal: 290, emoji: '🍔' },
    { name: '4-5 chicken nuggets', cal: 200, emoji: '🍗' },
    { name: 'Plate of momos (chicken/veg)', cal: 380, emoji: '🥟' },
    { name: 'Samosas (2 pieces)', cal: 520, emoji: '🥘' },
  ],
  'fast-food': [
    { name: 'A chicken burger', cal: 450, emoji: '🍔' },
    { name: 'A slice or two of pizza', cal: 400, emoji: '🍕' },
    { name: 'A masala dosa with chutney', cal: 280, emoji: '🫓' },
    { name: 'Chicken biryani plate', cal: 550, emoji: '🍛' },
    { name: 'Butter chicken + naan', cal: 700, emoji: '🍛' },
    { name: 'Full burger + fries', cal: 700, emoji: '🍟' },
  ],
};

const CATEGORIES = [
  { id: 'sweet', label: 'Sweet', token: 'sweet' },
  { id: 'fried-savory', label: 'Fried & savory', token: 'fried' },
  { id: 'fast-food', label: 'Fast food', token: 'fast' },
];

function getWeekDates() {
  const ist = new Date(Date.now() + 330 * 60000);
  const day = ist.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  ist.setUTCDate(ist.getUTCDate() + diff);
  return ist.toISOString().split('T')[0];
}

export default function Points() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cravingCategory, setCravingCategory] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  const weekStart = getWeekDates();

  const load = useCallback(async () => {
    try {
      const d = await api.getWeeklySummary(weekStart);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  async function handleRedeem() {
    setRedeeming(true);
    try {
      await api.redeemTreat(weekStart);
      load();
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;

  const { total_points, threshold, treat_earned, treat_redeemed, by_day, weekly_cal_budget } = data;
  const remaining = Math.max(0, threshold - total_points);

  const suggestions = cravingCategory
    ? TREAT_SUGGESTIONS[cravingCategory].filter(s => s.cal <= (weekly_cal_budget || 800))
    : [];

  const activeCat = CATEGORIES.find(c => c.id === cravingCategory);

  return (
    <div className="px-4 pb-4 tab-fade-enter">
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-bold text-tx">Rewards</h1>
        <p className="text-xs text-tx-3 mt-0.5">This week's progress</p>
      </div>

      {/* Threshold progress card */}
      <div className="bg-card rounded-card p-5 mb-3 stagger-enter">
        <p className="text-xs text-tx-3 mb-2">Next treat unlock</p>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-num font-bold text-points">{Math.round(total_points)}</span>
          <span className="text-sm font-num text-tx-3">/ {threshold}</span>
        </div>
        <div className="h-3.5 bg-card-2 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full progress-fill bg-points"
            style={{ width: `${Math.min((total_points / threshold) * 100, 100)}%` }}
          />
        </div>
        {treat_earned && !treat_redeemed ? (
          <p className="text-sm text-points font-medium">You've earned a flex meal!</p>
        ) : treat_redeemed ? (
          <p className="text-sm text-tx-3">Treat redeemed this week</p>
        ) : (
          <p className="text-sm text-tx-3">
            <span className="font-num font-semibold text-tx">{remaining}</span> pts to your flex meal
          </p>
        )}
      </div>

      {/* Treat section */}
      {treat_earned && !treat_redeemed && (
        <div className="mb-3 stagger-enter space-y-3">
          {/* Category picker */}
          <div className="flex gap-2">
            {CATEGORIES.map(c => {
              const active = cravingCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCravingCategory(cat => cat === c.id ? null : c.id)}
                  className={`flex-1 py-2.5 rounded-full text-sm border transition-colors press-scale ${
                    active ? 'font-medium' : 'border-hair bg-card text-tx-3'
                  }`}
                  style={active ? {
                    background: `color-mix(in oklab, var(--${c.token}) 16%, transparent)`,
                    borderColor: `var(--${c.token})`,
                    color: `var(--${c.token})`,
                  } : undefined}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Treat cards */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.slice(0, 4).map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-card rounded-card px-3 py-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `color-mix(in oklab, var(--${activeCat?.token || 'sweet'}) 16%, transparent)` }}
                  >
                    {s.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-tx">{s.name}</p>
                    <p className="text-xs text-tx-3">~{s.cal} kcal</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-card-2 text-tx-3 flex-shrink-0">Curated</span>
                </div>
              ))}
            </div>
          )}

          {/* Add your own treat */}
          <button className="w-full py-3 border border-dashed border-hair rounded-card text-sm text-tx-3 press-scale">
            + Add your own treat
          </button>

          <button
            onClick={handleRedeem}
            disabled={redeeming}
            className="w-full py-3 bg-points text-white rounded-card text-sm disabled:opacity-40 press-scale"
          >
            {redeeming ? 'Redeeming...' : 'Mark treat as redeemed'}
          </button>
        </div>
      )}

      {/* Daily breakdown */}
      <div className="bg-card rounded-card p-4 mb-3 stagger-enter">
        <p className="text-xs text-tx-3 mb-3">This week by day</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {(by_day || []).map((day, i) => {
            const dayPct = Math.min((day.total / (threshold / 7)) * 100, 100);
            const isToday = day.date === new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-tx-3">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div>
                <div className="h-14 w-full bg-card-2 rounded-lg relative overflow-hidden">
                  <div
                    className={`absolute bottom-0 w-full rounded-lg transition-all duration-500 bg-points ${isToday ? 'ring-1 ring-points/40' : ''}`}
                    style={{ height: `${dayPct}%` }}
                  />
                </div>
                <div className="text-[10px] font-num text-tx-2">{day.total > 0 ? day.total : '-'}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How points work */}
      {!treat_earned && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <h2 className="text-sm font-semibold text-tx mb-2">How points work</h2>
          <div className="space-y-1.5 text-xs text-tx-3">
            <p><span className="text-cal">Calories</span> within target: 20 pts</p>
            <p><span className="text-protein">Protein</span> target hit: 25 pts</p>
            <p><span className="text-tx">Exercise</span> (gym 60+ min): 30 pts</p>
            <p><span className="text-tx">Sleep</span> 7-8.5 hours: 15 pts</p>
            <p><span className="text-tx">All 4 logged</span> in a day: 10 pts bonus</p>
          </div>
        </div>
      )}
    </div>
  );
}
