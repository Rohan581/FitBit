import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { PointsRing } from '../components/MacroBar';

function getWeekStart() {
  const ist = new Date(Date.now() + 330 * 60000);
  const day = ist.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  ist.setUTCDate(ist.getUTCDate() + diff);
  return ist.toISOString().split('T')[0];
}

function formatAmount(n) {
  if (n == null) return '—';
  return '₹' + n.toLocaleString('en-IN');
}

export default function Points() {
  const [weekData, setWeekData] = useState(null);
  const [bankData, setBankData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseDesc, setPurchaseDesc] = useState('');
  const [purchaseItemId, setPurchaseItemId] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');

  const weekStart = getWeekStart();

  const load = useCallback(async () => {
    try {
      const [w, b] = await Promise.all([
        api.getWeeklySummary(weekStart),
        api.getBank(),
      ]);
      setWeekData(w);
      setBankData(b);

      // Auto-credit if threshold met and not yet credited this week
      if (w.treat_earned) {
        const alreadyCredited = b.ledger.some(
          l => l.kind === 'weekly_credit' && l.week_start === weekStart
        );
        if (!alreadyCredited) {
          await api.creditBank(weekStart);
          const updated = await api.getBank();
          setBankData(updated);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  async function handlePurchase() {
    const amount = parseFloat(purchaseAmount);
    if (!amount || amount <= 0) return;
    try {
      await api.purchaseFromBank({
        amount,
        description: purchaseDesc || 'Purchase',
        wishlist_item_id: purchaseItemId || undefined,
      });
      setShowPurchase(false);
      setPurchaseAmount('');
      setPurchaseDesc('');
      setPurchaseItemId(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleAddItem() {
    if (!newItemName.trim()) return;
    await api.addWishlistItem({
      name: newItemName.trim(),
      target_amount: newItemAmount ? parseFloat(newItemAmount) : null,
    });
    setShowAddItem(false);
    setNewItemName('');
    setNewItemAmount('');
    load();
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-7 h-7 border-2 border-hair border-t-points rounded-full animate-spin" />
    </div>
  );

  if (!weekData || !bankData) return null;

  const { total_points, threshold, treat_earned, by_day } = weekData;
  const { balance, credit_amount, items, ledger } = bankData;
  const remaining = Math.max(0, threshold - total_points);
  const unpurchasedItems = items.filter(i => !i.purchased);

  return (
    <div className="px-4 pb-4 tab-fade-enter">
      <div className="pt-5 pb-5">
        <h1 className="text-[22px] font-bold text-tx">Bank</h1>
        <p className="text-xs text-tx-3 mt-0.5">Your reward balance</p>
      </div>

      {/* Balance hero */}
      <div className="bg-card rounded-card p-5 mb-3 stagger-enter text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-tx-3 mb-1">Balance</p>
        <p className="text-[36px] font-bold text-points" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          {formatAmount(balance)}
        </p>
      </div>

      {/* This week's threshold progress */}
      <div className="bg-card rounded-card p-4 mb-3 stagger-enter">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-tx-3">This week</p>
          <p className="text-xs text-tx-3">
            {treat_earned
              ? `${formatAmount(credit_amount)} credited`
              : `${formatAmount(credit_amount)} credits on hitting ${threshold}`
            }
          </p>
        </div>
        <div className="h-3 bg-card-2 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full progress-fill bg-points"
            style={{ width: `${Math.min((total_points / threshold) * 100, 100)}%` }}
          />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-num font-bold text-points">{Math.round(total_points)}</span>
          <span className="text-sm font-num text-tx-3">/ {threshold} pts</span>
          {!treat_earned && (
            <span className="text-xs text-tx-3 ml-auto">{remaining} to go</span>
          )}
        </div>
      </div>

      {/* Wishlist items with progress bars */}
      {unpurchasedItems.length > 0 && (
        <div className="bg-card rounded-card p-4 mb-3 stagger-enter">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-tx">Wishlist</p>
            <button
              onClick={() => setShowAddItem(true)}
              className="text-xs text-points press-scale"
            >
              + Add
            </button>
          </div>
          <div className="space-y-3">
            {unpurchasedItems.map(item => {
              const progress = item.target_amount && item.target_amount > 0
                ? Math.min(balance / item.target_amount, 1)
                : null;
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-tx">{item.name}</p>
                    <p className="text-xs font-num text-tx-3">
                      {item.target_amount ? formatAmount(item.target_amount) : 'Price TBD'}
                    </p>
                  </div>
                  {progress !== null && (
                    <div className="h-2 bg-card-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full progress-fill"
                        style={{
                          width: `${progress * 100}%`,
                          background: progress >= 1 ? 'var(--points)' : 'color-mix(in oklab, var(--points) 60%, var(--card-2))',
                        }}
                      />
                    </div>
                  )}
                  {progress !== null && progress >= 1 && item.target_amount && (
                    <button
                      onClick={() => {
                        setPurchaseItemId(item.id);
                        setPurchaseAmount(String(item.target_amount));
                        setPurchaseDesc(item.name);
                        setShowPurchase(true);
                      }}
                      className="text-xs text-points mt-1 press-scale"
                    >
                      Buy now
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record a purchase */}
      <button
        onClick={() => { setPurchaseItemId(null); setPurchaseAmount(''); setPurchaseDesc(''); setShowPurchase(true); }}
        className="w-full bg-card rounded-card p-3.5 text-sm text-tx-2 border border-hair mb-3 stagger-enter press-scale"
      >
        Record a purchase
      </button>

      {/* Purchase sheet */}
      {showPurchase && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowPurchase(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-enter" />
          <div
            className="relative w-full max-w-lg bg-card rounded-t-[20px] p-5 sheet-enter"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-lg font-bold text-tx mb-4">Record purchase</p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="What did you buy?"
                value={purchaseDesc}
                onChange={e => setPurchaseDesc(e.target.value)}
                className="w-full px-4 py-3 rounded-card border border-hair bg-card-2 text-sm text-tx"
              />
              <input
                type="number"
                placeholder="Amount (₹)"
                value={purchaseAmount}
                onChange={e => setPurchaseAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-card border border-hair bg-card-2 text-sm font-num text-tx"
              />
              {balance < parseFloat(purchaseAmount || 0) && (
                <p className="text-xs text-danger">Insufficient balance</p>
              )}
              <button
                onClick={handlePurchase}
                disabled={!purchaseAmount || parseFloat(purchaseAmount) <= 0 || balance < parseFloat(purchaseAmount || 0)}
                className="w-full py-3.5 bg-points text-white rounded-card text-sm font-bold disabled:opacity-40 press-scale"
              >
                Confirm — {formatAmount(parseFloat(purchaseAmount) || 0)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add wishlist item sheet */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAddItem(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-enter" />
          <div
            className="relative w-full max-w-lg bg-card rounded-t-[20px] p-5 sheet-enter"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-lg font-bold text-tx mb-4">Add to wishlist</p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Item name"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                className="w-full px-4 py-3 rounded-card border border-hair bg-card-2 text-sm text-tx"
              />
              <input
                type="number"
                placeholder="Target price (₹, optional)"
                value={newItemAmount}
                onChange={e => setNewItemAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-card border border-hair bg-card-2 text-sm font-num text-tx"
              />
              <button
                onClick={handleAddItem}
                disabled={!newItemName.trim()}
                className="w-full py-3.5 bg-points text-white rounded-card text-sm font-bold disabled:opacity-40 press-scale"
              >
                Add item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily breakdown */}
      <div className="bg-card rounded-card p-4 mb-3 stagger-enter">
        <p className="text-xs text-tx-3 mb-3">This week by day</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {(by_day || []).map((day, i) => {
            const dayPct = Math.min((day.total / (threshold / 7)) * 100, 100);
            const isToday = day.date === new Date(Date.now() + 330 * 60000).toISOString().split('T')[0];
            return (
              <div key={day.date} className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-tx-3">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div>
                <div className="h-14 w-full bg-card-2 rounded-lg relative overflow-hidden">
                  <div
                    className={`absolute bottom-0 w-full rounded-lg transition-all duration-500 bg-points ${isToday ? 'ring-1 ring-points/40' : ''}`}
                    style={{ height: `${dayPct}%` }}
                  />
                </div>
                <div className="text-[10px] font-num text-tx-2">{day.total > 0 ? day.total : '-'}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ledger */}
      {ledger.length > 0 && (
        <div className="bg-card rounded-card p-4 stagger-enter">
          <p className="text-sm font-semibold text-tx mb-3">Ledger</p>
          <div className="space-y-2">
            {ledger.slice(0, 20).map(entry => (
              <div key={entry.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-tx truncate">{entry.description}</p>
                  <p className="text-[10px] text-tx-3">{entry.date}</p>
                </div>
                <span className={`text-sm font-num font-semibold ${entry.delta > 0 ? 'text-points' : 'text-tx-2'}`}>
                  {entry.delta > 0 ? '+' : ''}{formatAmount(entry.delta)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How points work */}
      <div className="bg-card rounded-card p-4 mt-3 stagger-enter">
        <h2 className="text-sm font-semibold text-tx mb-2">How points work</h2>
        <div className="space-y-1.5 text-xs text-tx-3">
          <p><span className="text-cal">Calories</span> within target: 20 pts</p>
          <p><span className="text-protein">Protein</span> target hit: 25 pts</p>
          <p><span className="text-tx">Exercise</span> (gym 60+ min): 30 pts</p>
          <p><span className="text-tx">Sleep</span> 7-8.5 hours: 15 pts</p>
          <p><span className="text-tx">All 4 logged</span> in a day: 10 pts bonus</p>
        </div>
      </div>
    </div>
  );
}
