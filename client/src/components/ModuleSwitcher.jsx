import { Dumbbell } from 'lucide-react';

const MODULES = [
  { id: 'fitness', label: 'Fitness', sub: 'Food, training, points', color: 'var(--points)', Icon: Dumbbell },
];

export default function ModuleSwitcher({ open, onClose, current, onSwitch }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-enter" onClick={onClose} />
      <div className="relative w-[280px] h-full bg-card sheet-enter flex flex-col" style={{ borderRight: '1px solid var(--hair)' }}>
        <div className="px-5 pt-6 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[.08em] text-tx-3">Modules</p>
        </div>
        <div className="flex flex-col gap-2 px-4">
          {MODULES.map(({ id, label, sub, color, Icon }) => {
            const active = current === id;
            return (
              <button
                key={id}
                onClick={() => onSwitch(id)}
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-[16px] press-scale text-left transition-colors"
                style={{
                  border: `1.5px solid ${active ? `color-mix(in oklab, ${color} 60%, transparent)` : 'var(--hair)'}`,
                  background: active ? `color-mix(in oklab, ${color} 14%, transparent)` : 'transparent',
                }}
              >
                <div
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                  style={{ background: `color-mix(in oklab, ${color} 18%, transparent)` }}
                >
                  <Icon size={20} style={{ color }} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-tx">{label}</div>
                  <div className="text-[12px] text-tx-3">{sub}</div>
                </div>
                {active && (
                  <div className="ml-auto w-2 h-2 rounded-full" style={{ background: color }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
