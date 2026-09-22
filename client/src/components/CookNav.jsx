import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/cook/recipes', label: 'Recipes', icon: RecipesIcon },
  { to: '/cook/cooked', label: 'Cooked', icon: CookedIcon },
];

export default function CookNav() {
  return (
    <nav
      className="tab-bar flex-shrink-0 border-t border-hair"
      style={{
        background: 'color-mix(in oklab, var(--bg) 80%, transparent)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div className="flex">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center pt-2 pb-1 gap-0.5 transition-colors press-scale ${
                isActive ? 'text-tx' : 'text-tx-3'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className="w-1 h-1 rounded-full mb-0.5 transition-colors"
                  style={{ backgroundColor: isActive ? 'var(--cook)' : 'transparent' }}
                />
                <Icon />
                <span className="text-[11px]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function RecipesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function CookedIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
