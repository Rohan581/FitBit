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
  const [planningData, setPlanningData] = useState(null);
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
        } else if (tab === 'planning') {
          const d = await api.getPlanning();
          setPlanningData(d);
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
        <h1 className="text-[22px] font-bold text-tx">Trends</h1>
      </div>

      {/* Tab bar */}
      <div className="mb-4">
        <div className="flex bg-card rounded-card p-1 gap-1">
          {[
            { id: 'weight', label: 'Weight' },
            { id: 'macros', label: 'Macros' },
            { id: 'points', label: 'Points' },
            { id: 'planning', label: 'Plan' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-[12px] text-sm transition-colors ${
                tab === t.id ? 'bg-card-2 text-tx shadow-subtle' : 'text-tx-3'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
        </div>
      ) : (
        <div className="tab-fade-enter">
          {tab === 'weight' && weightData && <WeightChart data={weightData} range={weightRange} onRangeChange={setWeightRange} />}
          {tab === 'macros' && macroData && <MacrosChart data={macroData} />}
          {tab === 'points' && pointsData && <PointsChart data={pointsData} />}
          {tab === 'planning' && planningData && <PlanningSection data={planningData} />}
          {!loading && ((tab === 'weight' && !weightData?.weights?.length) ||
            (tab === 'macros' && !macroData?.length) ||
            (tab === 'points' && !pointsData?.length)) && (
            <div className="text-center py-12 text-tx-3">
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
  const { weights, milestones, goal, measurements } = data;

  // Build a map of date -> waist_cm for merging
  const waistMap = {};
  (measurements || []).forEach(m => { waistMap[m.date] = m.waist_cm; });

  const chartData = weights.map(w => ({
    date: w.date,
    label: formatDate(w.date),
    actual: w.weight_kg,
    avg: w.rolling_avg,
    waist: waistMap[w.date] || null,
  }));

  const yMin = weights.length > 0 ? Math.min(...weights.map(w => w.weight_kg)) - 1 : 75;
  const yMax = weights.length > 0 ? Math.max(...weights.map(w => w.weight_kg)) + 1 : 95;

  const hasWaistData = (measurements || []).length > 0;

  const latestAvg = weights.length > 0 ? weights[weights.length - 1].rolling_avg : null;
  const goalWeight = goal?.goal_weight_kg;
  const startWeight = goal?.start_weight_kg;

  const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--hair)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--text-2)',
  };

  return (
    <div className="space-y-3">
      {latestAvg && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-num font-semibold text-tx">{latestAvg} kg</div>
              <div className="text-[11px] text-tx-3">7-day avg</div>
            </div>
            {startWeight && (
              <div>
                <div className="text-lg font-num font-semibold text-cal">
                  {latestAvg < startWeight ? '-' : '+'}{Math.abs(Math.round((latestAvg - startWeight) * 10) / 10)} kg
                </div>
                <div className="text-[11px] text-tx-3">from start</div>
              </div>
            )}
            {goalWeight && (
              <div>
                <div className="text-lg font-num font-semibold text-tx">
                  {Math.round((latestAvg - goalWeight) * 10) / 10} kg
                </div>
                <div className="text-[11px] text-tx-3">to goal</div>
              </div>
            )}
          </div>
          {goal?.target_date && (
            <div className="mt-3 pt-3 border-t border-hair text-xs text-tx-3 text-center">
              Goal: {goalWeight} kg by {new Date(goal.target_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {hasWaistData && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-num font-semibold" style={{ color: 'var(--fiber)' }}>
                {measurements[measurements.length - 1].waist_cm} cm
              </div>
              <div className="text-[11px] text-tx-3">latest waist</div>
            </div>
            {measurements.length >= 2 && (
              <div>
                <div className="text-lg font-num font-semibold" style={{ color: 'var(--fiber)' }}>
                  {(() => {
                    const diff = Math.round((measurements[measurements.length - 1].waist_cm - measurements[0].waist_cm) * 10) / 10;
                    return `${diff > 0 ? '+' : ''}${diff} cm`;
                  })()}
                </div>
                <div className="text-[11px] text-tx-3">waist change</div>
              </div>
            )}
          </div>
        </div>
      )}

      {milestones?.some(m => m.achieved_date) && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-xs text-tx-3 mb-2">Milestones</p>
          <div className="space-y-1.5">
            {milestones.map(m => (
              <div key={m.id} className={`flex items-center justify-between text-sm ${m.achieved_date ? 'text-tx' : 'text-tx-3'}`}>
                <span>{m.achieved_date ? '✓' : '○'} <span className="font-num">{m.weight_kg_threshold} kg</span></span>
                {m.achieved_date && <span className="text-xs text-tx-3">{formatDate(m.achieved_date)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 stagger-enter">
        {[30, 60, 90].map(d => (
          <button
            key={d}
            onClick={() => onRangeChange(d)}
            className={`flex-1 py-1.5 rounded-card text-sm border transition-colors press-scale ${
              range === d ? 'border-points tint-points text-points' : 'border-hair bg-card text-tx-3'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {chartData.length > 0 ? (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: hasWaistData ? 10 : 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} domain={[yMin, yMax]} />
              {hasWaistData && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--fiber)' }} tickLine={false} domain={['auto', 'auto']} />
              )}
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => {
                if (!val) return ['-', name];
                if (name === 'waist') return [`${val} cm`, 'Waist'];
                return [`${val} kg`, name === 'avg' ? '7-day avg' : 'Daily'];
              }} />
              {goalWeight && (
                <ReferenceLine y={goalWeight} stroke="var(--cal)" strokeDasharray="4 2" label={{ value: `Goal ${goalWeight} kg`, position: 'insideTopRight', fontSize: 10, fill: 'var(--cal)' }} />
              )}
              <Line type="monotone" dataKey="actual" stroke="var(--hair)" strokeWidth={1} dot={{ r: 2, fill: 'var(--text-3)' }} name="daily" />
              <Line type="monotone" dataKey="avg" stroke="var(--cal)" strokeWidth={2.5} dot={false} name="avg" />
              {hasWaistData && (
                <Line type="monotone" dataKey="waist" stroke="var(--fiber)" strokeWidth={2} dot={{ r: 2.5, fill: 'var(--fiber)' }} name="waist" connectNulls yAxisId="right" />
              )}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-tx-3 text-center mt-2">
            {hasWaistData ? 'Orange = weight avg, green = waist (cm)' : 'Colored line = 7-day rolling average'}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-card p-8 text-center text-tx-3 text-sm">
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

  const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--hair)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--text-2)',
  };

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-xs text-tx-3 mb-3">Calories (60 days)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="Calories" fill="var(--cal)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-xs text-tx-3 mb-3">Protein (g)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="Protein" fill="var(--protein)" radius={[3, 3, 0, 0]} />
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

  const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--hair)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--text-2)',
  };

  return (
    <div className="bg-card rounded-card p-4 stagger-enter">
      <p className="text-xs text-tx-3 mb-3">Weekly points (12 weeks)</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
          <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={chartData[0]?.Threshold} stroke="var(--points)" strokeDasharray="4 2" label={{ value: 'Threshold', position: 'insideTopRight', fontSize: 10, fill: 'var(--points)' }} />
          <Bar dataKey="Points" fill="var(--points)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlanningSection({ data }) {
  if (data.insufficient_data) {
    return (
      <div className="bg-card rounded-card p-6 text-center stagger-enter">
        <p className="text-sm text-tx-2">{data.message}</p>
      </div>
    );
  }

  const paceColors = {
    ahead: 'var(--points)',
    on_track: 'var(--points)',
    slightly_behind: 'var(--star)',
    behind: 'var(--cal)',
  };

  const paceColor = paceColors[data.pace_verdict] || 'var(--text-2)';

  return (
    <div className="space-y-3">
      {/* Pace verdict */}
      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Weekly pace</p>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold" style={{ color: paceColor }}>{data.pace_label}</span>
          <span className="text-sm font-num text-tx-3">
            {data.gap_kg > 0 ? `${data.gap_kg} kg above` : `${Math.abs(data.gap_kg)} kg below`} expected
          </span>
        </div>
        <div className="mt-2 text-xs text-tx-3">
          Current avg: <span className="font-num text-tx">{data.latest_avg} kg</span>
          {' '} | Expected: <span className="font-num text-tx">{data.expected_weight} kg</span>
        </div>
      </div>

      {/* This week's target */}
      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">This week's target</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-num font-semibold text-tx">{data.week_target_weight} kg</span>
          <span className="text-xs text-tx-3">rolling average by Sunday</span>
        </div>
      </div>

      {/* Projected finish */}
      <div className="bg-card rounded-card p-4 stagger-enter">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">Projected finish</p>
        {!data.projection_available ? (
          <p className="text-sm text-tx-3">Gathering data — projection available after 3 weeks.</p>
        ) : data.projected_finish === 'not_losing' ? (
          <p className="text-sm text-tx-2">Weight trend is flat or rising. Keep at it — the trend needs time to establish.</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-num font-semibold text-tx">
              {new Date(data.projected_finish + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-xs text-tx-3">at current pace to {data.goal_weight} kg</span>
          </div>
        )}
      </div>

      {/* Diagnostic */}
      {data.diagnostic && (
        <div className="bg-card rounded-card p-4 border border-hair stagger-enter">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">What might be off</p>
          <p className="text-sm text-tx-2">{data.diagnostic.message}</p>
        </div>
      )}

      {/* Milestone countdown */}
      {data.milestone_countdown && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">Next milestone</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-num font-semibold text-points">{data.milestone_countdown.weight} kg</span>
            <span className="text-sm font-num text-tx-3">{data.milestone_countdown.kg_remaining} kg to go</span>
          </div>
          {data.milestone_countdown.estimated_date && (
            <p className="text-xs text-tx-3 mt-1">
              Estimated: {new Date(data.milestone_countdown.estimated_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at current pace
            </p>
          )}
        </div>
      )}
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
    <div className="bg-card rounded-card p-8 text-center text-tx-3 text-sm">{msg}</div>
  );
}
