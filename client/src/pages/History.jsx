import { useState, useEffect } from 'react';
import { api } from '../api';

function getPastDates(count = 14) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function History() {
  const [days, setDays] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [dayData, setDayData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dates = getPastDates(14);
    setDays(dates);
    setLoading(false);
  }, []);

  async function toggleDay(date) {
    if (expanded === date) {
      setExpanded(null);
      return;
    }
    setExpanded(date);
    if (!dayData[date]) {
      try {
        const data = await api.getHistoryDay(date);
        setDayData(prev => ({ ...prev, [date]: data }));
      } catch (e) {
        setDayData(prev => ({ ...prev, [date]: { error: true } }));
      }
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-7 h-7 border-2 border-warm-200 border-t-accent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 pb-4 tab-fade-enter">
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-medium text-warm-800">History</h1>
        <p className="text-xs text-warm-400 mt-0.5">Past 14 days</p>
      </div>

      <div className="space-y-2">
        {days.map((date, i) => (
          <div key={date} className="stagger-enter" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
            <button
              onClick={() => toggleDay(date)}
              className="w-full flex items-center justify-between bg-warm-100 rounded-card px-4 py-3 press-scale"
            >
              <span className="text-sm text-warm-700">{formatDate(date)}</span>
              <svg
                className={`w-4 h-4 text-warm-400 transition-transform duration-200 ${expanded === date ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expanded === date && (
              <div className="mt-1 bg-warm-100 rounded-card px-4 py-3 tab-fade-enter">
                <DayDetail data={dayData[date]} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayDetail({ data }) {
  if (!data) return <p className="text-xs text-warm-400">Loading...</p>;
  if (data.error) return <p className="text-xs text-warm-400">Couldn't load this day</p>;

  const { food_logs, exercise_logs, sleep_log, weight_log, points } = data;
  const hasAnything = food_logs?.length > 0 || exercise_logs?.length > 0 || sleep_log || weight_log;

  if (!hasAnything) return <p className="text-xs text-warm-400">Nothing logged this day</p>;

  return (
    <div className="space-y-3">
      {/* Food */}
      {food_logs?.length > 0 && (
        <div>
          <p className="text-[11px] text-warm-400 mb-1">Food</p>
          <div className="space-y-1">
            {food_logs.map((f, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-warm-600 truncate flex-1">{f.food_name}</span>
                <span className="text-xs text-warm-400 ml-2">{Math.round(f.calories)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise */}
      {exercise_logs?.length > 0 && (
        <div>
          <p className="text-[11px] text-warm-400 mb-1">Exercise</p>
          {exercise_logs.map((e, i) => (
            <p key={i} className="text-xs text-warm-600">{e.type} - {e.duration_min} min ({e.intensity})</p>
          ))}
        </div>
      )}

      {/* Sleep */}
      {sleep_log && (
        <div>
          <p className="text-[11px] text-warm-400 mb-1">Sleep</p>
          <p className="text-xs text-warm-600">{sleep_log.hours}h ({sleep_log.quality})</p>
        </div>
      )}

      {/* Weight */}
      {weight_log && (
        <div>
          <p className="text-[11px] text-warm-400 mb-1">Weight</p>
          <p className="text-xs text-warm-600">{weight_log.weight_kg} kg</p>
        </div>
      )}

      {/* Points */}
      {points?.breakdown?.length > 0 && (
        <div>
          <p className="text-[11px] text-warm-400 mb-1">Points earned</p>
          {points.breakdown.map((b, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-warm-600">{b.reason}</span>
              <span className="text-xs text-accent">+{b.points}</span>
            </div>
          ))}
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-warm-200">
            <span className="text-xs font-medium text-warm-700">Total</span>
            <span className="text-xs font-medium text-accent">{points.total} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}
