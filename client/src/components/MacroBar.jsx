export function MacroBar({ label, current, target, color = 'bg-amber-500', unit = 'g' }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isOver = current > target;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-warm-500 font-medium">{label}</span>
        <span className={`font-semibold ${isOver ? 'text-amber-600' : 'text-warm-700'}`}>
          {Math.round(current)}{unit} <span className="text-warm-400 font-normal">/ {Math.round(target)}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-fill ${isOver ? 'bg-amber-400' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CalorieRing({ current, target, size = 80 }) {
  const pct = target > 0 ? Math.min((current / target), 1) : 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = circ * (1 - pct);
  const isOver = current > target;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ECEAE4" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={isOver ? '#FBBF24' : '#D97706'}
          strokeWidth={6}
          strokeDasharray={circ}
          strokeDashoffset={stroke}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute text-center">
        <div className={`text-base font-bold leading-tight ${isOver ? 'text-amber-500' : 'text-warm-800'}`}>
          {Math.round(current)}
        </div>
        <div className="text-[10px] text-warm-400">kcal</div>
      </div>
    </div>
  );
}
