import { useState, useEffect } from 'react';
import { api } from '../api';
import { MEAL_TYPES, MEAL_LABELS, MEAL_COLORS, MealSection, FoodSearchSheet, EditEntrySheet } from './FoodLog';

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
  const { foodLogs, exerciseLogs, sleepLog, points } = data;
  const total = points?.total || 0;
  if (total >= 80) return { emoji: '🔥', label: 'Great day' };
  if (exerciseLogs?.length > 0) return { emoji: '💪', label: 'Active' };
  if (foodLogs?.length >= 6) return { emoji: '🍽️', label: 'Well-fed' };
  if (sleepLog && sleepLog.hours >= 7) return { emoji: '😴', label: 'Well-rested' };
  if (total > 0) return { emoji: '✅', label: 'Logged' };
  return null;
}

function getDaySummary(data) {
  if (!data || data.error) return '';
  const parts = [];
  if (data.foodLogs?.length) parts.push(`${data.foodLogs.length} foods`);
  if (data.exerciseLogs?.length) parts.push('exercised');
  if (data.sleepLog) parts.push(`${data.sleepLog.hours}h sleep`);
  if (data.steps) parts.push(`${Number(data.steps).toLocaleString()} steps`);
  return parts.join(' · ') || 'No entries';
}

function getGaps(data) {
  if (!data || data.error) return [];
  const gaps = [];
  if (!data.foodLogs?.length) gaps.push('food');
  if (!data.weightLog) gaps.push('weight');
  if (!data.sleepLog) gaps.push('sleep');
  return gaps;
}

export default function History() {
  const [days, setDays] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [dayData, setDayData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dates = getPastDates(14);
    setDays(dates);
    dates.forEach(date => {
      api.getHistoryDay(date).then(data => {
        setDayData(prev => ({ ...prev, [date]: data }));
      }).catch(() => {
        setDayData(prev => ({ ...prev, [date]: { error: true } }));
      });
    });
    setLoading(false);
  }, []);

  function reloadDay(date) {
    api.getHistoryDay(date).then(data => {
      setDayData(prev => ({ ...prev, [date]: data }));
    });
  }

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
          const gaps = getGaps(dd);

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
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-tx">{formatDate(date)}</p>
                    {gaps.length > 0 && (
                      <span className="text-[9px] text-amber-500/70" title={`Missing: ${gaps.join(', ')}`}>
                        {gaps.map(g => g === 'food' ? 'F' : g === 'weight' ? 'W' : 'S').join('')}
                      </span>
                    )}
                  </div>
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
                <div className="mt-1 tab-fade-enter">
                  <DayDetail data={dd} date={date} onDataChanged={() => reloadDay(date)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayDetail({ data, date, onDataChanged }) {
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [editEntry, setEditEntry] = useState(null);
  const [addingWeight, setAddingWeight] = useState(false);
  const [addingSleep, setAddingSleep] = useState(false);
  const [addingSteps, setAddingSteps] = useState(false);
  const [addingWaist, setAddingWaist] = useState(false);
  const [weightVal, setWeightVal] = useState('');
  const [sleepVal, setSleepVal] = useState('');
  const [stepsVal, setStepsVal] = useState('');
  const [waistVal, setWaistVal] = useState('');

  if (!data) return <p className="bg-card rounded-card px-4 py-3 text-xs text-tx-3">Loading...</p>;
  if (data.error) return <p className="bg-card rounded-card px-4 py-3 text-xs text-tx-3">Couldn't load this day</p>;

  const { foodLogs, exerciseLogs, sleepLog, weightLog, points, foodTotals, is_rest_day, steps, measurement } = data;

  // Group food logs by meal type
  const grouped = { breakfast: [], lunch: [], snack: [], dinner: [], drinks: [] };
  for (const log of (foodLogs || [])) {
    const key = grouped[log.meal_type] ? log.meal_type : 'snack';
    grouped[key].push(log);
  }

  function openAddFood(mealType) {
    setSelectedMealType(mealType);
    setShowFoodSearch(true);
  }

  async function handleDeleteEntry(id) {
    await api.deleteFoodLog(id);
    onDataChanged?.();
  }

  async function handleCopyPreviousDay(mealType) {
    try {
      await api.copyYesterday(mealType, date);
      onDataChanged?.();
    } catch (e) { /* no entries */ }
  }

  const hasFoodLogs = foodLogs?.length > 0;

  async function handleToggleRestDay() {
    await api.toggleRestDay(date);
    onDataChanged?.();
  }

  return (
    <div className="space-y-2">
      {/* Rest day toggle */}
      <div className="bg-card rounded-card px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs text-tx-3">Rest day</span>
        <button
          onClick={handleToggleRestDay}
          className="text-[11px] font-bold px-2.5 py-1 rounded-full press-scale"
          style={{
            background: is_rest_day ? 'var(--accent-surface)' : 'transparent',
            border: is_rest_day ? '1px solid var(--points)' : '1px solid var(--hair)',
            color: is_rest_day ? 'var(--points)' : 'var(--text-3)',
          }}
        >
          {is_rest_day ? 'On ✓' : 'Off'}
        </button>
      </div>

      {/* Macro totals summary */}
      {hasFoodLogs && foodTotals && (
        <div className="bg-card rounded-card px-4 py-3">
          <div className="flex gap-3 text-xs">
            <span className="text-tx-2"><span className="font-num font-medium">{Math.round(foodTotals.calories)}</span> <span className="text-tx-3">kcal</span></span>
            <span className="text-tx-2"><span className="font-num font-medium">{Math.round(foodTotals.protein_g)}</span><span className="text-tx-3">g pro</span></span>
            <span className="text-tx-2"><span className="font-num font-medium">{Math.round(foodTotals.carbs_g)}</span><span className="text-tx-3">g carbs</span></span>
            <span className="text-tx-2"><span className="font-num font-medium">{Math.round(foodTotals.fat_g)}</span><span className="text-tx-3">g fat</span></span>
          </div>
        </div>
      )}

      {/* Meal sections — full add/edit/delete UI */}
      {MEAL_TYPES.map(mealType => (
        <MealSection
          key={mealType}
          type={mealType}
          label={MEAL_LABELS[mealType]}
          color={MEAL_COLORS[mealType]}
          entries={grouped[mealType] || []}
          onAdd={() => openAddFood(mealType)}
          onDelete={handleDeleteEntry}
          onEdit={setEditEntry}
          onCopyYesterday={() => handleCopyPreviousDay(mealType)}
        />
      ))}

      {/* Exercise */}
      {exerciseLogs?.length > 0 && (
        <div className="bg-card rounded-card px-4 py-3">
          <p className="text-[11px] text-tx-3 mb-1">Exercise</p>
          {exerciseLogs.map((e, i) => (
            <p key={i} className="text-xs text-tx-2">{e.type} - {e.duration_min} min ({e.intensity})</p>
          ))}
        </div>
      )}

      {/* Sleep */}
      <div className="bg-card rounded-card px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-tx-3">Sleep</p>
          {!sleepLog && !addingSleep && (
            <button onClick={() => setAddingSleep(true)} className="text-[11px] text-points font-semibold press-scale">+ Add</button>
          )}
        </div>
        {sleepLog ? (
          <p className="text-xs text-tx-2 mt-0.5"><span className="font-num">{sleepLog.hours}</span>h ({sleepLog.quality})</p>
        ) : addingSleep ? (
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" step="0.5" min="0" max="14" placeholder="hours" value={sleepVal} onChange={e => setSleepVal(e.target.value)}
              className="w-20 px-2 py-1.5 rounded-lg border border-hair text-sm font-num text-tx bg-card-2" autoFocus />
            <button onClick={async () => {
              if (!sleepVal) return;
              await api.logSleep({ date, hours: parseFloat(sleepVal) });
              setAddingSleep(false); setSleepVal(''); onDataChanged?.();
            }} className="text-xs text-points font-semibold press-scale">Save</button>
            <button onClick={() => { setAddingSleep(false); setSleepVal(''); }} className="text-xs text-tx-3 press-scale">Cancel</button>
          </div>
        ) : (
          <p className="text-[10px] text-tx-3/50 mt-0.5">Not logged</p>
        )}
      </div>

      {/* Weight */}
      <div className="bg-card rounded-card px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-tx-3">Weight</p>
          {!weightLog && !addingWeight && (
            <button onClick={() => setAddingWeight(true)} className="text-[11px] text-points font-semibold press-scale">+ Add</button>
          )}
        </div>
        {weightLog ? (
          <p className="text-xs font-num text-tx-2 mt-0.5">{weightLog.weight_kg} kg</p>
        ) : addingWeight ? (
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" step="0.1" min="30" max="200" placeholder="kg" value={weightVal} onChange={e => setWeightVal(e.target.value)}
              className="w-20 px-2 py-1.5 rounded-lg border border-hair text-sm font-num text-tx bg-card-2" autoFocus />
            <button onClick={async () => {
              if (!weightVal) return;
              await api.logWeight({ date, weight_kg: parseFloat(weightVal) });
              setAddingWeight(false); setWeightVal(''); onDataChanged?.();
            }} className="text-xs text-points font-semibold press-scale">Save</button>
            <button onClick={() => { setAddingWeight(false); setWeightVal(''); }} className="text-xs text-tx-3 press-scale">Cancel</button>
          </div>
        ) : (
          <p className="text-[10px] text-tx-3/50 mt-0.5">Not logged</p>
        )}
      </div>

      {/* Waist measurement */}
      <div className="bg-card rounded-card px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-tx-3">Waist</p>
          {!measurement && !addingWaist && (
            <button onClick={() => setAddingWaist(true)} className="text-[11px] text-points font-semibold press-scale">+ Add</button>
          )}
        </div>
        {measurement ? (
          <p className="text-xs font-num text-tx-2 mt-0.5">{measurement.waist_cm} cm</p>
        ) : addingWaist ? (
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" step="0.5" min="50" max="150" placeholder="cm" value={waistVal} onChange={e => setWaistVal(e.target.value)}
              className="w-20 px-2 py-1.5 rounded-lg border border-hair text-sm font-num text-tx bg-card-2" autoFocus />
            <button onClick={async () => {
              if (!waistVal) return;
              await api.logMeasurement({ date, waist_cm: parseFloat(waistVal) });
              setAddingWaist(false); setWaistVal(''); onDataChanged?.();
            }} className="text-xs text-points font-semibold press-scale">Save</button>
            <button onClick={() => { setAddingWaist(false); setWaistVal(''); }} className="text-xs text-tx-3 press-scale">Cancel</button>
          </div>
        ) : (
          <p className="text-[10px] text-tx-3/50 mt-0.5">Not logged</p>
        )}
      </div>

      {/* Steps */}
      <div className="bg-card rounded-card px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-tx-3">Steps</p>
          {!steps && !addingSteps && (
            <button onClick={() => setAddingSteps(true)} className="text-[11px] text-points font-semibold press-scale">+ Add</button>
          )}
        </div>
        {steps ? (
          <p className="text-xs font-num text-tx-2 mt-0.5">{Number(steps).toLocaleString()}</p>
        ) : addingSteps ? (
          <div className="flex items-center gap-2 mt-1.5">
            <input type="number" step="100" min="0" max="99999" placeholder="steps" value={stepsVal} onChange={e => setStepsVal(e.target.value)}
              className="w-24 px-2 py-1.5 rounded-lg border border-hair text-sm font-num text-tx bg-card-2" autoFocus />
            <button onClick={async () => {
              if (!stepsVal) return;
              await api.logSteps({ date, steps: parseInt(stepsVal) });
              setAddingSteps(false); setStepsVal(''); onDataChanged?.();
            }} className="text-xs text-points font-semibold press-scale">Save</button>
            <button onClick={() => { setAddingSteps(false); setStepsVal(''); }} className="text-xs text-tx-3 press-scale">Cancel</button>
          </div>
        ) : (
          <p className="text-[10px] text-tx-3/50 mt-0.5">Not logged</p>
        )}
      </div>

      {/* Points breakdown */}
      {points?.breakdown?.length > 0 && (
        <div className="bg-card rounded-card px-4 py-3">
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

      {/* Food search sheet for this date */}
      <FoodSearchSheet
        open={showFoodSearch}
        onClose={() => setShowFoodSearch(false)}
        mealType={selectedMealType}
        targetDate={date}
        onLogged={() => { setShowFoodSearch(false); onDataChanged?.(); }}
      />

      {/* Edit entry sheet */}
      <EditEntrySheet
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        entry={editEntry}
        mealColor={editEntry ? MEAL_COLORS[editEntry.meal_type] || 'var(--cal)' : 'var(--cal)'}
        onSaved={() => { setEditEntry(null); onDataChanged?.(); }}
        onDeleted={() => { setEditEntry(null); onDataChanged?.(); }}
      />
    </div>
  );
}
