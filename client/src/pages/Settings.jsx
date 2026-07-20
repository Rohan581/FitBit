import { useState, useEffect } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';
import { getThemeSetting, setThemeSetting } from '../theme';

export default function Settings() {
  const [goal, setGoal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);
  const [saved, setSaved] = useState(false);
  const [theme, setTheme] = useState(getThemeSetting);

  useEffect(() => {
    api.getGoal().then(g => {
      setGoal(g);
      setForm({
        start_weight_kg: g.start_weight_kg,
        goal_weight_kg: g.goal_weight_kg,
        height_cm: g.height_cm,
        age: g.age,
        activity_multiplier: g.activity_multiplier,
        current_calorie_target: g.current_calorie_target,
        current_protein_target_g: g.current_protein_target_g,
        current_fat_target_g: g.current_fat_target_g,
        current_carb_target_g: g.current_carb_target_g,
        current_fiber_target_g: g.current_fiber_target_g || 32,
        current_sugar_limit_g: g.current_sugar_limit_g || 50,
        water_target_ml: g.water_target_ml || 3000,
        weekly_point_threshold: g.weekly_point_threshold || 350,
        calorie_override: g.calorie_override,
        protein_override: g.protein_override,
        fat_override: g.fat_override,
        carb_override: g.carb_override,
      });
    });
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.updateGoal({
        ...form,
        start_weight_kg: parseFloat(form.start_weight_kg),
        goal_weight_kg: parseFloat(form.goal_weight_kg),
        height_cm: parseFloat(form.height_cm),
        age: parseInt(form.age),
        activity_multiplier: parseFloat(form.activity_multiplier),
        current_calorie_target: parseFloat(form.current_calorie_target),
        current_protein_target_g: parseFloat(form.current_protein_target_g),
        current_fat_target_g: parseFloat(form.current_fat_target_g),
        current_carb_target_g: parseFloat(form.current_carb_target_g),
        current_fiber_target_g: parseFloat(form.current_fiber_target_g),
        current_sugar_limit_g: parseFloat(form.current_sugar_limit_g),
        water_target_ml: parseInt(form.water_target_ml),
        weekly_point_threshold: parseInt(form.weekly_point_threshold),
      });
      setGoal(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalculate() {
    setRecalculating(true);
    setRecalcResult(null);
    try {
      const result = await api.recalculateMacros();
      setRecalcResult(result);
      const g = result.goal;
      setForm(f => ({
        ...f,
        current_calorie_target: g.current_calorie_target,
        current_protein_target_g: g.current_protein_target_g,
        current_fat_target_g: g.current_fat_target_g,
        current_carb_target_g: g.current_carb_target_g,
      }));
    } catch (e) {
      setRecalcResult({ error: e.message });
    } finally {
      setRecalculating(false);
    }
  }

  if (!goal) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
    </div>
  );

  const { rolling_avg_weight, computed_targets } = goal;

  return (
    <div className="px-4 pb-8">
      <div className="pt-5 pb-5 flex items-center gap-3">
        <Link to="/" className="w-8 h-8 flex items-center justify-center rounded-full bg-card text-tx-3 press-scale">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-[22px] font-bold text-tx">Settings</h1>
      </div>

      {/* Rolling average info */}
      {rolling_avg_weight && (
        <div className="mb-4 tint-points border border-points/20 rounded-card p-4 stagger-enter">
          <p className="text-sm text-tx">Current 7-day average: <span className="font-num font-semibold">{rolling_avg_weight} kg</span></p>
          {computed_targets && (
            <p className="text-xs text-tx-3 mt-1">
              Computed: <span className="font-num">{computed_targets.calorie_target}</span> kcal · <span className="font-num">{computed_targets.protein_target}</span>g protein · <span className="font-num">{computed_targets.fat_target}</span>g fat · <span className="font-num">{computed_targets.carb_target}</span>g carbs
            </p>
          )}
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="mt-3 text-sm text-points border border-points/30 bg-card rounded-card px-3 py-1.5 disabled:opacity-40 press-scale"
          >
            {recalculating ? 'Recalculating...' : 'Recalculate targets from avg weight'}
          </button>
          {recalcResult && !recalcResult.error && (
            <div className="mt-2 text-xs text-tx-3">
              {recalcResult.changes?.length > 0
                ? recalcResult.changes.map((c, i) => <p key={i}>{c}</p>)
                : <p>Targets are already up to date</p>
              }
            </div>
          )}
          {recalcResult?.error && <p className="mt-2 text-xs text-danger">{recalcResult.error}</p>}
        </div>
      )}

      <div className="space-y-3">
        <Section title="Goal">
          <Row label="Starting weight (kg)" value={form.start_weight_kg} onChange={v => set('start_weight_kg', v)} type="number" step="0.1" />
          <Row label="Goal weight (kg)" value={form.goal_weight_kg} onChange={v => set('goal_weight_kg', v)} type="number" step="0.1" />
        </Section>

        <Section title="Body stats">
          <Row label="Height (cm)" value={form.height_cm} onChange={v => set('height_cm', v)} type="number" />
          <Row label="Age" value={form.age} onChange={v => set('age', v)} type="number" />
          <Row label="Activity multiplier" value={form.activity_multiplier} onChange={v => set('activity_multiplier', v)} type="number" step="0.05" />
          <p className="text-xs text-tx-3 px-1">1.2 = sedentary, 1.375 = light, 1.45 = moderate, 1.55 = very active</p>
        </Section>

        <Section title="Daily targets">
          <div className="space-y-3">
            <TargetRow label="Calories (kcal)" value={form.current_calorie_target} onChange={v => set('current_calorie_target', v)} override={form.calorie_override} onOverride={v => set('calorie_override', v)} />
            <TargetRow label="Protein (g)" value={form.current_protein_target_g} onChange={v => set('current_protein_target_g', v)} override={form.protein_override} onOverride={v => set('protein_override', v)} />
            <TargetRow label="Fat (g)" value={form.current_fat_target_g} onChange={v => set('current_fat_target_g', v)} override={form.fat_override} onOverride={v => set('fat_override', v)} />
            <TargetRow label="Carbs (g)" value={form.current_carb_target_g} onChange={v => set('current_carb_target_g', v)} override={form.carb_override} onOverride={v => set('carb_override', v)} />
          </div>
        </Section>

        <Section title="Fiber & Sugar">
          <Row label="Fiber target (g/day)" value={form.current_fiber_target_g} onChange={v => set('current_fiber_target_g', v)} type="number" />
          <p className="text-xs text-tx-3 px-1">Reach target = earn points. Default: 32g</p>
          <Row label="Sugar limit (g/day)" value={form.current_sugar_limit_g} onChange={v => set('current_sugar_limit_g', v)} type="number" />
          <p className="text-xs text-tx-3 px-1">Informational only — no penalty. Default: 50g</p>
        </Section>

        <Section title="Water">
          <Row label="Daily target (ml)" value={form.water_target_ml} onChange={v => set('water_target_ml', v)} type="number" step="250" />
          <p className="text-xs text-tx-3 px-1">1 glass = 250 ml. Default: 3000 ml (12 glasses)</p>
        </Section>

        <Section title="Points">
          <Row label="Weekly treat threshold (pts)" value={form.weekly_point_threshold} onChange={v => set('weekly_point_threshold', v)} type="number" />
          <p className="text-xs text-tx-3 px-1">Default: 350 pts. ~4 solid days to unlock a treat.</p>
        </Section>

        <Section title="Appearance">
          <p className="text-xs text-tx-3 mb-2">Theme</p>
          <div className="flex gap-2">
            {[
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
              { id: 'system', label: 'System' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => { setTheme(opt.id); setThemeSetting(opt.id); }}
                className={`flex-1 py-2 rounded-card text-sm border transition-colors press-scale ${
                  theme === opt.id
                    ? 'border-points tint-points text-points'
                    : 'border-hair bg-card text-tx-3'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3.5 rounded-card text-sm transition-colors press-scale ${
            saved ? 'bg-points text-white' : 'bg-points text-white'
          } disabled:opacity-40`}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-card rounded-card p-4 space-y-3 stagger-enter">
      <h2 className="text-sm font-semibold text-tx">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, onChange, type = 'text', step }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-tx-2 flex-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        step={step}
        className="w-28 px-3 py-1.5 rounded-card border border-hair text-sm text-right font-num text-tx focus:outline-none bg-card-2"
      />
    </div>
  );
}

function TargetRow({ label, value, onChange, override, onOverride }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <label className="text-sm text-tx-2">{label}</label>
          {override ? (
            <span className="ml-2 text-[10px] tint-points text-points px-1.5 py-0.5 rounded">custom</span>
          ) : (
            <span className="ml-2 text-[10px] bg-card-2 text-tx-3 px-1.5 py-0.5 rounded">auto</span>
          )}
        </div>
        <input
          type="number"
          value={value || ''}
          onChange={e => { onChange(e.target.value); onOverride(1); }}
          className="w-24 px-3 py-1.5 rounded-card border border-hair text-sm text-right font-num text-tx focus:outline-none bg-card-2"
        />
      </div>
      {override ? (
        <button onClick={() => onOverride(0)} className="text-[11px] text-points mt-0.5">
          Reset to auto-calculated
        </button>
      ) : null}
    </div>
  );
}
