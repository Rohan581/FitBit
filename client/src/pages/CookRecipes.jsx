import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { SidebarTrigger } from '../components/Sidebar';

// ─── Constants ───────────────────────────────────────────────
const FILTER_CHIPS = [
  { key: 'high-protein', label: 'High protein' },
  { key: 'air-fryer', label: 'Air fryer' },
  { key: 'high-fibre', label: 'High fibre' },
  { key: 'under-300', label: 'Under 300 kcal' },
  { key: 'quick', label: 'Quick' },
  { key: 'meal-prep', label: 'Meal prep' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'sides-dips', label: 'Sides & dips' },
];

const SORT_OPTIONS = [
  { key: 'protein-density', label: 'Protein density' },
  { key: 'calories', label: 'Calories' },
  { key: 'time', label: 'Time' },
  { key: 'recently-cooked', label: 'Recently cooked' },
];

// ─── Main component ─────────────────────────────────────────
export default function CookRecipes({ onOpenSidebar }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef(null);

  // Filters & sort
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [sort, setSort] = useState('protein-density');

  // Local favourite state for optimistic toggling
  const [localFavourites, setLocalFavourites] = useState(new Set());
  const favouritesInitialized = useRef(false);

  // ─── Debounce search ────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // ─── Fetch recipes ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { sort };
      if (activeFilters.size > 0) params.chip = [...activeFilters].join(',');
      if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
      const result = await api.getRecipes(params);
      setData(result);

      // Initialize local favourites from API response on first load
      if (!favouritesInitialized.current && result.favourites) {
        setLocalFavourites(new Set(result.favourites.map(r => r.id)));
        favouritesInitialized.current = true;
      }
    } catch (err) {
      setError('Could not load recipes');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, activeFilters, sort]);

  useEffect(() => { load(); }, [load]);

  // Refresh on focus
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // ─── Handlers ───────────────────────────────────────────────
  function toggleFilter(key) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function toggleFavourite(e, recipeId) {
    e.stopPropagation();
    // Optimistic update
    setLocalFavourites(prev => {
      const next = new Set(prev);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });
    try {
      await api.toggleRecipeFavourite(recipeId);
    } catch {
      // Revert on error
      setLocalFavourites(prev => {
        const next = new Set(prev);
        if (next.has(recipeId)) next.delete(recipeId);
        else next.add(recipeId);
        return next;
      });
    }
  }

  // ─── Render ─────────────────────────────────────────────────
  const isSearching = debouncedQuery.trim().length > 0;
  const recipes = data?.recipes || [];
  const favourites = (data?.favourites || []).filter(r => localFavourites.has(r.id));
  const recentlyCooked = data?.recentlyCooked || [];
  const total = data?.total || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 flex-shrink-0">
        {onOpenSidebar && <SidebarTrigger onClick={onOpenSidebar} />}
        <h1 className="font-num text-[22px] font-bold tracking-[-0.02em] text-tx">Cook</h1>
      </div>

      {/* Search bar */}
      <div className="px-5 mb-3 flex-shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-tx-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search recipes or ingredients..."
            className="w-full h-[44px] pl-10 pr-4 rounded-[14px] border border-hair bg-card-2 text-[14px] text-tx placeholder:text-tx-3"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-3 text-[16px] press-scale"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-5 mb-3 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
        {FILTER_CHIPS.map(chip => {
          const active = activeFilters.has(chip.key);
          return (
            <button
              key={chip.key}
              onClick={() => toggleFilter(chip.key)}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium border whitespace-nowrap press-scale"
              style={active ? {
                background: 'var(--cook)',
                color: 'var(--on-accent)',
                borderColor: 'var(--cook)',
              } : {
                borderColor: 'var(--hair)',
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Sort row */}
      <div className="px-5 mb-3 flex gap-1.5 flex-shrink-0">
        {SORT_OPTIONS.map(opt => {
          const active = sort === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full press-scale transition-colors"
              style={active ? {
                background: 'var(--cook-dim)',
                color: 'var(--cook)',
              } : {
                color: 'var(--text-3)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading && !data && <LoadingState />}
        {error && !data && (
          <div className="p-4 text-center text-tx-3 text-sm">{error}</div>
        )}

        {data && !isSearching && (
          <div className="flex flex-col gap-3">
            {/* Favourites section */}
            {favourites.length > 0 && (
              <Section title="Favourites" icon="★" iconColor="var(--star, #EAB308)">
                {favourites.map(r => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    isFavourite={localFavourites.has(r.id)}
                    onToggleFavourite={toggleFavourite}
                    onNavigate={() => navigate(`/cook/recipes/${r.id}`)}
                  />
                ))}
              </Section>
            )}

            {/* Recently cooked section */}
            {recentlyCooked.length > 0 && (
              <Section title="Recently cooked">
                {recentlyCooked.map(r => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    isFavourite={localFavourites.has(r.id)}
                    onToggleFavourite={toggleFavourite}
                    onNavigate={() => navigate(`/cook/recipes/${r.id}`)}
                  />
                ))}
              </Section>
            )}

            {/* All recipes section */}
            <Section title={`All recipes (${total})`}>
              {recipes.map(r => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  isFavourite={localFavourites.has(r.id)}
                  onToggleFavourite={toggleFavourite}
                  onNavigate={() => navigate(`/cook/recipes/${r.id}`)}
                />
              ))}
              {recipes.length === 0 && !loading && (
                <p className="text-[13px] text-tx-3 text-center py-6">No recipes match your filters</p>
              )}
            </Section>
          </div>
        )}

        {data && isSearching && (
          <div className="flex flex-col gap-2.5">
            {recipes.length > 0 ? recipes.map(r => (
              <RecipeCard
                key={r.id}
                recipe={r}
                isFavourite={localFavourites.has(r.id)}
                onToggleFavourite={toggleFavourite}
                onNavigate={() => navigate(`/cook/recipes/${r.id}`)}
              />
            )) : !loading && (
              <p className="text-[13px] text-tx-3 text-center py-10">No recipes found for "{debouncedQuery}"</p>
            )}
          </div>
        )}

        {/* Loading indicator for subsequent fetches */}
        {loading && data && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-hair rounded-full animate-spin" style={{ borderTopColor: 'var(--cook)' }} />
          </div>
        )}
      </div>

      {/* FAB — New recipe */}
      <button
        onClick={() => navigate('/cook/recipes/new')}
        className="fixed right-5 rounded-full w-[56px] h-[56px] flex items-center justify-center text-[24px] font-light press-scale shadow-lg"
        style={{
          bottom: 'calc(80px + env(safe-area-inset-bottom))',
          background: 'var(--cook)',
          color: 'var(--on-accent)',
          boxShadow: '0 6px 20px -4px color-mix(in oklab, var(--cook) 40%, transparent)',
        }}
        aria-label="New recipe"
      >
        +
      </button>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────
function Section({ title, icon, iconColor, children }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-2.5 px-1">
        {icon && (
          <span className="text-[15px]" style={{ color: iconColor }}>{icon}</span>
        )}
        <h2 className="text-[15px] font-bold text-tx">{title}</h2>
      </div>
      <div className="flex flex-col gap-2.5">
        {children}
      </div>
    </div>
  );
}

// ─── Recipe Card ────────────────────────────────────────────
function RecipeCard({ recipe: r, isFavourite, onToggleFavourite, onNavigate }) {
  const ps = r.per_serving || {};
  const proteinDensity = ps.calories > 0
    ? ((ps.protein_g / ps.calories) * 100).toFixed(1)
    : null;
  const timeDisplay = r.total_time_min ? `${r.total_time_min} min` : null;
  const tags = (r.tags || []).slice(0, 3);

  return (
    <button
      onClick={onNavigate}
      className="bg-card border border-hair rounded-[20px] p-3.5 w-full text-left press-scale"
    >
      {/* Top row */}
      <div className="flex items-start gap-2.5">
        {r.icon && <span className="text-2xl flex-shrink-0 mt-0.5">{r.icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[14.5px] text-tx truncate">{r.title}</span>
            <SourceBadge source={r.source} />
          </div>
        </div>
        <button
          onClick={(e) => onToggleFavourite(e, r.id)}
          className="w-9 h-9 flex items-center justify-center flex-shrink-0 press-scale rounded-full"
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <span
            className="text-[18px]"
            style={{ color: isFavourite ? 'var(--star, #EAB308)' : 'var(--text-3)', opacity: isFavourite ? 1 : 0.5 }}
          >
            {isFavourite ? '★' : '☆'}
          </span>
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {timeDisplay && (
          <span className="text-[12.5px] font-medium text-tx-3 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {timeDisplay}
          </span>
        )}
        {ps.calories != null && (
          <span className="text-[12.5px] font-semibold font-num" style={{ color: 'var(--cal)' }}>
            {Math.round(ps.calories)} kcal
          </span>
        )}
        {ps.protein_g != null && (
          <span className="text-[12.5px] font-semibold font-num" style={{ color: 'var(--protein)' }}>
            {Math.round(ps.protein_g)}g protein
          </span>
        )}
        {proteinDensity && (
          <span className="text-[12.5px] font-semibold font-num text-tx-2">
            {proteinDensity}g / 100 kcal
          </span>
        )}
      </div>

      {/* Tags row */}
      {tags.length > 0 && (
        <div className="flex gap-1.5 mt-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-card-2 text-tx-3"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Source badge ────────────────────────────────────────────
function SourceBadge({ source }) {
  if (source === 'yours') {
    return (
      <span
        className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
        style={{
          background: 'var(--cook-dim)',
          color: 'var(--cook)',
        }}
      >
        Yours
      </span>
    );
  }
  if (source === 'new') {
    return (
      <span
        className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
        style={{
          background: 'color-mix(in oklab, var(--protein) 12%, transparent)',
          color: 'var(--protein)',
        }}
      >
        New to try
      </span>
    );
  }
  return null;
}

// ─── Loading state ──────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex justify-center items-center h-40">
      <div className="w-7 h-7 border-2 border-hair rounded-full animate-spin" style={{ borderTopColor: 'var(--cook)' }} />
    </div>
  );
}
