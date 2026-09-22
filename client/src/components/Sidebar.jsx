import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';

const MODULES = [
  {
    key: 'fitness',
    name: 'Fitness',
    subtitle: 'Train, eat, track',
    icon: '💪',
    path: '/',
  },
  {
    key: 'cook',
    name: 'Cook',
    subtitle: 'Recipes & meal prep',
    icon: '🍳',
    path: '/cook/recipes',
  },
];

function getWeekStart() {
  const ist = new Date(Date.now() + 330 * 60000);
  const day = ist.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  ist.setUTCDate(ist.getUTCDate() + diff);
  return ist.toISOString().split('T')[0];
}

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [points, setPoints] = useState(null);

  const isCook = location.pathname.startsWith('/cook');
  const activeModule = isCook ? 'cook' : 'fitness';

  useEffect(() => {
    if (open) {
      api.getWeeklyPoints(getWeekStart()).then(w => setPoints(w.total || 0)).catch(() => {});
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  function switchModule(mod) {
    localStorage.setItem('earned_module', mod.key);
    onClose();
    navigate(mod.path);
  }

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="absolute inset-0 bg-black/40 backdrop-enter" onClick={onClose} />
      <div
        className="relative w-[300px] max-w-[80vw] h-full bg-card flex flex-col sidebar-enter"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <h2 className="font-num text-[22px] font-bold text-tx tracking-[-0.02em]">Earned</h2>
          <p className="text-[13.5px] text-tx-2 mt-1">
            Rohan{points !== null ? ` · ${points} points` : ''}
          </p>
        </div>

        <div className="w-full h-px bg-hair" />

        {/* Module list */}
        <div className="flex-1 overflow-y-auto px-4 pt-4">
          <div className="flex flex-col gap-3">
            {MODULES.map(mod => {
              const isActive = mod.key === activeModule;
              return (
                <button
                  key={mod.key}
                  onClick={() => switchModule(mod)}
                  className="flex items-center gap-3.5 p-3.5 rounded-[14px] border text-left press-scale transition-colors"
                  style={{
                    borderColor: isActive ? 'var(--cook)' : 'var(--hair)',
                    background: isActive
                      ? (mod.key === 'cook' ? 'var(--cook-dim)' : 'var(--accent-surface)')
                      : 'var(--card)',
                  }}
                >
                  <span className="text-[24px] leading-none">{mod.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold text-tx">{mod.name}</div>
                    <div className="text-[12.5px] text-tx-3 mt-0.5">{mod.subtitle}</div>
                  </div>
                </button>
              );
            })}

            {/* Inert "Add a module" */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-[14px] border border-dashed border-hair opacity-40">
              <span className="w-6 h-6 flex items-center justify-center text-tx-3 text-lg">+</span>
              <span className="text-[13.5px] text-tx-3">Add a module</span>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="px-4 pb-4">
          <button
            onClick={() => { onClose(); navigate('/settings'); }}
            className="flex items-center gap-3 px-3.5 py-3 text-[14px] text-tx-2 press-scale w-full"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Hamburger menu icon button for headers
export function SidebarTrigger({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 flex items-center justify-center rounded-[10px] press-scale -ml-1"
      aria-label="Open sidebar"
    >
      <svg className="w-5 h-5 text-tx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
