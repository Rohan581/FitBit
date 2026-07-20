import { useState, useEffect } from 'react';
import { api } from '../api';

function getPastDates(count = 14) {
  const dates = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.now() + 330 * 60000);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const istNow = new Date(Date.now() + 330 * 60000);
  const today = istNow.toISOString().split('T')[0];
  const istYesterday = new Date(istNow);
  istYesterday.setUTCDate(istYesterday.getUTCDate() - 1);
  const yesterday = istYesterday.toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDayHighlight(data) {
  if (!data || data.error) return null;
  const { food_logs, exercise_logs, sleep_log, points } = data;
  const total = points?.total || 0;
  if (total >= 80) return { emoji: '🔥', label: 'Great day' };
  if (exercise_logs?.length > 0) return { emoji: '💪', label: 'Active' };
  if (food_logs?.length >= 6) return { emoji: '🍽️', label: 'Well-fed' };
  if (sleep_log && sleep_log.hours >= 7) return { emoji: '😴', label: 'Well-rested' };
  if (total > 0) return { emoji: '✅', label: 'Logged' };
  return null;
}

function getDaySummary(data) {
  if (!data || data.error) return '';
  const parts = [];
  if (data.food_logs?.length) parts.push(`${data.food_logs.length} foods`);
  if (data.exercise_logs?.length) parts.push('exercised');
  if (data.sleep_log) parts.push(`${data.sleep_log.hours}h sleep`);
  if (data.waterLog?.glasses > 0) parts.push(`${data.waterLog.glasses} glasses`);
  return parts.join(' · ') || 'No entries';
}

export default function History() {
  const [days, setDays] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [dayData, setDayData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dates = getPastDates(14);
    setDays(dates);
    // Preload all day summaries for the card previews
    dates.forEach(date => {
      api.getHistoryDay(date).then(data => {
        setDayData(prev => ({ ...prev, [date]: data }));
      }).catch(() => {
        setDayData(prev => ({ ...prev, [date]: { error: true } }));
      });
    });
    setLoading(false);
  }, []);

  function toggleDay(date) {
    setExpanded(prev => prev === date ? null : date);
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 pb-4 tab-fade-enter">
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-bold text-tx">History</h1>
        <p className="text-xs text-tx-3 mt-0.5">Past 14 days</p>
      </div>

      <div className="space-y-2">
        {days.map((date, i) => {
          const dd = dayData[date];
          const pts = dd?.points?.total || 0;
          const highlight = getDayHighlight(dd);
          const summary = getDaySummary(dd);

          return (
            <div key={date} className="stagger-enter" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
              <button
                onClick={() => toggleDay(date)}
                className="w-full flex items-center gap-3 bg-card rounded-card px-4 py-3 press-scale"
              >
                {/* Points badge */}
                <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 tint-points">
                  <span className="text-lg font-num font-bold text-points leading-none">{pts}</span>
                  <span className="text-[8px] text-tx-3 uppercase tracking-wider">pts</span>
                </div>

                {/* Day info */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm text-tx">{formatDate(date)}</p>
                  <p className="text-xs text-tx-3 truncate">{summary}</p>
                </div>

                {/* Highlight emoji */}
                {highlight && (
                  <span className="text-lg flex-shrink-0" title={highlight.label}>{highlight.emoji}</span>
                )}

                <svg
                  className={`w-4 h-4 text-tx-3 flex-shrink-0 transition-transform duration-200 ${expanded === date ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === date && (
                <div className="mt-1 bg-card rounded-card px-4 py-3 tab-fade-enter">
                  <DayDetail data={dd} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayDetail({ data }) {
  if (!data) return <p className="text-xs text-tx-3">Loading...</p>;
  if (data.error) return <p className="text-xs text-tx-3">Couldn't load this day</p>;

  const { food_logs, exercise_logs, sleep_log, weight_log, waterLog, points } = data;
  const hasAnything = food_logs?.length > 0 || exercise_logs?.length > 0 || sleep_log || weight_log || (waterLog?.glasses > 0);

  if (!hasAnything) return <p className="text-xs text-tx-3">Nothing logged this day</p>;

  return (
    <div className="space-y-3">
      {food_logs?.length > 0 && (
        <div>
          <p className="text-[11px] text-tx-3 mb-1">Food</p>
          <div className="space-y-1">
            {food_logs.map((f, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-tx-2 truncate flex-1">{f.food_name}</span>
                <span className="text-xs font-num text-tx-3 ml-2">{Math.round(f.calories)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {exercise_logs?.length > 0 && (
        <div>
          <p className="text-[11px] text-tx-3 mb-1">Exercise</p>
          {exercise_logs.map((e, i) => (
            <p key={i} className="text-xs text-tx-2">{e.type} - {e.duration_min} min ({e.intensity})</p>
          ))}
        </div>
      )}

      {sleep_log && (
        <div>
          <p className="text-[11px] text-tx-3 mb-1">Sleep</p>
          <p className="text-xs text-tx-2"><span className="font-num">{sleep_log.hours}</span>h ({sleep_log.quality})</p>
        </div>
      )}

      {weight_log && (
        <div>
          <p className="text-[11px] text-tx-3 mb-1">Weight</p>
          <p className="text-xs font-num text-tx-2">{weight_log.weight_kg} kg</p>
        </div>
      )}

      {waterLog?.glasses > 0 && (
        <div>
          <p className="text-[11px] text-tx-3 mb-1">Water</p>
          <p className="text-xs text-tx-2"><span className="font-num">{waterLog.glasses}</span> glasses ({waterLog.glasses * 250} ml)</p>
        </div>
      )}

      {points?.breakdown?.length > 0 && (
        <div>
          <p className="text-[11px] text-tx-3 mb-1">Points earned</p>
          {points.breakdown.map((b, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-tx-2">{b.reason}</span>
              <span className="text-xs font-num text-points">+{b.points}</span>
            </div>
          ))}
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-hair">
            <span className="text-xs font-medium text-tx">Total</span>
            <span className="text-xs font-num font-medium text-points">{points.total} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}
