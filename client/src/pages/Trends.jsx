import { useState, useEffect } from 'react';
import { api } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar,
} from 'recharts';
import MeasurementSheet from '../components/MeasurementSheet';

export default function Trends() {
  const [tab, setTab] = useState('weight');
  const [weightData, setWeightData] = useState(null);
  const [macroData, setMacroData] = useState(null);
  const [pointsData, setPointsData] = useState(null);
  const [planningData, setPlanningData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weightRange, setWeightRange] = useState(60);
  const [measurementDismissed, setMeasurementDismissed] = useState(false);
  const [showMeasurementSheet, setShowMeasurementSheet] = useState(false);
  const [goal, setGoal] = useState(null);

  useEffect(() => {
    api.getGoal().then(setGoal).catch(() => {});
  }, []);

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

  // Check if measurement reminder should show
  const measurements = weightData?.measurements || [];
  const lastMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const daysSinceLastMeasurement = lastMeasurement
    ? Math.floor((Date.now() - new Date(lastMeasurement.date + 'T12:00:00Z').getTime()) / 86400000)
    : 999;
  const showMeasurementReminder = tab === 'weight' && daysSinceLastMeasurement >= 7 && !measurementDismissed;

  function handleMeasurementLogged() {
    setShowMeasurementSheet(false);
    setMeasurementDismissed(true);
    // Reload weight data to refresh measurements
    api.getWeightTrend(weightRange).then(setWeightData).catch(() => {});
  }

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

      {/* Measurement reminder banner */}
      {showMeasurementReminder && (
        <div className="mb-3 rounded-[14px] p-3.5 px-4 flex items-center gap-3" style={{ background: 'var(--accent-surface)', border: '1px solid color-mix(in oklab, var(--fiber) 25%, transparent)' }}>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-tx-2">This week's waist measurement is open — 30 seconds, whenever suits.</p>
          </div>
          <button
            onClick={() => setShowMeasurementSheet(true)}
            className="px-3 py-1.5 rounded-[10px] text-[12px] font-bold text-points press-scale flex-shrink-0"
            style={{ background: 'color-mix(in oklab, var(--points) 15%, transparent)' }}
          >
            Log it
          </button>
          <button
            onClick={() => setMeasurementDismissed(true)}
            className="text-tx-3 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
        </div>
      ) : (
        <div className="tab-fade-enter">
          {tab === 'weight' && weightData && <WeightChart data={weightData} range={weightRange} onRangeChange={setWeightRange} />}
          {tab === 'weight' && weightData && <MeasurementsCard measurements={weightData.measurements || []} />}
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

      {/* Measurement sheet */}
      <MeasurementSheet
        open={showMeasurementSheet}
        onClose={() => setShowMeasurementSheet(false)}
        onLogged={handleMeasurementLogged}
        enableChest={!!goal?.enable_chest_measurement}
        enableHips={!!goal?.enable_hips_measurement}
      />
    </div>
  );
}

function WeightChart({ data, range, onRangeChange }) {
  const { weights, milestones, goal } = data;

  // Weight-only chart — no waist overlay
  const chartData = weights.map(w => ({
    date: w.date,
    label: formatDate(w.date),
    actual: w.weight_kg,
    avg: w.rolling_avg,
  }));

  const yMin = weights.length > 0 ? Math.min(...weights.map(w => w.weight_kg)) - 1 : 75;
  const yMax = weights.length > 0 ? Math.max(...weights.map(w => w.weight_kg)) + 1 : 95;

  const latestAvg = weights.length > 0 ? weights[weights.length - 1].rolling_avg : null;
  const goalWeight = goal?.goal_weight_kg;
  const startWeight = goal?.start_weight_kg;

  // Period change
  const firstAvg = weights.length > 0 ? weights[0].rolling_avg || weights[0].weight_kg : null;
  const periodChange = latestAvg && firstAvg ? Math.round((latestAvg - firstAvg) * 10) / 10 : null;

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
            {periodChange != null && (
              <div>
                <div className="text-lg font-num font-semibold text-cal">
                  {periodChange > 0 ? '+' : ''}{periodChange} kg
                </div>
                <div className="text-[11px] text-tx-3">over {range} days</div>
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
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} domain={[yMin, yMax]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => {
                if (!val) return ['-', name];
                return [`${val} kg`, name === 'avg' ? '7-day avg' : 'Daily'];
              }} />
              {goalWeight && (
                <ReferenceLine y={goalWeight} stroke="var(--cal)" strokeDasharray="4 2" label={{ value: `Goal ${goalWeight} kg`, position: 'insideTopRight', fontSize: 10, fill: 'var(--cal)' }} />
              )}
              <Line type="monotone" dataKey="actual" stroke="var(--hair)" strokeWidth={1} dot={{ r: 2, fill: 'var(--text-3)' }} name="daily" />
              <Line type="monotone" dataKey="avg" stroke="var(--cal)" strokeWidth={2.5} dot={false} name="avg" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-tx-3 text-center mt-2">
            Colored line = 7-day rolling average
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-card p-8 text-center text-tx-3 text-sm">
          Log your weight to see the trend
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
    </div>
  );
}

// ─── Standalone Measurements Card ────────────────────────────
function MeasurementsCard({ measurements }) {
  if (!measurements || measurements.length === 0) return null;

  const latest = measurements[measurements.length - 1];
  const first = measurements[0];
  const change = measurements.length >= 2
    ? Math.round((latest.waist_cm - first.waist_cm) * 10) / 10
    : null;
  const weeks = measurements.length >= 2
    ? Math.max(1, Math.round((new Date(latest.date + 'T12:00:00Z') - new Date(first.date + 'T12:00:00Z')) / (7 * 86400000)))
    : 0;

  const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--hair)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--text-2)',
  };

  // Supportive context line
  let contextLine = 'Measurements logged weekly give the clearest picture of progress.';
  if (change !== null) {
    if (change < -1) {
      contextLine = 'Solid progress on waist measurements — fat loss is clearly happening.';
    } else if (change < 0) {
      contextLine = 'Trending in the right direction. Consistency is what makes it stick.';
    } else if (change === 0) {
      contextLine = 'Holding steady. Keep logging — the trend will tell the story over time.';
    } else {
      contextLine = 'A slight increase can reflect water, timing, or measurement variation — keep tracking.';
    }
  }

  return (
    <div className="bg-card rounded-card p-4 mt-3 stagger-enter">
      <p className="text-[15px] font-bold text-tx mb-3">Measurements</p>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[22px] font-bold font-num" style={{ color: 'var(--fiber)' }}>
          {latest.waist_cm} cm
        </span>
        {change !== null && (
          <span className="text-[14px] font-semibold font-num" style={{ color: 'var(--fiber)' }}>
            · {change > 0 ? '+' : ''}{change} cm over {weeks} week{weeks !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="text-[12px] text-tx-3 mb-3">{contextLine}</p>

      {measurements.length >= 2 && (
        <div className="mt-2">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={measurements.map(m => ({ date: formatDate(m.date), waist: m.waist_cm }))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hair)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--fiber)' }} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val} cm`, 'Waist']} />
              <Line type="monotone" dataKey="waist" stroke="var(--fiber)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--fiber)' }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-tx-3 text-center mt-1">Weekly points connected — log weekly for best tracking</p>
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

      {/* Waist context */}
      {data.waist_context && (
        <div className="bg-card rounded-card p-4 border border-fiber/20 stagger-enter">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">Body composition</p>
          <p className="text-sm text-tx-2">{data.waist_context}</p>
        </div>
      )}

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
