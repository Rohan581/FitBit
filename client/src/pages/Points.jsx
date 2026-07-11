import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const TREAT_SUGGESTIONS = {
  sweet: [
    { name: 'Gulab jamun (1–2 pieces)', cal: 150 },
    { name: 'A scoop of ice cream', cal: 200 },
    { name: 'A small piece of chocolate cake', cal: 250 },
    { name: 'Dark chocolate bar', cal: 220 },
  ],
  'fried-savory': [
    { name: 'Plate of pani puri', cal: 200 },
    { name: 'Vada pav', cal: 290 },
    { name: '4–5 chicken nuggets', cal: 200 },
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
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().split('T')[0];
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
      <div className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;

  const { total_points, threshold, treat_earned, treat_redeemed, by_day, weekly_cal_budget } = data;
  const pct = Math.min((total_points / threshold) * 100, 100);
  const remaining = Math.max(0, threshold - total_points);

  const suggestions = cravingCategory
    ? TREAT_SUGGESTIONS[cravingCategory].filter(s => s.cal <= (weekly_cal_budget || 800))
    : [];

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="pb-4">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-warm-800">Points</h1>
        <p className="text-sm text-warm-400 mt-0.5">This week</p>
      </div>

      {/* Weekly progress */}
      <div className="mx-4 bg-white rounded-2xl shadow-card p-5 mb-4">
        <div className="text-center mb-4">
          <div className={`text-5xl font-bold mb-1 ${treat_earned ? 'text-amber-500' : 'text-warm-800'}`}>
            {Math.round(total_points)}
          </div>
          <div className="text-sm text-warm-400">of {threshold} points</div>
          {treat_earned && !treat_redeemed && (
            <div className="mt-2 text-sm font-semibold text-amber-600">You've earned a flex meal! 🎉</div>
          )}
          {treat_redeemed && (
            <div className="mt-2 text-sm text-warm-400">Treat redeemed this week ✓</div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-warm-100 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${treat_earned ? 'bg-amber-400' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-warm-400">
          <span>0</span>
          {!treat_earned && <span>{remaining} pts to go</span>}
          <span>{threshold}</span>
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="mx-4 bg-white rounded-2xl shadow-card p-4 mb-4">
        <p className="text-xs font-medium text-warm-500 mb-3">This week by day</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {(by_day || []).map((day, i) => {
            const dayPct = Math.min((day.total / (threshold / 7)) * 100, 100);
            const isToday = day.date === new Date().toISOString().split('T')[0];
            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-warm-400">{weekdays[i]}</div>
                <div className="h-16 w-full bg-warm-100 rounded-lg relative overflow-hidden">
                  <div
                    className={`absolute bottom-0 w-full rounded-lg transition-all ${
                      day.total > 0 ? 'bg-amber-400' : 'bg-warm-100'
                    } ${isToday ? 'ring-1 ring-amber-500' : ''}`}
                    style={{ height: `${dayPct}%` }}
                  />
                </div>
                <div className="text-[10px] font-semibold text-warm-600">{day.total > 0 ? day.total : '—'}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Treat section */}
      {treat_earned && !treat_redeemed && (
        <div className="mx-4 mb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h2 className="text-base font-bold text-amber-800 mb-1">You earned a flex meal 🎉</h2>
            <p className="text-sm text-amber-700 mb-4">
              You have ~{weekly_cal_budget > 0 ? weekly_cal_budget : 'some'} kcal remaining in your weekly budget. Pick something you're craving.
            </p>

            <p className="text-xs font-medium text-amber-700 mb-2">What are you in the mood for?</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { id: 'sweet', label: '🍮 Sweet' },
                { id: 'fried-savory', label: '🍟 Fried' },
                { id: 'fast-food', label: '🍔 Fast food' },
              ].map(c => (
                <button
                  key={c.id}
                  onClick={() => setCravingCategory(cat => cat === c.id ? null : c.id)}
                  className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                    cravingCategory === c.id
                      ? 'border-amber-400 bg-amber-100 text-amber-800'
                      : 'border-amber-200 bg-white text-amber-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2 mb-4">
                {suggestions.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                    <span className="text-sm text-warm-700">{s.name}</span>
                    <span className="text-xs text-warm-400">~{s.cal} kcal</span>
                  </div>
                ))}
                {suggestions.length === 0 && cravingCategory && (
                  <p className="text-xs text-amber-600 text-center py-2">No suggestions fit your remaining calorie budget this week — consider saving the treat for another day!</p>
                )}
              </div>
            )}

            <button
              onClick={handleRedeem}
              disabled={redeeming}
              className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold text-sm disabled:opacity-40 active:bg-amber-600 transition-colors"
            >
              {redeeming ? 'Redeeming...' : 'Mark Treat as Redeemed'}
            </button>
          </div>
        </div>
      )}

      {!treat_earned && (
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-card p-4">
          <h2 className="text-sm font-semibold text-warm-700 mb-1">How points work</h2>
          <div className="space-y-1.5 text-xs text-warm-500">
            <p>🔥 <strong>Calories</strong> within ±100 kcal of target: 20 pts</p>
            <p>💪 <strong>Protein</strong> target hit: 25 pts</p>
            <p>🏋️ <strong>Exercise</strong> (gym 60+ min): 30 pts</p>
            <p>😴 <strong>Sleep</strong> 7–8.5 hours: 15 pts</p>
            <p>⭐ <strong>All 4 logged</strong> in a day: 10 pts bonus</p>
          </div>
        </div>
      )}
    </div>
  );
}
