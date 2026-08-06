import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Sheet from '../components/Sheet';
import {
  LayoutDashboard, ReceiptText, CreditCard, TrendingUp, CalendarRange,
  Plus, Upload, Sparkles, CircleSlash, ShoppingCart, UtensilsCrossed,
  Plane, Fuel, ShoppingBag, Zap, Clapperboard, HeartPulse, Home,
  CircleEllipsis, Smartphone, Banknote, FileText, Coins, Target,
  CircleCheck, ArrowDownToLine,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────
function formatINR(n) {
  if (n == null) return '\u20B90';
  const abs = Math.round(Math.abs(n));
  const sign = n < 0 ? '-' : '';
  const s = abs.toString();
  if (s.length <= 3) return `${sign}\u20B9${s}`;
  return `${sign}\u20B9${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${s.slice(-3)}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function monthStr(d) {
  const dt = d || new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

const CAT_ICONS = {
  'shopping-cart': ShoppingCart,
  'utensils-crossed': UtensilsCrossed,
  'plane': Plane,
  'fuel': Fuel,
  'shopping-bag': ShoppingBag,
  'zap': Zap,
  'clapperboard': Clapperboard,
  'heart-pulse': HeartPulse,
  'home': Home,
  'circle-ellipsis': CircleEllipsis,
};

const PAY_ICONS = { credit_card: CreditCard, upi: Smartphone, cash: Banknote };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function CatIcon({ icon, size = 16 }) {
  const Comp = CAT_ICONS[icon];
  if (!Comp) return <CircleEllipsis size={size} />;
  return <Comp size={size} />;
}

function PayIcon({ kind, size = 14 }) {
  const Comp = PAY_ICONS[kind];
  if (!Comp) return <Banknote size={size} />;
  return <Comp size={size} />;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const todayS = todayStr();
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yestS = yest.toISOString().split('T')[0];

  const dayAbbr = DAY_NAMES[d.getDay()].slice(0, 3);
  const monthAbbr = MONTH_NAMES[d.getMonth()].slice(0, 3);
  const label = `${dayAbbr}, ${monthAbbr} ${d.getDate()}`;

  if (dateStr === todayS) return `Today \u00B7 ${monthAbbr} ${d.getDate()}`;
  if (dateStr === yestS) return `Yesterday \u00B7 ${monthAbbr} ${d.getDate()}`;
  return label;
}

// ─── Main component ────────────────────────────────────────
export default function Finance({ onOpenSidebar }) {
  const [tab, setTab] = useState(() => localStorage.getItem('fin_tab') || 'home');
  const [homeData, setHomeData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sheets
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [cardDetail, setCardDetail] = useState(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [showGoalSheet, setShowGoalSheet] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { localStorage.setItem('fin_tab', tab); }, [tab]);

  const loadHome = useCallback(async () => {
    try {
      const [h, cats, pms, s] = await Promise.all([
        api.getFinanceHome(),
        api.getFinCategories(),
        api.getPaymentMethods(),
        api.getFinSettings(),
      ]);
      setHomeData(h);
      setCategories(cats.categories || cats);
      setPaymentMethods(pms.methods || pms);
      setSettings(s);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHome(); }, [loadHome]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const monthName = MONTH_NAMES[now.getMonth()];
  const dateStr = `${dayName}, ${monthName.slice(0, 3)} ${now.getDate()}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 flex-shrink-0">
        <button
          onClick={onOpenSidebar}
          className="w-[38px] h-[38px] rounded-full border border-hair bg-card flex items-center justify-center press-scale"
          style={{ color: 'var(--fin)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <div className="text-[18px] font-bold text-tx" style={{ fontFamily: "'Space Grotesk', system-ui" }}>Finance</div>
          <div className="text-[12px] text-tx-3 -mt-0.5">{dateStr}</div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <LoadingState />
        ) : (
          <>
            {tab === 'home' && (
              <HomeTab
                data={homeData}
                categories={categories}
                onReload={loadHome}
                showToast={showToast}
                onAddExpense={() => setShowAddExpense(true)}
              />
            )}
            {tab === 'spend' && (
              <SpendTab
                categories={categories}
                paymentMethods={paymentMethods}
                onReload={loadHome}
                showToast={showToast}
                onAddExpense={() => setShowAddExpense(true)}
                onImport={() => setShowImport(true)}
              />
            )}
            {tab === 'cards' && (
              <CardsTab
                paymentMethods={paymentMethods}
                categories={categories}
                onDetail={setCardDetail}
                onLedger={() => setShowLedger(true)}
                showToast={showToast}
              />
            )}
            {tab === 'invest' && (
              <InvestTab
                settings={settings}
                onAdd={() => setShowAddInvestment(true)}
                onReload={loadHome}
              />
            )}
            {tab === 'plan' && (
              <PlanTab
                settings={settings}
                categories={categories}
                onReload={loadHome}
                showToast={showToast}
                onGoal={() => setShowGoalSheet(true)}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <FinanceNav tab={tab} setTab={setTab} />

      {/* Sheets */}
      {showAddExpense && (
        <AddExpenseSheet
          categories={categories}
          paymentMethods={paymentMethods}
          onClose={() => setShowAddExpense(false)}
          onSave={() => { setShowAddExpense(false); loadHome(); showToast('Transaction saved'); }}
        />
      )}
      {showImport && (
        <ImportSheet
          paymentMethods={paymentMethods}
          categories={categories}
          onClose={() => { setShowImport(false); loadHome(); }}
          showToast={showToast}
        />
      )}
      {cardDetail && (
        <CardDetailSheet
          card={cardDetail}
          onClose={() => setCardDetail(null)}
          showToast={showToast}
          onReload={loadHome}
        />
      )}
      {showLedger && <PointsLedgerSheet onClose={() => setShowLedger(false)} />}
      {showAddInvestment && (
        <AddInvestmentSheet
          onClose={() => setShowAddInvestment(false)}
          onSave={() => { setShowAddInvestment(false); loadHome(); showToast('Investment logged'); }}
        />
      )}
      {showGoalSheet && (
        <GoalSheet
          onClose={() => setShowGoalSheet(false)}
          onSave={() => { setShowGoalSheet(false); loadHome(); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-card border border-hair text-[13px] font-semibold text-tx shadow-lg"
          style={{ animation: 'popin .3s var(--ease-out-quint)' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── FinanceNav ─────────────────────────────────────────────
const FIN_TABS = [
  { id: 'home', label: 'Home', Icon: LayoutDashboard },
  { id: 'spend', label: 'Spend', Icon: ReceiptText },
  { id: 'cards', label: 'Cards', Icon: CreditCard },
  { id: 'invest', label: 'Invest', Icon: TrendingUp },
  { id: 'plan', label: 'Plan', Icon: CalendarRange },
];

function FinanceNav({ tab, setTab }) {
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
        {FIN_TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center pt-2 pb-1 gap-0.5 transition-colors press-scale ${active ? 'text-tx' : 'text-tx-3'}`}
            >
              <div
                className="w-1 h-1 rounded-full mb-0.5 transition-colors"
                style={{ backgroundColor: active ? 'var(--fin)' : 'transparent' }}
              />
              <Icon size={20} strokeWidth={1.8} />
              <span className="text-[11px]">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── LoadingState ───────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-7 h-7 border-2 border-hair rounded-full animate-spin" style={{ borderTopColor: 'var(--fin)' }} />
    </div>
  );
}

// ─── HomeTab ────────────────────────────────────────────────
function HomeTab({ data, categories, onReload, showToast, onAddExpense }) {
  if (!data) return <EmptyState msg="No finance data yet" />;

  const safeToSpend = data.safe_to_spend ?? 0;
  const monthlyBudget = data.monthly_budget ?? 0;
  const safeTomorrow = data.safe_tomorrow ?? safeToSpend;
  const spendToday = data.spend_today ?? 0;
  const spendMtd = data.spend_mtd ?? 0;
  const leftInBudget = monthlyBudget - spendMtd;
  const isNoSpend = !!data.is_no_spend;
  const catSnap = data.category_snapshot || [];
  const recentTxns = data.recent_transactions || [];

  // Ring calculations
  const radius = 92;
  const strokeW = 10;
  const circumference = 2 * Math.PI * radius;
  const pct = monthlyBudget > 0 ? Math.min(1, Math.max(0, safeToSpend / monthlyBudget)) : 0;
  const dashOffset = circumference * (1 - pct);

  async function handleNoSpendToggle() {
    try {
      await api.toggleNoSpend(todayStr());
      onReload();
      showToast(isNoSpend ? 'No-spend day unmarked' : '+5 pts \u00B7 no-spend day');
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-3 stagger-enter">
      {/* Safe-to-spend ring */}
      <div className="bg-card rounded-[20px] p-5 flex flex-col items-center">
        <svg width={radius * 2 + strokeW + 4} height={radius * 2 + strokeW + 4} className="mb-2">
          <circle
            cx={radius + strokeW / 2 + 2}
            cy={radius + strokeW / 2 + 2}
            r={radius}
            fill="none"
            stroke="var(--hair)"
            strokeWidth={strokeW}
          />
          <circle
            cx={radius + strokeW / 2 + 2}
            cy={radius + strokeW / 2 + 2}
            r={radius}
            fill="none"
            stroke="var(--fin)"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${radius + strokeW / 2 + 2} ${radius + strokeW / 2 + 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          <text
            x={radius + strokeW / 2 + 2}
            y={radius + strokeW / 2 - 2}
            textAnchor="middle"
            className="font-num"
            style={{ fill: 'var(--text)', fontSize: '28px', fontWeight: 700, fontFamily: "'Space Grotesk', system-ui" }}
          >
            {formatINR(safeToSpend)}
          </text>
          <text
            x={radius + strokeW / 2 + 2}
            y={radius + strokeW / 2 + 22}
            textAnchor="middle"
            style={{ fill: 'var(--text-3)', fontSize: '12px' }}
          >
            safe to spend
          </text>
        </svg>
        <p className="text-[12px] text-tx-3 mt-1">of {formatINR(monthlyBudget)} budget</p>
        {safeTomorrow >= safeToSpend ? (
          <p className="text-[12px] mt-1" style={{ color: 'var(--points)' }}>
            &#9650; Tomorrow {formatINR(safeTomorrow)} — you're under today's allowance
          </p>
        ) : (
          <p className="text-[12px] text-tx-3 mt-1">Tomorrow {formatINR(safeTomorrow)}</p>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Spent today', val: spendToday },
          { label: 'Left in budget', val: leftInBudget },
          { label: 'Budget', val: monthlyBudget },
        ].map(({ label, val }) => (
          <div key={label} className="bg-card rounded-[20px] p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3">{label}</p>
            <p className="text-[16px] font-bold font-num text-tx mt-1">{formatINR(val)}</p>
          </div>
        ))}
      </div>

      {/* No-spend day toggle */}
      <button
        onClick={handleNoSpendToggle}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[20px] press-scale text-[13px] font-semibold"
        style={{
          border: isNoSpend
            ? '1.5px solid color-mix(in oklab, var(--fin) 60%, transparent)'
            : '1.5px solid var(--hair)',
          background: isNoSpend
            ? 'color-mix(in oklab, var(--fin) 14%, transparent)'
            : 'var(--card)',
          color: isNoSpend ? 'var(--fin)' : 'var(--text-2)',
        }}
      >
        <CircleSlash size={16} />
        {isNoSpend ? 'No-spend day active' : 'Mark as no-spend day'}
      </button>

      {/* Category snapshot */}
      {catSnap.length > 0 && (
        <div className="bg-card rounded-[20px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">Categories this month</p>
          <div className="space-y-3">
            {catSnap.slice(0, 5).map((cat) => {
              const budget = cat.budget || 1;
              const spent = cat.spent || 0;
              const pctSpent = Math.min(100, Math.round((spent / budget) * 100));
              const colorVar = cat.color_token || '--oth';
              return (
                <div key={cat.id || cat.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in oklab, var(${colorVar}) 18%, transparent)`, color: `var(${colorVar})` }}
                  >
                    <CatIcon icon={cat.icon} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-tx truncate">{cat.name}</span>
                      <span className="text-[12px] font-num text-tx-2 flex-shrink-0 ml-2">{formatINR(spent)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-card-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pctSpent}%`, background: `var(${colorVar})` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      {recentTxns.length > 0 && (
        <div className="bg-card rounded-[20px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">Recent transactions</p>
          <div className="space-y-2.5">
            {recentTxns.slice(0, 5).map((tx, i) => {
              const colorVar = tx.color_token || '--oth';
              const isIncome = tx.type === 'income';
              return (
                <div key={tx.id || i} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `var(${colorVar})` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-tx truncate">{tx.merchant || tx.note || tx.category_name || 'Transaction'}</p>
                    {tx.payment_method_name && (
                      <p className="text-[11px] text-tx-3">{tx.payment_method_name}</p>
                    )}
                  </div>
                  <span className={`text-[14px] font-num font-semibold flex-shrink-0 ${isIncome ? 'text-points' : 'text-tx'}`}>
                    {isIncome ? '+' : ''}{formatINR(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add expense button */}
      <button
        onClick={onAddExpense}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-[20px] press-scale text-[14px] font-bold text-white"
        style={{ background: 'var(--fin)' }}
      >
        <Plus size={18} />
        Add expense
      </button>
    </div>
  );
}

// ─── SpendTab ───────────────────────────────────────────────
function SpendTab({ categories, paymentMethods, onReload, showToast, onAddExpense, onImport }) {
  const [transactions, setTransactions] = useState([]);
  const [filterCat, setFilterCat] = useState('all');
  const [filterPM, setFilterPM] = useState('all');
  const [search, setSearch] = useState('');
  const [editBudgets, setEditBudgets] = useState(false);
  const [budgetEdits, setBudgetEdits] = useState({});
  const [txLoading, setTxLoading] = useState(true);

  const loadTx = useCallback(async () => {
    try {
      setTxLoading(true);
      const res = await api.getTransactions({ month: monthStr() });
      setTransactions(res.transactions || res || []);
    } catch {
      // silent
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => { loadTx(); }, [loadTx]);

  // Filter transactions
  let filtered = transactions;
  if (filterCat !== 'all') {
    filtered = filtered.filter(tx => tx.category_id === filterCat || tx.category_name === filterCat);
  }
  if (filterPM !== 'all') {
    filtered = filtered.filter(tx => tx.payment_method_id === filterPM || tx.payment_method_name === filterPM);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(tx =>
      (tx.merchant || '').toLowerCase().includes(q) ||
      (tx.note || '').toLowerCase().includes(q)
    );
  }

  // Group by date
  const groups = {};
  filtered.forEach(tx => {
    const d = (tx.date || '').slice(0, 10);
    if (!groups[d]) groups[d] = [];
    groups[d].push(tx);
  });
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  async function handleBudgetSave(catId, newBudget) {
    try {
      await api.updateCategoryBudget(catId, newBudget);
      onReload();
      showToast('Budget updated');
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-3 stagger-enter">
      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={onAddExpense} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[20px] press-scale text-[13px] font-bold text-white" style={{ background: 'var(--fin)' }}>
          <Plus size={16} /> Add
        </button>
        <button onClick={onImport} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-[20px] border border-hair bg-card press-scale text-[13px] font-semibold text-tx-2">
          <Upload size={16} /> Import
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setFilterCat('all')}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold press-scale"
          style={{
            border: filterCat === 'all' ? '1.5px solid color-mix(in oklab, var(--fin) 60%, transparent)' : '1.5px solid var(--hair)',
            background: filterCat === 'all' ? 'color-mix(in oklab, var(--fin) 14%, transparent)' : 'var(--card)',
            color: filterCat === 'all' ? 'var(--fin)' : 'var(--text-2)',
          }}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.id || cat.name}
            onClick={() => setFilterCat(filterCat === (cat.id || cat.name) ? 'all' : (cat.id || cat.name))}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold press-scale whitespace-nowrap"
            style={{
              border: filterCat === (cat.id || cat.name)
                ? `1.5px solid color-mix(in oklab, var(${cat.color_token || '--oth'}) 60%, transparent)`
                : '1.5px solid var(--hair)',
              background: filterCat === (cat.id || cat.name)
                ? `color-mix(in oklab, var(${cat.color_token || '--oth'}) 14%, transparent)`
                : 'var(--card)',
              color: filterCat === (cat.id || cat.name) ? `var(${cat.color_token || '--oth'})` : 'var(--text-2)',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Payment method chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setFilterPM('all')}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold press-scale"
          style={{
            border: filterPM === 'all' ? '1.5px solid color-mix(in oklab, var(--fin) 60%, transparent)' : '1.5px solid var(--hair)',
            background: filterPM === 'all' ? 'color-mix(in oklab, var(--fin) 14%, transparent)' : 'var(--card)',
            color: filterPM === 'all' ? 'var(--fin)' : 'var(--text-2)',
          }}
        >
          All cards
        </button>
        {paymentMethods.map(pm => (
          <button
            key={pm.id || pm.name}
            onClick={() => setFilterPM(filterPM === (pm.id || pm.name) ? 'all' : (pm.id || pm.name))}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold press-scale whitespace-nowrap"
            style={{
              border: filterPM === (pm.id || pm.name) ? '1.5px solid color-mix(in oklab, var(--fin) 60%, transparent)' : '1.5px solid var(--hair)',
              background: filterPM === (pm.id || pm.name) ? 'color-mix(in oklab, var(--fin) 14%, transparent)' : 'var(--card)',
              color: filterPM === (pm.id || pm.name) ? 'var(--fin)' : 'var(--text-2)',
            }}
          >
            {pm.short_name || pm.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search merchant or note..."
        className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card text-[13px] text-tx placeholder:text-tx-3 outline-none"
      />

      {/* Transaction list */}
      {txLoading ? (
        <LoadingState />
      ) : sortedDates.length === 0 ? (
        <EmptyState msg="No transactions this month" />
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => {
            const dayTxns = groups[date];
            const dayTotal = dayTxns.reduce((s, tx) => s + (tx.type === 'income' ? 0 : (tx.amount || 0)), 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold text-tx-3">{formatDateLabel(date)}</p>
                  <p className="text-[12px] font-num text-tx-3">{formatINR(dayTotal)}</p>
                </div>
                <div className="bg-card rounded-[20px] overflow-hidden divide-y divide-hair">
                  {dayTxns.map((tx, i) => {
                    const colorVar = tx.color_token || '--oth';
                    const isIncome = tx.type === 'income';
                    return (
                      <div key={tx.id || i} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `var(${colorVar})` }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-tx truncate">{tx.merchant || tx.note || tx.category_name || 'Transaction'}</p>
                          {tx.payment_method_name && (
                            <p className="text-[11px] text-tx-3">{tx.payment_method_name}</p>
                          )}
                        </div>
                        <span className={`text-[14px] font-num font-semibold flex-shrink-0 ${isIncome ? 'text-points' : 'text-tx'}`}>
                          {isIncome ? '+' : ''}{formatINR(tx.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget section */}
      <div className="bg-card rounded-[20px] p-4 mt-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3">Budgets</p>
          <button
            onClick={() => setEditBudgets(!editBudgets)}
            className="text-[12px] font-semibold press-scale"
            style={{ color: 'var(--fin)' }}
          >
            {editBudgets ? 'Done' : 'Edit'}
          </button>
        </div>
        <div className="space-y-3">
          {categories.map(cat => {
            const budget = budgetEdits[cat.id] ?? cat.monthly_budget ?? 0;
            const spent = cat.spent_this_month ?? 0;
            const pctSpent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            const overBudget = spent > budget && budget > 0;
            const colorVar = cat.color_token || '--oth';
            const barColor = overBudget
              ? `color-mix(in oklab, var(${colorVar}) 55%, var(--text-3))`
              : `var(${colorVar})`;

            return (
              <div key={cat.id || cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] text-tx">{cat.name}</span>
                  <span className="text-[12px] font-num text-tx-2">{formatINR(spent)} of {formatINR(budget)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-card-2 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pctSpent)}%`, background: barColor }}
                  />
                </div>
                {overBudget && (
                  <p className="text-[11px] text-tx-3">
                    {formatINR(spent - budget)} past plan — no penalty, next month resets it
                  </p>
                )}
                {editBudgets && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => {
                        const nb = Math.max(0, budget - 1000);
                        setBudgetEdits(p => ({ ...p, [cat.id]: nb }));
                      }}
                      className="w-8 h-8 rounded-full border border-hair flex items-center justify-center text-tx-2 press-scale text-[16px] font-bold"
                    >
                      -
                    </button>
                    <span className="text-[13px] font-num text-tx w-20 text-center">{formatINR(budget)}</span>
                    <button
                      onClick={() => {
                        const nb = budget + 1000;
                        setBudgetEdits(p => ({ ...p, [cat.id]: nb }));
                      }}
                      className="w-8 h-8 rounded-full border border-hair flex items-center justify-center text-tx-2 press-scale text-[16px] font-bold"
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleBudgetSave(cat.id, budget)}
                      className="ml-auto text-[12px] font-semibold px-3 py-1 rounded-full press-scale"
                      style={{ background: 'color-mix(in oklab, var(--fin) 14%, transparent)', color: 'var(--fin)' }}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={onAddExpense}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg press-scale z-30"
        style={{ background: 'var(--fin)' }}
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}

// ─── CardsTab ───────────────────────────────────────────────
function CardsTab({ paymentMethods, categories, onDetail, onLedger, showToast }) {
  const [suggestion, setSuggestion] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const b = await api.getCardBills();
        setBills(b.bills || b || []);
      } catch { /* silent */ } finally {
        setBillsLoading(false);
      }
    })();
  }, []);

  async function handleSuggest(catName) {
    try {
      setSuggestLoading(true);
      const res = await api.suggestCard(catName);
      setSuggestion(res);
    } catch { /* silent */ } finally {
      setSuggestLoading(false);
    }
  }

  async function handlePayBill(billId) {
    try {
      await api.payCardBill(billId, { paid: true });
      const b = await api.getCardBills();
      setBills(b.bills || b || []);
      showToast('Bill marked paid');
    } catch { /* silent */ }
  }

  const creditCards = paymentMethods.filter(pm => pm.kind === 'credit_card');

  return (
    <div className="space-y-3 stagger-enter">
      {/* At Checkout Suggester */}
      <div className="bg-card rounded-[20px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--fin-tx)' }}>AT CHECKOUT</p>
        <p className="text-[13px] text-tx-2 mb-3">Which card should I use?</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
          {categories.map(cat => (
            <button
              key={cat.id || cat.name}
              onClick={() => handleSuggest(cat.name)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full border border-hair bg-card text-[12px] text-tx-2 press-scale whitespace-nowrap"
            >
              {cat.name}
            </button>
          ))}
        </div>
        {suggestLoading && (
          <div className="flex items-center gap-2 mt-3 text-[12px] text-tx-3">
            <Sparkles size={14} style={{ color: 'var(--fin)' }} /> Thinking...
          </div>
        )}
        {suggestion && !suggestLoading && (
          <div className="mt-3 p-3 rounded-[14px] border border-hair">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={16} style={{ color: 'var(--fin)' }} />
              <span className="text-[14px] font-semibold text-tx">{suggestion.card_name || suggestion.name}</span>
            </div>
            {suggestion.multiplier_text && (
              <p className="text-[12px] font-semibold" style={{ color: 'var(--fin)' }}>{suggestion.multiplier_text}</p>
            )}
            {suggestion.note && <p className="text-[11px] text-tx-3 mt-0.5">{suggestion.note}</p>}
            {suggestion.backup && (
              <div className="mt-2 pt-2 border-t border-hair">
                <p className="text-[11px] text-tx-3">Backup: <span className="text-tx-2 font-semibold">{suggestion.backup.card_name || suggestion.backup.name}</span></p>
                {suggestion.backup.multiplier_text && (
                  <p className="text-[11px]" style={{ color: 'var(--fin)' }}>{suggestion.backup.multiplier_text}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card list */}
      {creditCards.length > 0 && (
        <div className="bg-card rounded-[20px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">Your cards</p>
          <div className="space-y-2">
            {creditCards.map(card => (
              <button
                key={card.id || card.name}
                onClick={() => onDetail(card)}
                className="w-full flex items-center gap-3 p-3 rounded-[14px] border border-hair press-scale text-left"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: card.color_var ? `var(${card.color_var})` : 'var(--fin)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-tx truncate">{card.name}</p>
                  {card.month_spend != null && (
                    <p className="text-[12px] font-num text-tx-3">This month: {formatINR(card.month_spend)}</p>
                  )}
                </div>
                <svg className="w-4 h-4 text-tx-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Points ledger link */}
      <button
        onClick={onLedger}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-[20px] border border-hair bg-card press-scale text-[13px] font-semibold text-tx-2"
      >
        <Coins size={16} style={{ color: 'var(--fin)' }} />
        Points ledger
      </button>

      {/* Bills coming up */}
      <div className="bg-card rounded-[20px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">Bills coming up</p>
        {billsLoading ? (
          <LoadingState />
        ) : bills.length === 0 ? (
          <p className="text-[13px] text-tx-3">No upcoming bills</p>
        ) : (
          <div className="space-y-2.5">
            {bills.map((bill, i) => (
              <div key={bill.id || i} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-tx truncate">{bill.card_name || bill.name}</p>
                  <p className="text-[11px] text-tx-3">
                    {bill.cycle_label && `${bill.cycle_label} \u00B7 `}
                    {bill.due_date ? `Due ${bill.due_date}` : ''}
                  </p>
                </div>
                <span className="text-[14px] font-num font-semibold text-tx flex-shrink-0">{formatINR(bill.amount)}</span>
                {!bill.paid && (
                  <button
                    onClick={() => handlePayBill(bill.id)}
                    className="text-[11px] px-2.5 py-1 rounded-full press-scale font-semibold"
                    style={{ background: 'color-mix(in oklab, var(--fin) 14%, transparent)', color: 'var(--fin)' }}
                  >
                    Pay
                  </button>
                )}
                {bill.paid && (
                  <CircleCheck size={18} style={{ color: 'var(--points)' }} className="flex-shrink-0" />
                )}
              </div>
            ))}
            <div className="pt-2 border-t border-hair flex items-center justify-between">
              <span className="text-[12px] font-semibold text-tx-3">Total</span>
              <span className="text-[14px] font-num font-bold text-tx">
                {formatINR(bills.reduce((s, b) => s + (b.amount || 0), 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── InvestTab ──────────────────────────────────────────────
function InvestTab({ settings, onAdd, onReload }) {
  const [summary, setSummary] = useState(null);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, inv] = await Promise.all([
          api.getInvestmentSummary(),
          api.getInvestments(),
        ]);
        setSummary(s);
        setInvestments(inv.investments || inv || []);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingState />;

  const monthlyTarget = settings?.monthly_investment_target || summary?.monthly_target || 0;
  const monthlyInvested = summary?.monthly_invested || 0;
  const investPct = monthlyTarget > 0 ? Math.min(100, Math.round((monthlyInvested / monthlyTarget) * 100)) : 0;

  const typeBreakdown = summary?.by_type || [];
  const sipTemplates = summary?.sip_templates || [];

  return (
    <div className="space-y-3 stagger-enter">
      {/* Monthly progress */}
      <div className="bg-card rounded-[20px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">Monthly progress</p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[14px] font-num font-semibold text-tx">{formatINR(monthlyInvested)}</span>
          <span className="text-[12px] text-tx-3">of {formatINR(monthlyTarget)} \u00B7 {investPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-card-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${investPct}%`, background: 'var(--fin)' }}
          />
        </div>
      </div>

      {/* By-type breakdown */}
      {typeBreakdown.length > 0 && (
        <div className="bg-card rounded-[20px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">By type</p>
          <div className="space-y-3">
            {typeBreakdown.map((t, i) => {
              const total = typeBreakdown.reduce((s, x) => s + (x.total || x.amount || 0), 0) || 1;
              const pct = Math.round(((t.total || t.amount || 0) / total) * 100);
              return (
                <div key={t.type || i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-tx">{t.type || t.name}</span>
                    <span className="text-[12px] font-num text-tx-2">{formatINR(t.total || t.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-card-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--fin)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Investment list */}
      <div className="bg-card rounded-[20px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">Recent investments</p>
        {investments.length === 0 ? (
          <p className="text-[13px] text-tx-3">No investments logged yet</p>
        ) : (
          <div className="space-y-2.5">
            {investments.slice(0, 10).map((inv, i) => (
              <div key={inv.id || i} className="flex items-center gap-3">
                <div
                  className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase flex-shrink-0"
                  style={{ background: 'color-mix(in oklab, var(--fin) 14%, transparent)', color: 'var(--fin)' }}
                >
                  {inv.type || 'MF'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-tx truncate">{inv.instrument_name || inv.name}</p>
                  <p className="text-[11px] text-tx-3">{inv.date}</p>
                </div>
                <span className="text-[14px] font-num font-semibold text-tx flex-shrink-0">{formatINR(inv.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SIP templates */}
      {sipTemplates.length > 0 && (
        <div className="bg-card rounded-[20px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">SIP templates</p>
          <div className="space-y-2">
            {sipTemplates.map((sip, i) => (
              <div key={sip.id || i} className="flex items-center gap-3 p-3 rounded-[14px] border border-hair">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-tx truncate">{sip.instrument_name || sip.name}</p>
                  <p className="text-[12px] font-num text-tx-3">{formatINR(sip.amount)}</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.addInvestment({ type: sip.type || 'SIP', instrument_name: sip.instrument_name || sip.name, amount: sip.amount, date: todayStr(), is_recurring: true });
                      onReload();
                    } catch { /* silent */ }
                  }}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full press-scale"
                  style={{ background: 'color-mix(in oklab, var(--fin) 14%, transparent)', color: 'var(--fin)' }}
                >
                  Log this month
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add investment button */}
      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-[20px] press-scale text-[14px] font-bold text-white"
        style={{ background: 'var(--fin)' }}
      >
        <Plus size={18} />
        Log investment
      </button>
    </div>
  );
}

// ─── PlanTab ────────────────────────────────────────────────
function PlanTab({ settings, categories, onReload, showToast, onGoal }) {
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [budgetEdits, setBudgetEdits] = useState({});
  const [showBudgetPlan, setShowBudgetPlan] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const g = await api.getFinGoals();
        setGoals(g.goals || g || []);
      } catch { /* silent */ } finally {
        setGoalsLoading(false);
      }
    })();
  }, []);

  const income = settings?.monthly_income || 0;
  const spent = settings?.monthly_spent || 0;
  const invested = settings?.monthly_invested || 0;
  const savingsRate = income > 0 ? Math.round(((income - spent) / income) * 100) : 0;
  const freeAfterBills = settings?.free_after_bills ?? (income - (settings?.queued_bills || 0) - (settings?.recurring_sips || 0));

  async function handleAddToGoal(goalId) {
    try {
      await api.addToGoal(goalId, 5000);
      const g = await api.getFinGoals();
      setGoals(g.goals || g || []);
      showToast('+\u20B95,000 added to goal');
    } catch { /* silent */ }
  }

  async function handleBudgetSave(catId, newBudget) {
    try {
      await api.updateCategoryBudget(catId, newBudget);
      onReload();
      showToast('Budget updated');
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-3 stagger-enter">
      {/* Month summary card */}
      <div className="bg-card rounded-[20px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">This month</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Income', val: income, color: 'var(--points)' },
            { label: 'Spent', val: spent, color: 'var(--cal)' },
            { label: 'Invested', val: invested, color: 'var(--fin)' },
            { label: 'Savings rate', val: null, display: `${savingsRate}%`, color: savingsRate >= 20 ? 'var(--points)' : 'var(--cal)' },
          ].map(({ label, val, display, color }) => (
            <div key={label} className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3">{label}</p>
              <p className="text-[18px] font-bold font-num mt-1" style={{ color }}>{display || formatINR(val)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cash flow */}
      <div className="bg-card rounded-[20px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-3">Cash flow</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-tx-2">Income</span>
            <span className="text-[14px] font-num font-semibold text-points">{formatINR(income)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-tx-2">Bills paid + spends</span>
            <span className="text-[14px] font-num font-semibold text-tx">{formatINR(spent)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-tx-2">Investments</span>
            <span className="text-[14px] font-num font-semibold text-tx">{formatINR(invested)}</span>
          </div>
          <div className="pt-2 border-t border-hair flex items-center justify-between">
            <span className="text-[13px] font-semibold text-tx">Free after bills & SIPs</span>
            <span className="text-[14px] font-num font-bold" style={{ color: 'var(--fin)' }}>
              {formatINR(freeAfterBills ?? (income - spent - invested))}
            </span>
          </div>
        </div>
      </div>

      {/* Goals */}
      <div className="bg-card rounded-[20px] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3">Goals</p>
          <button onClick={onGoal} className="press-scale" style={{ color: 'var(--fin)' }}>
            <Plus size={18} />
          </button>
        </div>
        {goalsLoading ? (
          <LoadingState />
        ) : goals.length === 0 ? (
          <p className="text-[13px] text-tx-3">No goals yet. Tap + to add one.</p>
        ) : (
          <div className="space-y-3">
            {goals.map((goal, i) => {
              const target = goal.target_amount || 1;
              const current = goal.current_amount || 0;
              const pct = Math.min(100, Math.round((current / target) * 100));
              return (
                <div key={goal.id || i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-semibold text-tx">{goal.name}</span>
                    <span className="text-[12px] font-num text-tx-2">{formatINR(current)} of {formatINR(target)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-card-2 overflow-hidden mb-1.5">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--fin)' }} />
                  </div>
                  <div className="flex items-center justify-between">
                    {goal.target_date && (
                      <span className="text-[11px] text-tx-3">Target: {goal.target_date}</span>
                    )}
                    {!goal.target_date && <span />}
                    <button
                      onClick={() => handleAddToGoal(goal.id)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full press-scale"
                      style={{ background: 'color-mix(in oklab, var(--fin) 14%, transparent)', color: 'var(--fin)' }}
                    >
                      +{formatINR(5000)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Next month budget planning */}
      <div className="bg-card rounded-[20px] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3">Next month budgets</p>
          <button
            onClick={() => setShowBudgetPlan(!showBudgetPlan)}
            className="text-[12px] font-semibold press-scale"
            style={{ color: 'var(--fin)' }}
          >
            {showBudgetPlan ? 'Hide' : 'Plan'}
          </button>
        </div>
        {showBudgetPlan && (
          <div className="space-y-3">
            {categories.map(cat => {
              const budget = budgetEdits[cat.id] ?? cat.monthly_budget ?? 0;
              const avg3mo = cat.avg_3_month ?? budget;
              return (
                <div key={cat.id || cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-tx">{cat.name}</span>
                    <span className="text-[11px] text-tx-3">3-mo avg: {formatINR(avg3mo)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const nb = Math.max(0, (budgetEdits[cat.id] ?? budget) - 1000);
                        setBudgetEdits(p => ({ ...p, [cat.id]: nb }));
                      }}
                      className="w-8 h-8 rounded-full border border-hair flex items-center justify-center text-tx-2 press-scale text-[16px] font-bold"
                    >
                      -
                    </button>
                    <span className="text-[13px] font-num text-tx w-20 text-center">{formatINR(budgetEdits[cat.id] ?? budget)}</span>
                    <button
                      onClick={() => {
                        const nb = (budgetEdits[cat.id] ?? budget) + 1000;
                        setBudgetEdits(p => ({ ...p, [cat.id]: nb }));
                      }}
                      className="w-8 h-8 rounded-full border border-hair flex items-center justify-center text-tx-2 press-scale text-[16px] font-bold"
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleBudgetSave(cat.id, budgetEdits[cat.id] ?? budget)}
                      className="ml-auto text-[12px] font-semibold px-3 py-1 rounded-full press-scale"
                      style={{ background: 'color-mix(in oklab, var(--fin) 14%, transparent)', color: 'var(--fin)' }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!showBudgetPlan && (
          <p className="text-[13px] text-tx-3">Tap Plan to set next month's category budgets</p>
        )}
      </div>
    </div>
  );
}

// ─── AddExpenseSheet ────────────────────────────────────────
function AddExpenseSheet({ categories, paymentMethods, onClose, onSave }) {
  const [amountStr, setAmountStr] = useState('');
  const [txType, setTxType] = useState('expense'); // expense | income
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedPM, setSelectedPM] = useState(null);
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const amount = parseFloat(amountStr) || 0;
  const canSave = amount > 0 && selectedCat && (txType === 'income' || selectedPM);

  // Sort categories by recency (use id as proxy, or just keep order)
  const sortedCats = [...categories];
  const sortedPMs = [...paymentMethods];

  function handleKey(key) {
    if (key === 'backspace') {
      setAmountStr(s => s.slice(0, -1));
    } else if (key === '.') {
      if (!amountStr.includes('.') && amountStr.length < 8) {
        setAmountStr(s => s + '.');
      }
    } else {
      if (amountStr.length < 8) {
        setAmountStr(s => s + key);
      }
    }
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await api.addTransaction({
        type: txType,
        amount,
        category_id: selectedCat.id || selectedCat,
        payment_method_id: txType === 'expense' ? (selectedPM.id || selectedPM) : undefined,
        merchant: merchant || undefined,
        note: note || undefined,
        date,
      });
      onSave();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Sheet open={true} onClose={onClose} height="full">
      <div className="px-5 pb-4 flex flex-col h-full">
        {/* Amount display */}
        <div className="text-center py-6">
          <p className="text-[42px] font-bold font-num text-tx" style={{ fontFamily: "'Space Grotesk', system-ui" }}>
            {amountStr ? formatINR(parseFloat(amountStr)) : '\u20B90'}
          </p>
        </div>

        {/* Expense/Income toggle */}
        <div className="flex gap-1 p-1 rounded-full bg-card-2 mb-4 self-center">
          {['expense', 'income'].map(t => (
            <button
              key={t}
              onClick={() => setTxType(t)}
              className="px-5 py-1.5 rounded-full text-[13px] font-semibold press-scale capitalize"
              style={{
                background: txType === t ? 'var(--card)' : 'transparent',
                color: txType === t ? 'var(--text)' : 'var(--text-3)',
                boxShadow: txType === t ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Category</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-3">
          {sortedCats.map(cat => {
            const active = selectedCat && (selectedCat.id === cat.id || selectedCat === cat.id);
            const colorVar = cat.color_token || '--oth';
            return (
              <button
                key={cat.id || cat.name}
                onClick={() => setSelectedCat(cat)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold press-scale whitespace-nowrap"
                style={{
                  border: active
                    ? `1.5px solid color-mix(in oklab, var(${colorVar}) 60%, transparent)`
                    : '1.5px solid var(--hair)',
                  background: active
                    ? `color-mix(in oklab, var(${colorVar}) 14%, transparent)`
                    : 'transparent',
                  color: active ? `var(${colorVar})` : 'var(--text-2)',
                }}
              >
                <CatIcon icon={cat.icon} size={14} />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Payment method chips (only for expense) */}
        {txType === 'expense' && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Payment method</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-3">
              {sortedPMs.map(pm => {
                const active = selectedPM && (selectedPM.id === pm.id || selectedPM === pm.id);
                return (
                  <button
                    key={pm.id || pm.name}
                    onClick={() => setSelectedPM(pm)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold press-scale whitespace-nowrap"
                    style={{
                      border: active
                        ? '1.5px solid color-mix(in oklab, var(--fin) 60%, transparent)'
                        : '1.5px solid var(--hair)',
                      background: active
                        ? 'color-mix(in oklab, var(--fin) 14%, transparent)'
                        : 'transparent',
                      color: active ? 'var(--fin)' : 'var(--text-2)',
                    }}
                  >
                    <PayIcon kind={pm.kind} size={14} />
                    {pm.short_name || pm.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Merchant + Note */}
        <input
          type="text"
          value={merchant}
          onChange={e => setMerchant(e.target.value)}
          placeholder="Merchant (optional)"
          className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx placeholder:text-tx-3 outline-none mb-2"
        />
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx placeholder:text-tx-3 outline-none mb-2"
        />

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx outline-none mb-4"
        />

        {/* Numeric keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1','2','3','4','5','6','7','8','9','.','0','backspace'].map(key => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="h-12 rounded-[14px] bg-card-2 flex items-center justify-center text-[20px] font-num font-semibold text-tx press-scale"
            >
              {key === 'backspace' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              ) : key}
            </button>
          ))}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-3.5 rounded-[16px] text-[15px] font-bold text-white press-scale"
          style={{
            background: canSave ? 'var(--fin)' : 'var(--hair)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Sheet>
  );
}

// ─── ImportSheet ────────────────────────────────────────────
function ImportSheet({ paymentMethods, categories, onClose, showToast }) {
  const [step, setStep] = useState(1);
  const [csvText, setCsvText] = useState('');
  const [selectedPM, setSelectedPM] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [colMap, setColMap] = useState({ date: 0, amount: 1, description: 2 });
  const [reviewRows, setReviewRows] = useState([]);
  const [importing, setImporting] = useState(false);

  function handleParse() {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    if (lines.length < 2) return;
    setHeaders(lines[0]);
    setParsedRows(lines.slice(1));
    // Auto-detect columns
    const h = lines[0].map(c => c.toLowerCase());
    const dateIdx = h.findIndex(c => c.includes('date'));
    const amtIdx = h.findIndex(c => c.includes('amount') || c.includes('debit') || c.includes('value'));
    const descIdx = h.findIndex(c => c.includes('desc') || c.includes('narration') || c.includes('merchant') || c.includes('particular'));
    setColMap({
      date: dateIdx >= 0 ? dateIdx : 0,
      amount: amtIdx >= 0 ? amtIdx : 1,
      description: descIdx >= 0 ? descIdx : 2,
    });
    setStep(2);
  }

  function handleMapDone() {
    const rows = parsedRows.map((row, i) => ({
      idx: i,
      date: row[colMap.date] || '',
      amount: parseFloat((row[colMap.amount] || '0').replace(/[^0-9.-]/g, '')) || 0,
      description: row[colMap.description] || '',
      status: 'new', // new | probable | matched
      category: null,
      skip: false,
    }));
    setReviewRows(rows);
    setStep(3);
  }

  function setRowCategory(idx, cat) {
    setReviewRows(prev => prev.map(r => r.idx === idx ? { ...r, category: cat } : r));
  }

  function toggleRowSkip(idx) {
    setReviewRows(prev => prev.map(r => r.idx === idx ? { ...r, skip: !r.skip } : r));
  }

  async function handleConfirm() {
    setImporting(true);
    try {
      const items = reviewRows
        .filter(r => !r.skip && r.amount > 0)
        .map(r => ({
          date: r.date,
          amount: r.amount,
          description: r.description,
          category_id: r.category?.id || null,
          payment_method_id: selectedPM?.id || null,
        }));
      await api.confirmImport({ transactions: items, payment_method_id: selectedPM?.id || null });
      showToast(`${items.length} transactions imported`);
      onClose();
    } catch {
      showToast('Import failed');
      setImporting(false);
    }
  }

  return (
    <Sheet open={true} onClose={onClose} title="Import Statement" height="full">
      <div className="px-5 pb-4">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Payment method</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
                {paymentMethods.map(pm => {
                  const active = selectedPM?.id === pm.id;
                  return (
                    <button
                      key={pm.id || pm.name}
                      onClick={() => setSelectedPM(pm)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold press-scale whitespace-nowrap"
                      style={{
                        border: active ? '1.5px solid color-mix(in oklab, var(--fin) 60%, transparent)' : '1.5px solid var(--hair)',
                        background: active ? 'color-mix(in oklab, var(--fin) 14%, transparent)' : 'transparent',
                        color: active ? 'var(--fin)' : 'var(--text-2)',
                      }}
                    >
                      {pm.short_name || pm.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Paste CSV</p>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="Paste your bank/card statement CSV here..."
                className="w-full h-48 px-4 py-3 rounded-[14px] border border-hair bg-card-2 text-[12px] text-tx placeholder:text-tx-3 outline-none resize-none font-mono"
              />
            </div>
            <button
              onClick={handleParse}
              disabled={!csvText.trim()}
              className="w-full py-3 rounded-[16px] text-[14px] font-bold text-white press-scale"
              style={{ background: csvText.trim() ? 'var(--fin)' : 'var(--hair)' }}
            >
              Parse
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-[13px] text-tx-2">Map columns from your CSV to the right fields.</p>
            {headers.length > 0 && (
              <div className="p-3 rounded-[14px] border border-hair bg-card-2 text-[11px] font-mono text-tx-3 overflow-x-auto">
                {headers.join(' | ')}
              </div>
            )}
            {['date', 'amount', 'description'].map(field => (
              <div key={field}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1 capitalize">{field}</p>
                <select
                  value={colMap[field]}
                  onChange={e => setColMap(p => ({ ...p, [field]: parseInt(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx outline-none"
                >
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
            {parsedRows.length > 0 && (
              <div className="p-3 rounded-[14px] border border-hair">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1">Sample row</p>
                <p className="text-[12px] text-tx">
                  {parsedRows[0][colMap.date]} &middot; {parsedRows[0][colMap.amount]} &middot; {parsedRows[0][colMap.description]}
                </p>
              </div>
            )}
            <button
              onClick={handleMapDone}
              className="w-full py-3 rounded-[16px] text-[14px] font-bold text-white press-scale"
              style={{ background: 'var(--fin)' }}
            >
              Review {parsedRows.length} rows
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-[13px] text-tx-2 mb-2">Review and categorize your transactions.</p>
            <div className="space-y-2">
              {reviewRows.map((row) => (
                <div
                  key={row.idx}
                  className="p-3 rounded-[14px] border border-hair"
                  style={{ opacity: row.skip ? 0.4 : 1 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-tx truncate flex-1 mr-2">{row.description}</span>
                    <span className="text-[14px] font-num font-semibold text-tx flex-shrink-0">{formatINR(row.amount)}</span>
                  </div>
                  <p className="text-[11px] text-tx-3 mb-2">{row.date}</p>
                  {row.status === 'probable' && (
                    <p className="text-[11px] text-cal font-semibold mb-1">Possible duplicate</p>
                  )}
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
                    {categories.map(cat => {
                      const active = row.category?.id === cat.id;
                      return (
                        <button
                          key={cat.id || cat.name}
                          onClick={() => setRowCategory(row.idx, cat)}
                          className="flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold press-scale whitespace-nowrap"
                          style={{
                            border: active
                              ? `1px solid var(${cat.color_token || '--oth'})`
                              : '1px solid var(--hair)',
                            background: active
                              ? `color-mix(in oklab, var(${cat.color_token || '--oth'}) 14%, transparent)`
                              : 'transparent',
                            color: active ? `var(${cat.color_token || '--oth'})` : 'var(--text-3)',
                          }}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => toggleRowSkip(row.idx)}
                    className="text-[11px] text-tx-3 mt-1.5 press-scale"
                  >
                    {row.skip ? 'Include' : 'Skip'}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleConfirm}
              disabled={importing}
              className="w-full py-3 rounded-[16px] text-[14px] font-bold text-white press-scale"
              style={{ background: importing ? 'var(--hair)' : 'var(--fin)', opacity: importing ? 0.6 : 1 }}
            >
              {importing ? 'Importing...' : `Confirm ${reviewRows.filter(r => !r.skip).length} transactions`}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ─── CardDetailSheet ────────────────────────────────────────
function CardDetailSheet({ card, onClose, showToast, onReload }) {
  const [rules, setRules] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, tx] = await Promise.all([
          api.getCardRules(),
          api.getTransactions({ payment_method_id: card.id, limit: 10 }),
        ]);
        const cardRules = (r.rules || r || []).filter(rule => rule.payment_method_id === card.id || rule.card_id === card.id);
        setRules(cardRules);
        setTransactions(tx.transactions || tx || []);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    })();
  }, [card.id]);

  async function handleRuleSave(rule) {
    try {
      await api.updateCardRule(rule.id, rule);
      showToast('Rule updated');
    } catch { /* silent */ }
  }

  return (
    <Sheet open={true} onClose={onClose} title={card.name} height="tall">
      <div className="px-5 pb-4">
        {loading ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            {/* Card header */}
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ background: card.color_var ? `var(${card.color_var})` : 'var(--fin)' }}
              />
              <div>
                <p className="text-[16px] font-bold text-tx">{card.name}</p>
                {card.statement_day && (
                  <p className="text-[12px] text-tx-3">
                    Bills on {card.statement_day}th &middot; Due {card.due_day || card.statement_day + 20}th
                  </p>
                )}
              </div>
            </div>

            {/* Cycle info */}
            {card.current_cycle_spend != null && (
              <div className="p-3 rounded-[14px] border border-hair">
                <p className="text-[11px] text-tx-3">Current cycle spend</p>
                <p className="text-[18px] font-bold font-num text-tx">{formatINR(card.current_cycle_spend)}</p>
              </div>
            )}

            {/* Reward rules */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3">Reward rules</p>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="text-[12px] font-semibold press-scale"
                  style={{ color: 'var(--fin)' }}
                >
                  {editMode ? 'Done' : 'Edit'}
                </button>
              </div>
              {rules.length === 0 ? (
                <p className="text-[13px] text-tx-3">No rules configured</p>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule, i) => (
                    <div key={rule.id || i} className="p-3 rounded-[14px] border border-hair">
                      {editMode ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={rule.multiplier_text || ''}
                            onChange={e => {
                              const updated = { ...rule, multiplier_text: e.target.value };
                              setRules(prev => prev.map((r, ri) => ri === i ? updated : r));
                            }}
                            placeholder="e.g. 5x points"
                            className="w-full px-3 py-2 rounded-[10px] border border-hair bg-card-2 text-[12px] text-tx outline-none"
                          />
                          <input
                            type="text"
                            value={rule.category_or_merchant || ''}
                            onChange={e => {
                              const updated = { ...rule, category_or_merchant: e.target.value };
                              setRules(prev => prev.map((r, ri) => ri === i ? updated : r));
                            }}
                            placeholder="Category or merchant"
                            className="w-full px-3 py-2 rounded-[10px] border border-hair bg-card-2 text-[12px] text-tx outline-none"
                          />
                          <input
                            type="text"
                            value={rule.note || ''}
                            onChange={e => {
                              const updated = { ...rule, note: e.target.value };
                              setRules(prev => prev.map((r, ri) => ri === i ? updated : r));
                            }}
                            placeholder="Note"
                            className="w-full px-3 py-2 rounded-[10px] border border-hair bg-card-2 text-[12px] text-tx outline-none"
                          />
                          <button
                            onClick={() => handleRuleSave(rules[i])}
                            className="text-[12px] font-semibold px-3 py-1 rounded-full press-scale"
                            style={{ background: 'color-mix(in oklab, var(--fin) 14%, transparent)', color: 'var(--fin)' }}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-[13px] font-semibold" style={{ color: 'var(--fin)' }}>
                            {rule.multiplier_text}
                          </p>
                          <p className="text-[12px] text-tx">{rule.category_or_merchant}</p>
                          {rule.note && <p className="text-[11px] text-tx-3">{rule.note}</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent transactions */}
            {transactions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Recent on this card</p>
                <div className="space-y-2">
                  {transactions.map((tx, i) => {
                    const colorVar = tx.color_token || '--oth';
                    return (
                      <div key={tx.id || i} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: `var(${colorVar})` }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-tx truncate">{tx.merchant || tx.note || tx.category_name}</p>
                          <p className="text-[11px] text-tx-3">{tx.date}</p>
                        </div>
                        <span className="text-[14px] font-num font-semibold text-tx flex-shrink-0">{formatINR(tx.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Points balance */}
            {card.points_balance != null && (
              <div className="p-3 rounded-[14px] border border-hair flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-tx-3">Points balance</p>
                  <p className="text-[16px] font-bold font-num text-tx">{card.points_balance.toLocaleString()}</p>
                </div>
                <Coins size={20} style={{ color: 'var(--fin)' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ─── PointsLedgerSheet ──────────────────────────────────────
function PointsLedgerSheet({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getPointsLedger();
        setEntries(res.entries || res || []);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalValue = entries.reduce((s, e) => s + (e.value || 0), 0);

  return (
    <Sheet open={true} onClose={onClose} title="Points Ledger" height="full">
      <div className="px-5 pb-4">
        {loading ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            {/* Total */}
            <div className="text-center p-4 rounded-[20px] border border-hair">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3">Total value</p>
              <p className="text-[24px] font-bold font-num text-tx mt-1">{formatINR(totalValue)}</p>
            </div>

            {/* Entries */}
            {entries.length === 0 ? (
              <p className="text-[13px] text-tx-3 text-center">No ledger entries</p>
            ) : (
              <div className="space-y-1">
                {entries.map((entry, i) => (
                  <div key={entry.id || i} className="flex items-center gap-3 py-2.5 border-b border-hair last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-tx truncate">{entry.description}</p>
                      <p className="text-[11px] text-tx-3">{entry.card_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[14px] font-num font-semibold ${(entry.delta || 0) >= 0 ? 'text-points' : 'text-tx-2'}`}>
                        {(entry.delta || 0) >= 0 ? '+' : ''}{entry.delta?.toLocaleString() || 0}
                      </p>
                      {entry.balance != null && (
                        <p className="text-[11px] font-num text-tx-3">{entry.balance.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ─── AddInvestmentSheet ─────────────────────────────────────
function AddInvestmentSheet({ onClose, onSave }) {
  const [invType, setInvType] = useState('SIP');
  const [instrumentName, setInstrumentName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(todayStr());
  const [isRecurring, setIsRecurring] = useState(false);
  const [saving, setSaving] = useState(false);

  const amount = parseFloat(amountStr) || 0;
  const canSave = amount > 0 && instrumentName.trim();

  const types = ['SIP', 'Mutual Fund', 'Stocks', 'FD/RD', 'Other'];

  function handleKey(key) {
    if (key === 'backspace') {
      setAmountStr(s => s.slice(0, -1));
    } else if (key === '.') {
      if (!amountStr.includes('.') && amountStr.length < 8) {
        setAmountStr(s => s + '.');
      }
    } else {
      if (amountStr.length < 8) {
        setAmountStr(s => s + key);
      }
    }
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await api.addInvestment({
        type: invType,
        instrument_name: instrumentName,
        amount,
        date,
        is_recurring: isRecurring,
      });
      onSave();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Sheet open={true} onClose={onClose} title="Log Investment" height="full">
      <div className="px-5 pb-4 flex flex-col">
        {/* Amount */}
        <div className="text-center py-4">
          <p className="text-[36px] font-bold font-num text-tx" style={{ fontFamily: "'Space Grotesk', system-ui" }}>
            {amountStr ? formatINR(parseFloat(amountStr)) : '\u20B90'}
          </p>
        </div>

        {/* Type chips */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-2">Type</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-3">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setInvType(t)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold press-scale whitespace-nowrap"
              style={{
                border: invType === t ? '1.5px solid color-mix(in oklab, var(--fin) 60%, transparent)' : '1.5px solid var(--hair)',
                background: invType === t ? 'color-mix(in oklab, var(--fin) 14%, transparent)' : 'transparent',
                color: invType === t ? 'var(--fin)' : 'var(--text-2)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Instrument name */}
        <input
          type="text"
          value={instrumentName}
          onChange={e => setInstrumentName(e.target.value)}
          placeholder="Instrument name"
          className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx placeholder:text-tx-3 outline-none mb-2"
        />

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx outline-none mb-3"
        />

        {/* Recurring SIP toggle */}
        <button
          onClick={() => setIsRecurring(!isRecurring)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] border press-scale mb-4"
          style={{
            borderColor: isRecurring ? 'color-mix(in oklab, var(--fin) 60%, transparent)' : 'var(--hair)',
            background: isRecurring ? 'color-mix(in oklab, var(--fin) 14%, transparent)' : 'transparent',
          }}
        >
          <div
            className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: isRecurring ? 'var(--fin)' : 'var(--hair)',
              background: isRecurring ? 'var(--fin)' : 'transparent',
            }}
          >
            {isRecurring && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-[13px] text-tx">Mark as recurring SIP</span>
        </button>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1','2','3','4','5','6','7','8','9','.','0','backspace'].map(key => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="h-12 rounded-[14px] bg-card-2 flex items-center justify-center text-[20px] font-num font-semibold text-tx press-scale"
            >
              {key === 'backspace' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              ) : key}
            </button>
          ))}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-3.5 rounded-[16px] text-[15px] font-bold text-white press-scale"
          style={{
            background: canSave ? 'var(--fin)' : 'var(--hair)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Sheet>
  );
}

// ─── GoalSheet ──────────────────────────────────────────────
function GoalSheet({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() && parseFloat(targetAmount) > 0;

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await api.addFinGoal({
        name: name.trim(),
        target_amount: parseFloat(targetAmount),
        target_date: targetDate || undefined,
      });
      onSave();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Sheet open={true} onClose={onClose} title="New Goal">
      <div className="px-5 pb-4 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1.5">Goal name</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Emergency fund"
            className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx placeholder:text-tx-3 outline-none"
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1.5">Target amount</p>
          <input
            type="number"
            value={targetAmount}
            onChange={e => setTargetAmount(e.target.value)}
            placeholder="500000"
            className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx placeholder:text-tx-3 outline-none font-num"
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-tx-3 mb-1.5">Target date (optional)</p>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-[14px] border border-hair bg-card-2 text-[13px] text-tx outline-none"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-3.5 rounded-[16px] text-[15px] font-bold text-white press-scale"
          style={{
            background: canSave ? 'var(--fin)' : 'var(--hair)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Create goal'}
        </button>
      </div>
    </Sheet>
  );
}

// ─── EmptyState ─────────────────────────────────────────────
function EmptyState({ msg }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <FileText size={28} className="text-tx-3" />
      <p className="text-[13px] text-tx-3">{msg}</p>
    </div>
  );
}
