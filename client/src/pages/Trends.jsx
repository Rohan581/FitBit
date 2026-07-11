import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Legend
} from 'recharts';

export default function Trends() {
  const [tab, setTab] = useState('weight');
  const [weightData, setWeightData] = useState(null);
  const [macroData, setMacroData] = useState(null);
  const [pointsData, setPointsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weightRange, setWeightRange] = useState(60);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (tab === 'weight') {
          const d = await api.getWeightTrend(weightRange);
          setWeightData(d);
        } else if (tab === 'macros') {
          const d = await api.getMacroTrend(60);
          setMacroData(d);
        } else if (tab === 'points') {
          const d = await api.getPointsTrend(12);
          setPointsData(d);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab, weightRange]);

  return (
    <div className="pb-4">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-warm-800">Trends</h1>
      </div>

      {/* Tab bar */}
      <div className="px-4 mb-4">
        <div className="flex bg-warm-100 rounded-xl p-1 gap-1">
          {[
            { id: 'weight', label: 'Weight' },
            { id: 'macros', label: 'Macros' },
            { id: 'points', label: 'Points' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white text-warm-800 shadow-sm' : 'text-warm-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4">
          {tab === 'weight' && weightData && <WeightChart data={weightData} range={weightRange} onRangeChange={setWeightRange} />}
          {tab === 'macros' && macroData && <MacrosChart data={macroData} />}
          {tab === 'points' && pointsData && <PointsChart data={pointsData} />}
          {!loading && ((tab === 'weight' && !weightData?.weights?.length) ||
            (tab === 'macros' && !macroData?.length) ||
            (tab === 'points' && !pointsData?.length)) && (
            <div className="text-center py-12 text-warm-400">
              <p className="text-base">No data yet</p>
              <p className="text-sm mt-1">Start logging to see trends here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WeightChart({ data, range, onRangeChange }) {
  const { weights, trajectory, milestones, goal } = data;

  const chartData = weights.map(w => ({
    date: w.date,
    label: formatDate(w.date),
    actual: w.weight_kg,
    avg: w.rolling_avg,
  }));

  // Add trajectory points
  const allDates = [...new Set([
    ...chartData.map(d => d.date),
    ...(trajectory || []).map(t => t.date),
  ])].sort();

  const yMin = weights.length > 0
    ? Math.min(...weights.map(w => w.weight_kg)) - 1
    : 75;
  const yMax = weights.length > 0
    ? Math.max(...weights.map(w => w.weight_kg)) + 1
    : 95;

  const latestAvg = weights.length > 0 ? weights[weights.length - 1].rolling_avg : null;
  const goalWeight = goal?.goal_weight_kg;
  const startWeight = goal?.start_weight_kg;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {latestAvg && (
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-warm-800">{latestAvg}kg</div>
              <div className="text-xs text-warm-400">7-day avg</div>
            </div>
            {startWeight && (
              <div>
                <div className="text-xl font-bold text-amber-600">
                  {latestAvg < startWeight ? '-' : '+'}{Math.abs(Math.round((latestAvg - startWeight) * 10) / 10)}kg
                </div>
                <div className="text-xs text-warm-400">from start</div>
              </div>
            )}
            {goalWeight && (
              <div>
                <div className="text-xl font-bold text-warm-800">
                  {Math.round((latestAvg - goalWeight) * 10) / 10}kg
                </div>
                <div className="text-xs text-warm-400">to goal</div>
              </div>
            )}
          </div>

          {/* Goal info */}
          {goal?.target_date && (
            <div className="mt-3 pt-3 border-t border-warm-100 text-xs text-warm-500 text-center">
              Goal: {goalWeight}kg by {new Date(goal.target_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {/* Milestones */}
      {milestones?.some(m => m.achieved_date) && (
        <div className="bg-white rounded-2xl shadow-card p-4">
          <p className="text-xs font-medium text-warm-500 mb-2">Milestones</p>
          <div className="space-y-1.5">
            {milestones.map(m => (
              <div key={m.id} className={`flex items-center justify-between text-sm ${m.achieved_date ? 'text-warm-700' : 'text-warm-300'}`}>
                <span>{m.achieved_date ? '✓' : '○'} {m.weight_kg_threshold}kg</span>
                {m.achieved_date && <span className="text-xs text-warm-400">{formatDate(m.achieved_date)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Range selector */}
      <div className="flex gap-2">
        {[30, 60, 90].map(d => (
          <button
            key={d}
            onClick={() => onRangeChange(d)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              range === d ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-warm-200 bg-white text-warm-500'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE4" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78746C' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#78746C' }} tickLine={false} domain={[yMin, yMax]} />
              <Tooltip
                contentStyle={{ background: 'white', border: '1px solid #ECEAE4', borderRadius: 8, fontSize: 12 }}
                formatter={(val, name) => [val ? `${val}kg` : '—', name === 'avg' ? '7-day avg' : 'Daily']}
              />
              {goalWeight && (
                <ReferenceLine y={goalWeight} stroke="#D97706" strokeDasharray="4 2" label={{ value: `Goal ${goalWeight}kg`, position: 'insideTopRight', fontSize: 10, fill: '#D97706' }} />
              )}
              <Line type="monotone" dataKey="actual" stroke="#D8D4CC" strokeWidth={1} dot={{ r: 2, fill: '#D8D4CC' }} name="daily" />
              <Line type="monotone" dataKey="avg" stroke="#D97706" strokeWidth={2.5} dot={false} name="avg" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-warm-400 text-center mt-1">Amber line = 7-day rolling average · Gray dots = daily</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card p-8 text-center text-warm-400 text-sm">
          Log your weight to see the trend
        </div>
      )}
    </div>
  );
}

function MacrosChart({ data }) {
  if (!data.length) return <EmptyState msg="Log some food to see macro trends" />;

  const chartData = data.map(d => ({
    date: formatDate(d.date),
    Calories: Math.round(d.total_cal),
    Protein: Math.round(d.total_pro),
  }));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4">
        <p className="text-xs font-medium text-warm-500 mb-3">Calories (60 days)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE4" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#78746C' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#78746C' }} tickLine={false} />
            <Tooltip contentStyle={{ background: 'white', border: '1px solid #ECEAE4', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="Calories" fill="#D97706" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4">
        <p className="text-xs font-medium text-warm-500 mb-3">Protein (g)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE4" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#78746C' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: '#78746C' }} tickLine={false} />
            <Tooltip contentStyle={{ background: 'white', border: '1px solid #ECEAE4', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="Protein" fill="#60A5FA" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PointsChart({ data }) {
  if (!data.length) return <EmptyState msg="Log consistently to see points trends" />;

  const chartData = data.map(d => ({
    week: formatDate(d.week_start),
    Points: Math.round(d.total_points),
    Threshold: d.threshold,
    earned: d.treat_earned,
  }));

  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <p className="text-xs font-medium text-warm-500 mb-3">Weekly points (12 weeks)</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ECEAE4" />
          <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#78746C' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#78746C' }} tickLine={false} />
          <Tooltip contentStyle={{ background: 'white', border: '1px solid #ECEAE4', borderRadius: 8, fontSize: 12 }} />
          <ReferenceLine y={chartData[0]?.Threshold} stroke="#D97706" strokeDasharray="4 2" label={{ value: 'Threshold', position: 'insideTopRight', fontSize: 10, fill: '#D97706' }} />
          <Bar dataKey="Points" fill="#D97706" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00Z');
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

function EmptyState({ msg }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-8 text-center text-warm-400 text-sm">{msg}</div>
  );
}
