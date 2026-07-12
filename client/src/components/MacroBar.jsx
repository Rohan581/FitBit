import { useState, useEffect, useRef } from 'react';

export function MacroBar({ label, current, target, variant = 'calories' }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const [animPct, setAnimPct] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      requestAnimationFrame(() => setAnimPct(pct));
    } else {
      setAnimPct(pct);
    }
  }, [pct]);

  const barColor = variant === 'protein' ? 'bg-success' : 'bg-accent';
  const unit = variant === 'calories' ? '' : ' g';
  const displayLabel = variant === 'calories' ? 'Calories' : 'Protein';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-warm-500">{label || displayLabel}</span>
        <span className="text-sm text-warm-700">
          <CountUp value={current} />{unit}
          <span className="text-warm-400 text-xs"> / {Math.round(target)}{unit}</span>
        </span>
      </div>
      <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-fill ${barColor}`}
          style={{ width: `${animPct}%` }}
        />
      </div>
    </div>
  );
}

export function PointsRing({ current, target, size = 92 }) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const [animOffset, setAnimOffset] = useState(circ);
  const [celebrate, setCelebrate] = useState(false);
  const prevPctRef = useRef(0);

  useEffect(() => {
    const targetOffset = circ * (1 - pct);
    requestAnimationFrame(() => setAnimOffset(targetOffset));

    if (pct >= 1 && prevPctRef.current < 1) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 600);
    }
    prevPctRef.current = pct;
  }, [pct, circ]);

  return (
    <div
      className={`relative flex items-center justify-center ${celebrate ? 'ring-celebrate' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--chart-ring-track)" strokeWidth={7}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={pct >= 1 ? 'var(--chart-accent-complete)' : 'var(--chart-accent)'}
          strokeWidth={7}
          strokeDasharray={circ}
          strokeDashoffset={animOffset}
          strokeLinecap="round"
          className="ring-animate"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-medium text-warm-800 leading-tight">
          <CountUp value={Math.round(current)} />
        </div>
        <div className="text-[11px] text-warm-400">of {target} pts</div>
      </div>
    </div>
  );
}

export function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (reducedMotion.current) {
      setDisplay(Math.round(value));
      return;
    }

    const duration = 1100;
    const start = performance.now();
    startRef.current = start;

    function tick(now) {
      if (startRef.current !== start) return;
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value]);

  return <>{display}</>;
}
