import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar,
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
    <div className="px-4 pb-4 tab-fade-enter">
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-medium text-warm-800">Trends</h1>
      </div>

      {/* Tab bar */}
      <div className="mb-4">
        <div className="flex bg-warm-100 rounded-card p-1 gap-1">
          {[
            { id: 'weight', label: 'Weight' },
            { id: 'macros', label: 'Macros' },
            { id: 'points', label: 'Points' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-[12px] text-sm transition-colors ${
                tab === t.id ? 'bg-surface text-warm-800 shadow-subtle' : 'text-warm-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="w-7 h-7 border-2 border-warm-200 border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="tab-fade-enter">
          {tab === 'weight' && weightData && <WeightChart data={weightData} range={weightRange} onRangeChange={setWeightRange} />}
          {tab === 'macros' && macroData && <MacrosChart data={macroData} />}
          {tab === 'points' && pointsData && <PointsChart data={pointsData} />}
          {!loading && ((tab === 'weight' && !weightData?.weights?.length) ||
            (tab === 'macros' && !macroData?.length) ||
            (tab === 'points' && !pointsData?.length)) && (
            <div className="text-center py-12 text-warm-400">
              <p className="text-sm">No data yet</p>
              <p className="text-xs mt-1">Start logging to see trends here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WeightChart({ data, range, onRangeChange }) {
  const { weights, milestones, goal } = data;

  const chartData = weights.map(w => ({
    date: w.date,
    label: formatDate(w.date),
    actual: w.weight_kg,
    avg: w.rolling_avg,
  }));

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
    <div className="space-y-3">
      {/* Stats row */}
      {latestAvg && (
        <div className="bg-warm-100 rounded-card p-4 stagger-enter">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-medium text-warm-800">{latestAvg} kg</div>
              <div className="text-[11px] text-warm-400">7-day avg</div>
            </div>
            {startWeight && (
              <div>
                <div className="text-lg font-medium text-accent">
                  {latestAvg < startWeight ? '-' : '+'}{Math.abs(Math.round((latestAvg - startWeight) * 10) / 10)} kg
                </div>
                <div className="text-[11px] text-warm-400">from start</div>
              </div>
            )}
            {goalWeight && (
              <div>
                <div className="text-lg font-medium text-warm-800">
                  {Math.round((latestAvg - goalWeight) * 10) / 10} kg
                </div>
                <div className="text-[11px] text-warm-400">to goal</div>
              </div>
            )}
          </div>

          {goal?.target_date && (
            <div className="mt-3 pt-3 border-t border-warm-200 text-xs text-warm-400 text-center">
              Goal: {goalWeight} kg by {new Date(goal.target_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {/* Milestones */}
      {milestones?.some(m => m.achieved_date) && (
        <div className="bg-warm-100 rounded-card p-4 stagger-enter">
          <p className="text-xs text-warm-500 mb-2">Milestones</p>
          <div className="space-y-1.5">
            {milestones.map(m => (
              <div key={m.id} className={`flex items-center justify-between text-sm ${m.achieved_date ? 'text-warm-700' : 'text-warm-300'}`}>
                <span>{m.achieved_date ? '✓' : '○'} {m.weight_kg_threshold} kg</span>
                {m.achieved_date && <span className="text-xs text-warm-400">{formatDate(m.achieved_date)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Range selector */}
      <div className="flex gap-2 stagger-enter">
        {[30, 60, 90].map(d => (
          <button
            key={d}
            onClick={() => onRangeChange(d)}
            className={`flex-1 py-1.5 rounded-card text-sm border transition-colors press-scale ${
              range === d ? 'border-accent bg-accent-tint text-accent' : 'border-warm-200 bg-surface text-warm-500'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="bg-warm-100 rounded-card p-4 stagger-enter">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-text)' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--chart-text)' }} tickLine={false} domain={[yMin, yMax]} />
              <Tooltip
                contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 12, fontSize: 12, color: 'var(--chart-text)' }}
                formatter={(val, name) => [val ? `${val} kg` : '-', name === 'avg' ? '7-day avg' : 'Daily']}
              />
              {goalWeight && (
                <ReferenceLine y={goalWeight} stroke="var(--chart-accent)" strokeDasharray="4 2" label={{ value: `Goal ${goalWeight} kg`, position: 'insideTopRight', fontSize: 10, fill: 'var(--chart-accent)' }} />
              )}
              <Line type="monotone" dataKey="actual" stroke="var(--chart-dot)" strokeWidth={1} dot={{ r: 2, fill: 'var(--chart-dot)' }} name="daily" />
              <Line type="monotone" dataKey="avg" stroke="var(--chart-accent)" strokeWidth={2.5} dot={false} name="avg" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-warm-400 text-center mt-2">Orange line = 7-day rolling average</p>
        </div>
      ) : (
        <div className="bg-warm-100 rounded-card p-8 text-center text-warm-400 text-sm">
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
    <div className="space-y-3">
      <div className="bg-warm-100 rounded-card p-4 stagger-enter">
        <p className="text-xs text-warm-500 mb-3">Calories (60 days)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--chart-text)' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'var(--chart-text)' }} tickLine={false} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 12, fontSize: 12, color: 'var(--chart-text)' }} />
            <Bar dataKey="Calories" fill="var(--chart-accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-warm-100 rounded-card p-4 stagger-enter">
        <p className="text-xs text-warm-500 mb-3">Protein (g)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--chart-text)' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'var(--chart-text)' }} tickLine={false} />
            <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 12, fontSize: 12, color: 'var(--chart-text)' }} />
            <Bar dataKey="Protein" fill="var(--chart-success)" radius={[3, 3, 0, 0]} />
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
  }));

  return (
    <div className="bg-warm-100 rounded-card p-4 stagger-enter">
      <p className="text-xs text-warm-500 mb-3">Weekly points (12 weeks)</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--chart-text)' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--chart-text)' }} tickLine={false} />
          <Tooltip contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 12, fontSize: 12, color: 'var(--chart-text)' }} />
          <ReferenceLine y={chartData[0]?.Threshold} stroke="var(--chart-accent)" strokeDasharray="4 2" label={{ value: 'Threshold', position: 'insideTopRight', fontSize: 10, fill: 'var(--chart-accent)' }} />
          <Bar dataKey="Points" fill="var(--chart-accent)" radius={[3, 3, 0, 0]} />
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
    <div className="bg-warm-100 rounded-card p-8 text-center text-warm-400 text-sm">{msg}</div>
  );
}
