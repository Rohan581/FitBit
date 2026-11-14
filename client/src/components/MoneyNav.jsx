import { NavLink } from 'react-router-dom';

const I = ({ d, children }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);
const tabs = [
  { to: '/money', label: 'Month', icon: <I><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 4" /></I> },
  { to: '/money/activity', label: 'Activity', icon: <I d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> },
  { to: '/money/review', label: 'Review', icon: <I><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" /></I> },
  { to: '/money/recurring', label: 'Recurring', icon: <I><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></I> },
  { to: '/money/savings', label: 'Savings', icon: <I><path d="M12 3v10M8 9l4 4 4-4" /><path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" /></I> },
];

export default function MoneyNav() {
  return (
    <nav
      className="tab-bar flex-shrink-0 border-t border-hair"
      style={{ background: 'color-mix(in oklab, var(--bg) 80%, transparent)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}
    >
      <div className="flex">
        {tabs.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/money'}
            className={({ isActive }) => `flex-1 flex flex-col items-center pt-2 pb-1 gap-0.5 transition-colors press-scale ${isActive ? 'text-tx' : 'text-tx-3'}`}
          >
            {({ isActive }) => (
              <>
                <div className="w-1 h-1 rounded-full mb-0.5 transition-colors" style={{ backgroundColor: isActive ? 'var(--money)' : 'transparent' }} />
                {icon}
                <span className="text-[11px]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
