import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { PointsRing } from '../components/MacroBar';

const TREAT_SUGGESTIONS = {
  sweet: [
    { name: 'Gulab jamun (1-2 pieces)', cal: 150 },
    { name: 'A scoop of ice cream', cal: 200 },
    { name: 'A small piece of chocolate cake', cal: 250 },
    { name: 'Dark chocolate bar', cal: 220 },
  ],
  'fried-savory': [
    { name: 'Plate of pani puri', cal: 200 },
    { name: 'Vada pav', cal: 290 },
    { name: '4-5 chicken nuggets', cal: 200 },
    { name: 'Plate of momos (chicken/veg)', cal: 380 },
    { name: 'Samosas (2 pieces)', cal: 520 },
  ],
  'fast-food': [
    { name: 'A chicken burger', cal: 450 },
    { name: 'A slice or two of pizza', cal: 400 },
    { name: 'A masala dosa with chutney', cal: 280 },
    { name: 'Chicken biryani plate', cal: 550 },
    { name: 'Butter chicken + naan', cal: 700 },
    { name: 'Full burger + fries', cal: 700 },
  ],
};

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
      <div className="w-7 h-7 border-2 border-warm-200 border-t-accent rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;

  const { total_points, threshold, treat_earned, treat_redeemed, by_day, weekly_cal_budget } = data;
  const remaining = Math.max(0, threshold - total_points);

  const suggestions = cravingCategory
    ? TREAT_SUGGESTIONS[cravingCategory].filter(s => s.cal <= (weekly_cal_budget || 800))
    : [];

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="px-4 pb-4 tab-fade-enter">
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-medium text-warm-800">Rewards</h1>
        <p className="text-xs text-warm-400 mt-0.5">This week's progress</p>
      </div>

      {/* Weekly progress hero */}
      <div className="bg-warm-100 rounded-card p-5 mb-3 stagger-enter">
        <div className="flex flex-col items-center text-center">
          <PointsRing current={total_points} target={threshold} size={110} />
          <div className="mt-3">
            {treat_earned && !treat_redeemed && (
              <p className="text-sm text-accent font-medium">You've earned a flex meal!</p>
            )}
            {treat_redeemed && (
              <p className="text-sm text-warm-400">Treat redeemed this week</p>
            )}
            {!treat_earned && (
              <p className="text-sm text-warm-500">{remaining} pts to go</p>
            )}
          </div>
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="bg-warm-100 rounded-card p-4 mb-3 stagger-enter">
        <p className="text-xs text-warm-500 mb-3">This week by day</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {(by_day || []).map((day, i) => {
            const dayPct = Math.min((day.total / (threshold / 7)) * 100, 100);
            const isToday = day.date === new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-warm-400">{weekdays[i]}</div>
                <div className="h-14 w-full bg-warm-200 rounded-lg relative overflow-hidden">
                  <div
                    className={`absolute bottom-0 w-full rounded-lg transition-all duration-500 ${
                      day.total > 0 ? 'bg-accent' : 'bg-warm-200'
                    } ${isToday ? 'ring-1 ring-accent/50' : ''}`}
                    style={{ height: `${dayPct}%` }}
                  />
                </div>
                <div className="text-[10px] text-warm-600">{day.total > 0 ? day.total : '-'}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Treat section - earned but not redeemed */}
      {treat_earned && !treat_redeemed && (
        <div className="bg-accent-tint border border-accent/20 rounded-card p-4 mb-3 stagger-enter">
          <h2 className="text-base font-medium text-warm-800 mb-1">Pick your flex meal</h2>
          <p className="text-sm text-warm-500 mb-4">
            You have ~{weekly_cal_budget > 0 ? weekly_cal_budget : 'some'} kcal remaining in your weekly budget.
          </p>

          <p className="text-xs text-warm-500 mb-2">What are you in the mood for?</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { id: 'sweet', label: 'Sweet' },
              { id: 'fried-savory', label: 'Fried' },
              { id: 'fast-food', label: 'Fast food' },
            ].map(c => (
              <button
                key={c.id}
                onClick={() => setCravingCategory(cat => cat === c.id ? null : c.id)}
                className={`py-2 rounded-card text-sm border transition-colors press-scale ${
                  cravingCategory === c.id
                    ? 'border-accent bg-accent-tint text-accent'
                    : 'border-warm-200 bg-surface text-warm-600'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-2 mb-4">
              {suggestions.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-surface rounded-card px-3 py-2.5 border border-warm-200">
                  <span className="text-sm text-warm-700">{s.name}</span>
                  <span className="text-xs text-warm-400">~{s.cal} kcal</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleRedeem}
            disabled={redeeming}
            className="w-full py-3 bg-accent text-white rounded-card text-sm disabled:opacity-40 press-scale"
          >
            {redeeming ? 'Redeeming...' : 'Mark treat as redeemed'}
          </button>
        </div>
      )}

      {/* How points work - shown when not earned */}
      {!treat_earned && (
        <div className="bg-warm-100 rounded-card p-4 stagger-enter">
          <h2 className="text-sm font-medium text-warm-700 mb-2">How points work</h2>
          <div className="space-y-1.5 text-xs text-warm-500">
            <p><span className="text-accent">Calories</span> within target: 20 pts</p>
            <p><span className="text-success">Protein</span> target hit: 25 pts</p>
            <p><span className="text-warm-700">Exercise</span> (gym 60+ min): 30 pts</p>
            <p><span className="text-warm-700">Sleep</span> 7-8.5 hours: 15 pts</p>
            <p><span className="text-warm-700">All 4 logged</span> in a day: 10 pts bonus</p>
          </div>
        </div>
      )}
    </div>
  );
}
