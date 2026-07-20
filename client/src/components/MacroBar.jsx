import { useState, useEffect, useRef } from 'react';

export function MacroBar({ label, current, target, token, unit = 'g', direction }) {
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

  const isLimit = direction === 'limit';
  const overLimit = isLimit && current > target;
  const nearLimit = isLimit && pct >= 80 && pct < 100;

  let barColor = `var(--${token})`;
  if (isLimit && overLimit) barColor = 'var(--danger)';
  else if (isLimit && nearLimit) barColor = 'var(--warning)';

  const displayUnit = unit === 'kcal' ? '' : ` ${unit}`;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0"
            style={{ backgroundColor: `var(--${token})` }}
          />
          <span className="text-xs text-tx-2">{label}</span>
        </div>
        <span className="text-sm font-num text-tx">
          <CountUp value={current} />{displayUnit}
          <span className="text-tx-3 text-xs"> / {Math.round(target)}{displayUnit}</span>
        </span>
      </div>
      <div className="h-2 bg-card-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-fill"
          style={{ width: `${animPct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

export function PointsRing({ current, target, size = 220 }) {
  const strokeWidth = size >= 200 ? 18 : 7;
  const r = size >= 200 ? 92 : (size - 10) / 2;
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const circ = 2 * Math.PI * r;
  const [animOffset, setAnimOffset] = useState(circ);
  const [celebrate, setCelebrate] = useState(false);
  const prevPctRef = useRef(0);

  const svgSize = r * 2 + strokeWidth + 4;

  useEffect(() => {
    const targetOffset = circ * (1 - pct);
    requestAnimationFrame(() => setAnimOffset(targetOffset));

    if (pct >= 1 && prevPctRef.current < 1) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 600);
    }
    prevPctRef.current = pct;
  }, [pct, circ]);

  const isLarge = size >= 200;

  return (
    <div
      className={`relative flex items-center justify-center ${celebrate ? 'ring-celebrate' : ''}`}
      style={{ width: svgSize, height: svgSize }}
    >
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        <circle
          cx={svgSize / 2} cy={svgSize / 2} r={r}
          fill="none" stroke="var(--hair)" strokeWidth={strokeWidth}
        />
        <circle
          cx={svgSize / 2} cy={svgSize / 2} r={r}
          fill="none"
          stroke="var(--points)"
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={animOffset}
          strokeLinecap="round"
          className="ring-animate"
        />
      </svg>
      <div className="absolute text-center">
        {isLarge ? (
          <>
            <div className="text-[52px] font-num font-bold text-tx leading-none">
              <CountUp value={Math.round(current)} />
            </div>
            <div className="text-xs text-tx-3 mt-1">of {target} this week</div>
          </>
        ) : (
          <>
            <div className="text-xl font-num font-medium text-tx leading-tight">
              <CountUp value={Math.round(current)} />
            </div>
            <div className="text-[11px] text-tx-3">of {target} pts</div>
          </>
        )}
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
