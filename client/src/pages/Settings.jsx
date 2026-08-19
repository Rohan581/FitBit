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
        weekly_point_threshold: g.weekly_point_threshold || 315,
        reward_credit_amount: g.reward_credit_amount || 2000,
        calorie_override: g.calorie_override,
        protein_override: g.protein_override,
        fat_override: g.fat_override,
        carb_override: g.carb_override,
        deficit_pct: g.deficit_pct ?? 0.25,
        enable_chest_measurement: g.enable_chest_measurement || 0,
        enable_hips_measurement: g.enable_hips_measurement || 0,
        rest_day_reduction: g.rest_day_reduction || 150,
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
        weekly_point_threshold: parseInt(form.weekly_point_threshold),
        reward_credit_amount: parseFloat(form.reward_credit_amount) || 2000,
        deficit_pct: parseFloat(form.deficit_pct),
        enable_chest_measurement: form.enable_chest_measurement ? 1 : 0,
        enable_hips_measurement: form.enable_hips_measurement ? 1 : 0,
        rest_day_reduction: parseInt(form.rest_day_reduction) || 150,
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

        <Section title="Deficit">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-tx-2">Deficit percentage</label>
              <span className="text-sm font-num text-tx">{Math.round((parseFloat(form.deficit_pct) || 0.25) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.15"
              max="0.28"
              step="0.01"
              value={form.deficit_pct || 0.25}
              onChange={e => set('deficit_pct', parseFloat(e.target.value))}
              className="w-full accent-[var(--points)]"
            />
            <div className="flex justify-between text-[10px] text-tx-3">
              <span>15% (gentle)</span>
              <span>28% (aggressive)</span>
            </div>
            <p className="text-xs text-tx-3 px-1">Target = TDEE x (1 - deficit%). Default: 25%. Higher values risk muscle loss.</p>
            {computed_targets?.floored && (
              <p className="text-xs text-amber-500 px-1">Target was floored to BMR x 1.1 to prevent going below safe intake.</p>
            )}
          </div>
        </Section>

        <Section title="Measurements">
          <p className="text-xs text-tx-3 mb-2">Waist is always tracked. Enable optional measurements below.</p>
          <ToggleRow label="Chest measurement" checked={!!form.enable_chest_measurement} onChange={v => set('enable_chest_measurement', v ? 1 : 0)} />
          <ToggleRow label="Hips measurement" checked={!!form.enable_hips_measurement} onChange={v => set('enable_hips_measurement', v ? 1 : 0)} />
        </Section>

        <Section title="Rest-day cycling">
          <p className="text-xs text-tx-3 mb-2">Calorie reduction on rest days. Taken from carbs; protein and fat stay the same.</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="100"
              max="250"
              step="25"
              value={form.rest_day_reduction || 150}
              onChange={e => set('rest_day_reduction', parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-num text-tx w-16 text-right">−{form.rest_day_reduction || 150} kcal</span>
          </div>
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

        <Section title="Points">
          <Row label="Weekly reward threshold (pts)" value={form.weekly_point_threshold} onChange={v => set('weekly_point_threshold', v)} type="number" />
          <p className="text-xs text-tx-3 px-1">Default: 315 pts. Hit this to credit your reward bank.</p>
          <Row label="Weekly reward credit (₹)" value={form.reward_credit_amount} onChange={v => set('reward_credit_amount', v)} type="number" step="500" />
          <p className="text-xs text-tx-3 px-1">Amount credited to your bank each week you hit threshold.</p>
        </Section>

        <NotificationsSection />

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

function NotificationsSection() {
  const [pushState, setPushState] = useState({
    supported: false, subscribed: false, permissionDenied: false,
    measurement_reminder: false, stale_workout: false,
    food_reminder: false, food_reminder_time: '21:00',
    vapid_configured: false, loading: true, error: null,
  });
  const [testResult, setTestResult] = useState(null);
  const [subEndpoint, setSubEndpoint] = useState(null);
  const [showDiag, setShowDiag] = useState(false);
  const [diag, setDiag] = useState(null);
  const [vapidKey, setVapidKey] = useState(null); // pre-fetched for iOS gesture safety

  // Pre-fetch VAPID key at mount so enableNotifications doesn't need async before requestPermission
  useEffect(() => {
    api.getVapidKey().then(r => setVapidKey(r.publicKey)).catch(() => {});
  }, []);

  useEffect(() => {
    async function check() {
      try {
        const hasServiceWorker = 'serviceWorker' in navigator;
        const hasPushManager = 'PushManager' in window;
        const hasNotification = typeof Notification !== 'undefined';

        if (!hasServiceWorker || !hasPushManager || !hasNotification) {
          setPushState(s => ({ ...s, supported: false, loading: false,
            error: `SW:${hasServiceWorker} Push:${hasPushManager} Notif:${hasNotification}` }));
          return;
        }

        const permState = Notification.permission;
        if (permState === 'denied') {
          setPushState(s => ({ ...s, supported: true, permissionDenied: true, loading: false }));
          return;
        }

        const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        await reg.update().catch(() => {});
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setSubEndpoint(sub.endpoint);
          const status = await api.getPushStatus(sub.endpoint);
          setPushState({
            supported: true, subscribed: true, permissionDenied: false,
            measurement_reminder: status.measurement_reminder,
            stale_workout: status.stale_workout,
            food_reminder: status.food_reminder,
            food_reminder_time: status.food_reminder_time || '21:00',
            vapid_configured: status.vapid_configured,
            loading: false, error: null,
          });
        } else {
          setPushState(s => ({ ...s, supported: true, loading: false }));
        }
      } catch (e) {
        setPushState(s => ({ ...s, supported: false, loading: false, error: e.message || 'Unknown error' }));
      }
    }
    check();
  }, []);

  // iOS-safe: no awaits before requestPermission. VAPID key is pre-fetched.
  async function enableNotifications() {
    try {
      // 1. Request permission FIRST (must be synchronous from user gesture on iOS)
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPushState(s => ({ ...s, permissionDenied: perm === 'denied' }));
        return;
      }
      // 2. Register SW (permission already granted, safe to await)
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      // 3. Use pre-fetched VAPID key
      const key = vapidKey || (await api.getVapidKey()).publicKey;
      if (!key) return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      setSubEndpoint(sub.endpoint);
      await api.subscribePush({
        subscription: sub.toJSON(),
        measurement_reminder: true, stale_workout: true,
        food_reminder: false, food_reminder_time: '21:00',
      });
      setPushState(s => ({
        ...s, subscribed: true, permissionDenied: false,
        measurement_reminder: true, stale_workout: true,
        food_reminder: false, food_reminder_time: '21:00',
      }));
    } catch (e) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setPushState(s => ({ ...s, permissionDenied: true }));
      } else {
        setPushState(s => ({ ...s, error: e.message || 'Enable failed' }));
      }
    }
  }

  async function updatePrefs(updates) {
    const next = { ...pushState, ...updates };
    setPushState(next);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await api.subscribePush({
          subscription: sub.toJSON(),
          measurement_reminder: next.measurement_reminder,
          stale_workout: next.stale_workout,
          food_reminder: next.food_reminder,
          food_reminder_time: next.food_reminder_time,
        });
      }
    } catch { /* silent */ }
  }

  async function disableNotifications() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await api.unsubscribePush({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubEndpoint(null);
      setPushState(s => ({ ...s, subscribed: false, measurement_reminder: false, stale_workout: false, food_reminder: false }));
    } catch { /* silent */ }
  }

  async function handleTestPush() {
    if (!subEndpoint) {
      setTestResult('No subscription endpoint — try disabling and re-enabling');
      setTimeout(() => setTestResult(null), 5000);
      return;
    }
    setTestResult('sending');
    try {
      await api.testPush(subEndpoint);
      setTestResult('sent');
      setTimeout(() => setTestResult(null), 4000);
    } catch (e) {
      setTestResult(e.message || 'Send failed');
      setTimeout(() => setTestResult(null), 8000);
    }
  }

  async function runDiagnostics() {
    const results = {};

    // 1. HTTPS or localhost
    results.https = location.protocol === 'https:' || location.hostname === 'localhost';

    // 2. Standalone (home screen) mode
    results.standalone = window.matchMedia('(display-mode: standalone)').matches
      || navigator.standalone === true;

    // 3. Service Worker API
    results.swApi = 'serviceWorker' in navigator;

    // 4. SW registration
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      results.swRegistered = !!reg;
      if (reg) results.swState = reg.active ? 'active' : reg.waiting ? 'waiting' : reg.installing ? 'installing' : 'none';
    } catch { results.swRegistered = false; }

    // 5. Notification API available
    results.notifApi = typeof Notification !== 'undefined';
    results.notifPerm = results.notifApi ? Notification.permission : 'n/a';

    // 6. PushManager API
    results.pushApi = 'PushManager' in window;

    // 7. Push subscription
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      results.pushSub = !!sub;
      if (sub) results.pushEndpoint = sub.endpoint.slice(0, 60) + '...';
    } catch { results.pushSub = false; }

    // 8. VAPID key from server
    try {
      const { publicKey } = await api.getVapidKey();
      results.vapidKey = !!publicKey;
    } catch { results.vapidKey = false; }

    // 9. Scheduler status
    try {
      const sched = await api.getSchedulerStatus();
      results.schedulerLastRun = sched.last_run || 'never';
      results.vapidServer = sched.vapid_configured;
    } catch { results.schedulerLastRun = 'error'; results.vapidServer = false; }

    setDiag(results);
  }

  if (pushState.loading) {
    return (
      <div className="bg-card rounded-card p-4 space-y-3 stagger-enter">
        <h2 className="text-sm font-semibold text-tx">Notifications</h2>
        <p className="text-xs text-tx-3">Checking push support...</p>
      </div>
    );
  }

  const statusLabel = !pushState.supported ? 'Not supported'
    : pushState.permissionDenied ? 'Permission denied'
    : pushState.subscribed ? 'Subscribed'
    : 'Not subscribed';

  const statusColor = pushState.subscribed ? 'text-points' : 'text-tx-3';

  return (
    <div className="bg-card rounded-card p-4 space-y-3 stagger-enter">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-tx">Notifications</h2>
        <span className={`text-[11px] font-semibold ${statusColor}`}>{statusLabel}</span>
      </div>
      {pushState.subscribed && !pushState.vapid_configured && (
        <p className="text-xs text-danger">Server VAPID keys not configured — push will not deliver. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.</p>
      )}
      {pushState.error && (
        <p className="text-xs text-tx-3">{pushState.error}</p>
      )}

      {!pushState.supported ? (
        <p className="text-xs text-tx-3">Push notifications are not supported in this browser.</p>
      ) : pushState.permissionDenied ? (
        <p className="text-xs text-tx-3">Notification permission was denied. Reset it in your browser/device settings to enable push.</p>
      ) : !pushState.subscribed ? (
        <>
          <button onClick={enableNotifications} className="text-sm text-points border border-points/30 bg-card rounded-card px-3 py-1.5 press-scale">
            Enable notifications
          </button>
          <p className="text-xs text-tx-3">On iOS, notifications only work when the app is added to your home screen. Tap the share button then &ldquo;Add to Home Screen&rdquo; first.</p>
        </>
      ) : (
        <>
          <ToggleRow label="Weekly measurement reminder" checked={pushState.measurement_reminder} onChange={v => updatePrefs({ measurement_reminder: v })} />
          <p className="text-xs text-tx-3 -mt-1">Once a week if no measurement in 7+ days.</p>

          <ToggleRow label="Stale workout alert" checked={pushState.stale_workout} onChange={v => updatePrefs({ stale_workout: v })} />
          <p className="text-xs text-tx-3 -mt-1">Once if a workout is left open from yesterday.</p>

          <ToggleRow label="Food-logging reminder" checked={pushState.food_reminder} onChange={v => updatePrefs({ food_reminder: v })} />
          {pushState.food_reminder && (
            <div className="flex items-center gap-2 -mt-1">
              <span className="text-xs text-tx-3">Remind at</span>
              <input
                type="time"
                value={pushState.food_reminder_time}
                onChange={e => updatePrefs({ food_reminder_time: e.target.value })}
                className="px-2 py-1 rounded-card border border-hair text-sm font-num text-tx bg-card-2"
              />
            </div>
          )}
          <p className="text-xs text-tx-3 -mt-1">Once per day if no food logged. Off by default.</p>

          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleTestPush}
              disabled={testResult === 'sending'}
              className="text-sm text-points border border-points/30 bg-card rounded-card px-3 py-1.5 press-scale disabled:opacity-40"
            >
              {testResult === 'sending' ? 'Sending...' : testResult === 'sent' ? 'Sent!' : 'Send test notification'}
            </button>
            {testResult && testResult !== 'sending' && testResult !== 'sent' && (
              <span className="text-xs text-danger">{testResult}</span>
            )}
          </div>

          <button onClick={disableNotifications} className="text-xs text-tx-3 mt-1 press-scale">
            Disable all notifications
          </button>
        </>
      )}

      {/* Diagnostics panel */}
      <button
        onClick={() => { setShowDiag(d => !d); if (!diag) runDiagnostics(); }}
        className="text-xs text-tx-3 mt-2 press-scale"
      >
        {showDiag ? 'Hide diagnostics' : 'Debug push notifications'}
      </button>

      {showDiag && (
        <div className="space-y-1 mt-1 text-[11px] font-mono">
          {!diag ? (
            <p className="text-tx-3">Running checks...</p>
          ) : (
            <>
              <DiagRow label="1. HTTPS / localhost" ok={diag.https} detail={location.protocol} />
              <DiagRow label="2. Standalone (home screen)" ok={diag.standalone} detail={diag.standalone ? 'yes' : 'open via home screen icon'} />
              <DiagRow label="3. ServiceWorker API" ok={diag.swApi} />
              <DiagRow label="4. SW registered" ok={diag.swRegistered} detail={diag.swState || ''} />
              <DiagRow label="5. Notification API" ok={diag.notifApi} detail={`perm: ${diag.notifPerm}`} />
              <DiagRow label="6. PushManager API" ok={diag.pushApi} />
              <DiagRow label="7. Push subscription" ok={diag.pushSub} detail={diag.pushEndpoint || 'none'} />
              <DiagRow label="8. VAPID key (server)" ok={diag.vapidKey} />
              <DiagRow label="9. Server VAPID configured" ok={diag.vapidServer} />
              <DiagRow label="10. Scheduler last run" ok={diag.schedulerLastRun !== 'never' && diag.schedulerLastRun !== 'error'} detail={diag.schedulerLastRun} />
              <button onClick={runDiagnostics} className="text-points press-scale mt-1">Re-run checks</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DiagRow({ label, ok, detail }) {
  return (
    <div className="flex items-start gap-1.5">
      <span>{ok ? '\u2705' : '\u274C'}</span>
      <span className={ok ? 'text-tx-2' : 'text-danger'}>{label}</span>
      {detail && <span className="text-tx-3 ml-auto text-right truncate max-w-[140px]">{detail}</span>}
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-tx-2">{label}</label>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-points' : 'bg-card-2 border border-hair'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${checked ? 'translate-x-4' : ''}`} />
      </button>
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
