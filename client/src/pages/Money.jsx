import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { SidebarTrigger } from '../components/Sidebar';

/* ── helpers ─────────────────────────────────────────── */

const inr = n => '₹' + Math.round(Math.abs(n || 0)).toLocaleString('en-IN');
const signed = n => (n < 0 ? '−' : '+') + inr(n);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = m => MONTHS[Number(m.slice(5, 7)) - 1];
const shortDate = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLabel = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const instrument = t => `${t.bank} ${t.instrument === 'card' ? 'card' : 'a/c'} ..${t.last4 || ''}`;

function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { fn().then(setData).catch(e => setError(e.message)); }, deps); // eslint-disable-line
  useEffect(load, [load]);
  return { data, error, reload: load };
}

function Page({ title, right, lead, onOpenSidebar, children }) {
  return (
    <div className="px-4 pt-5 pb-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between min-h-[44px] mb-3">
        <div className="flex items-center gap-2">
          {onOpenSidebar && <SidebarTrigger onClick={onOpenSidebar} />}
          <div>
            <h1 className="font-num text-[22px] font-bold tracking-[-0.02em] text-tx">{title}</h1>
            {lead && <p className="text-[13px] text-tx-2">{lead}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
const Card = ({ className = '', children }) => <div className={`bg-card rounded-card ${className}`}>{children}</div>;
const Num = ({ className = '', children }) => <span className={`font-num font-semibold ${className}`}>{children}</span>;
const Note = ({ children }) => <p className="text-[12.5px] leading-snug text-tx-2 px-1">{children}</p>;
function State({ data, error }) {
  if (error) return <Card className="p-4 text-[13.5px] text-danger">{error}</Card>;
  if (!data) return <Card className="p-4 text-[13.5px] text-tx-2">Loading…</Card>;
  return null;
}
function Row({ last, children }) {
  return <div className={`flex items-center justify-between gap-3 py-3 min-h-[48px] ${last ? '' : 'border-b border-hair'}`}>{children}</div>;
}

/* ── Month ───────────────────────────────────────────── */

export function MoneyMonth({ onOpenSidebar }) {
  const { data: d, error } = useLoad(() => api.moneyMonth());
  const settingsLink = (
    <Link to="/money/settings" aria-label="Money settings" className="w-11 h-11 flex items-center justify-center text-tx-2 press-scale">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
        <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="14" cy="18" r="2" />
      </svg>
    </Link>
  );
  if (!d) return <Page title="Money" onOpenSidebar={onOpenSidebar} right={settingsLink}><State data={d} error={error} /></Page>;

  if (!d.configured) {
    return (
      <Page title="Money" onOpenSidebar={onOpenSidebar} right={settingsLink}>
        <Card className="p-5">
          <h2 className="font-num text-[16px] font-semibold text-tx">Set your monthly cap first</h2>
          <p className="text-[13.5px] text-tx-2 mt-1 mb-4">Money needs your spending cap, rent and salary once. After that it fills itself from bank emails.</p>
          <Link to="/money/settings" className="inline-flex items-center h-11 px-4 rounded-[12px] bg-tx text-page text-[14px] font-semibold press-scale">Open settings</Link>
        </Card>
      </Page>
    );
  }

  const pct = v => Math.max(0, Math.min(100, (v / d.cap) * 100));
  const rentW = pct(d.rent);
  const varW = Math.min(100 - rentW, pct(Math.max(0, d.variable)));
  const paceLeft = pct(d.rent + d.expected_variable);
  const over = d.over_pace > 0;
  const maxCat = Math.max(1, ...d.categories.map(c => c.amount));
  const top = d.categories.slice(0, 5);
  const rest = d.categories.slice(5);
  const review = [
    d.review_count ? `${d.review_count} merchant${d.review_count > 1 ? 's' : ''} to name` : null,
    d.untracked_cards.length ? `${d.untracked_cards.length} card${d.untracked_cards.length > 1 ? 's' : ''} not tracked` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Page title={monthName(d.month)} onOpenSidebar={onOpenSidebar}
      right={<div className="flex items-center gap-1"><span className="text-[13px] text-tx-2">Day {d.day} of {d.days_in_month}</span>{settingsLink}</div>}>
      <div className="rounded-card p-5 flex flex-col gap-3.5" style={{ background: 'var(--money-dim)' }}>
        <div>
          <p className="text-[13px] text-money-ink">Spent so far</p>
          <div className="flex items-baseline gap-2">
            <Num className="text-[40px] !font-bold tracking-[-0.03em] leading-[1.1] text-tx">{inr(d.spent)}</Num>
            <span className="font-num text-[15px] text-money-ink">of {inr(d.cap)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="relative h-3 rounded-full bg-card flex" role="img"
            aria-label={`Rent ${inr(d.rent)} plus other spend ${inr(d.variable)}, against a pace mark at ${inr(d.rent + d.expected_variable)}`}>
            <div className="h-3 rounded-l-full bg-money-soft" style={{ width: `${rentW}%` }} />
            <div className="h-3 rounded-r-full bg-money progress-fill" style={{ width: `${varW}%` }} />
            <div className="absolute -top-1 w-0.5 h-5 bg-tx" style={{ left: `${paceLeft}%` }} />
          </div>
          <div className="flex justify-between text-[12px] text-money-ink">
            <span>Rent {inr(d.rent)}</span><span>Everything else {inr(d.variable)}</span>
          </div>
        </div>
        {d.is_current && (
          <div className="bg-card rounded-[12px] px-3 py-2.5 text-[13.5px] leading-snug text-tx">
            <strong>{inr(d.over_pace)} {over ? 'over' : 'under'} pace.</strong>{' '}
            {d.left > 0 ? `${inr(d.per_day_left)} a day keeps you under the cap.` : `You are ${inr(d.left)} past the cap.`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[['In', d.inflow], ['Saved', d.saved], [d.left >= 0 ? 'Left to spend' : 'Over the cap', d.left]].map(([label, v]) => (
          <Card key={label} className="p-3">
            <p className="text-[12px] text-tx-2">{label}</p>
            <Num className="text-[16px] text-tx">{inr(v)}</Num>
          </Card>
        ))}
      </div>

      <Card className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <h2 className="font-num text-[15px] font-semibold text-tx">Where it went</h2>
          <span className="text-[12px] text-tx-2">vs 3-month average</span>
        </div>
        {top.length === 0 && <p className="text-[13.5px] text-tx-2">Nothing yet this month.</p>}
        {top.map(c => (
          <div key={c.name} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline text-[13.5px] text-tx gap-3">
              <span className="truncate">{c.name}</span>
              <span className="flex gap-2 items-baseline flex-shrink-0">
                {c.vs_avg !== null && Math.abs(c.vs_avg) >= 1 && <span className="text-[12px] text-tx-2">{signed(c.vs_avg)}</span>}
                <Num>{inr(c.amount)}</Num>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-card-2">
              <div className="h-1.5 rounded-full progress-fill" style={{ width: `${Math.max(2, (c.amount / maxCat) * 100)}%`, background: c.vs_avg > 0 ? 'var(--money)' : 'var(--money-soft)' }} />
            </div>
          </div>
        ))}
        {rest.length > 0 && <p className="text-[12.5px] text-tx-2">{rest.length} more · {inr(rest.reduce((a, c) => a + c.amount, 0))}</p>}
        {d.reimbursed > 0 && <p className="text-[12.5px] text-tx-2">Total is net of {inr(d.reimbursed)} reimbursed to you.</p>}
      </Card>

      {d.from_spend_fund > 0 && (
        <Card className="px-4 py-2.5 flex items-center justify-between gap-3 min-h-[48px]">
          <div>
            <p className="text-[13.5px] font-medium text-tx">From spend fund</p>
            <p className="text-[12px] text-tx-2">Outside the {inr(d.cap)} cap</p>
          </div>
          <Num className="text-[16px] text-tx">{inr(d.from_spend_fund)}</Num>
        </Card>
      )}

      {review && (
        <Link to="/money/review" className="bg-card rounded-card px-4 py-3.5 min-h-[48px] flex items-center justify-between text-[13.5px] text-tx press-scale">
          <span>{review}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </Link>
      )}
      <Note>{d.last_sync ? `Last synced ${new Date(d.last_sync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : 'No bank emails received yet. Set up the Gmail forwarder to start.'}</Note>
    </Page>
  );
}

/* ── Activity ────────────────────────────────────────── */

const TAGS = {
  refund: ['Refund', 'good'], reimbursement: ['Reimbursed', 'good'], money_in: ['Money in', 'good'],
  saved: ['Saved', 'muted'], invested: ['Invested', 'muted'], spend_fund: ['Spend fund', 'muted'],
  transfer: ['Own transfer', 'muted'], card_payment: ['Card bill', 'muted'], rent_payment: ['Rent', 'muted'], salary_credit: ['Salary', 'muted'],
};
const TAG_STYLE = {
  good: { background: 'color-mix(in oklab, var(--points) 14%, transparent)', color: 'var(--points)' },
  muted: { background: 'var(--card-2)', color: 'var(--text-2)' },
  review: { background: 'color-mix(in oklab, var(--warning) 22%, transparent)', color: 'var(--text)' },
};
const FILTERS = [
  ['all', 'All', () => true],
  ['spend', 'Spend', t => ['spend', 'refund', 'reimbursement'].includes(t.type)],
  ['in', 'Money in', t => ['money_in', 'salary_credit', 'reimbursement', 'refund'].includes(t.type)],
  ['other', 'Not spend', t => ['saved', 'invested', 'transfer', 'card_payment', 'rent_payment', 'spend_fund'].includes(t.type)],
];

export function MoneyActivity() {
  const { data, error } = useLoad(() => api.moneyTransactions());
  const [filter, setFilter] = useState('all');
  const match = FILTERS.find(f => f[0] === filter)[2];
  const days = [];
  for (const t of (data?.transactions || []).filter(match)) {
    if (!days.length || days[days.length - 1].date !== t.date) days.push({ date: t.date, rows: [] });
    days[days.length - 1].rows.push(t);
  }
  return (
    <Page title="Activity" lead="This month">
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key}
            className={`h-9 px-3.5 rounded-full text-[13px] whitespace-nowrap press-scale ${filter === key ? 'bg-tx text-page font-semibold' : 'bg-card text-tx border border-hair'}`}>
            {label}
          </button>
        ))}
      </div>
      <State data={data} error={error} />
      {data && days.length === 0 && <Card className="p-4 text-[13.5px] text-tx-2">Nothing here yet.</Card>}
      {days.map(day => {
        const spent = day.rows.reduce((a, t) => a + (t.type === 'spend' ? t.amount : t.type === 'refund' ? -t.amount : 0), 0);
        return (
          <div key={day.date} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[12.5px] text-tx-2 px-1">
              <span>{dayLabel(day.date)}</span><span>{inr(spent)} spent</span>
            </div>
            <Card className="px-4 py-1">
              {day.rows.map((t, i) => {
                const needs = (t.type === 'spend' || t.type === 'spend_fund') && !t.category;
                const tag = needs ? ['Name this', 'review'] : TAGS[t.type];
                const incoming = ['refund', 'reimbursement', 'money_in', 'salary_credit'].includes(t.type);
                const quiet = !incoming && t.type !== 'spend';
                return (
                  <Row key={t.id} last={i === day.rows.length - 1}>
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-medium text-tx truncate">{t.payee}</p>
                      <p className="text-[12.5px] text-tx-2 truncate">{[t.category, instrument(t), t.currency ? `estimated from ${t.currency} ${t.amount_orig}` : null].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Num className="text-[15px]" ><span style={{ color: incoming ? 'var(--points)' : quiet ? 'var(--text-2)' : 'var(--text)' }}>{incoming ? '+' : ''}{inr(t.amount)}</span></Num>
                      {tag && <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full" style={TAG_STYLE[tag[1]]}>{tag[0]}</span>}
                    </div>
                  </Row>
                );
              })}
            </Card>
          </div>
        );
      })}
      <Note>Every row comes from a bank email. Nothing here is typed in.</Note>
    </Page>
  );
}

/* ── Review ──────────────────────────────────────────── */

export function MoneyReview() {
  const { data: d, error, reload } = useLoad(() => api.moneyReview());
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  async function pick(id, category) {
    setBusy(id);
    try { await api.moneyCategorise(id, category); setOpen(null); reload(); } finally { setBusy(null); }
  }
  return (
    <Page title="Review" lead="The only place Money asks you for anything">
      <State data={d} error={error} />
      {d && d.items.length === 0 && <Card className="p-4 text-[13.5px] text-tx-2">Every merchant has a category. Nothing to do.</Card>}
      {d && d.items.map(t => {
        const choices = open === t.id ? d.categories : d.suggested;
        return (
          <Card key={t.id} className="p-4 flex flex-col gap-3">
            <div className="flex justify-between items-baseline gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-tx truncate">{t.payee}</p>
                <p className="text-[12.5px] text-tx-2">{shortDate(t.date)} · {instrument(t)}</p>
              </div>
              <Num className="text-[16px] text-tx flex-shrink-0">{inr(t.amount)}</Num>
            </div>
            <div className="flex flex-wrap gap-2">
              {choices.map(c => (
                <button key={c} type="button" disabled={busy === t.id} onClick={() => pick(t.id, c)}
                  className="h-11 px-3.5 rounded-full border border-hair bg-card text-[13.5px] text-tx press-scale">{c}</button>
              ))}
              {open !== t.id && <button type="button" onClick={() => setOpen(t.id)} className="h-11 px-3.5 rounded-full border border-hair bg-card text-[13.5px] text-tx-2 press-scale">More</button>}
            </div>
          </Card>
        );
      })}
      {d && d.items.length > 0 && <Note>One tap. Every past and future charge from that merchant is sorted the same way.</Note>}

      {d && d.untracked_cards.length > 0 && (
        <div className="rounded-card p-4" style={{ background: 'color-mix(in oklab, var(--warning) 20%, var(--card))' }}>
          <h2 className="font-num text-[15px] font-semibold text-tx">{d.untracked_cards.length} card{d.untracked_cards.length > 1 ? 's are' : ' is'} not tracked</h2>
          <p className="text-[13.5px] leading-snug text-tx mt-1">{d.untracked_cards.join(', ')}: no spend emails arrive for {d.untracked_cards.length > 1 ? 'these' : 'this'}, so the charges are missing from every total. Turn on email alerts in the card's app.</p>
        </div>
      )}

      {d && (
        <Card className="px-4 py-1">
          {d.sources.map(s => (
            <Row key={s.source}>
              <span className="text-[13.5px] text-tx">{s.source}</span>
              <span className="text-[13.5px] font-semibold" style={{ color: s.stale ? 'var(--danger)' : 'var(--points)' }}>
                {s.last_seen ? (s.stale ? `Silent since ${shortDate(s.last_seen)}` : `Reading fine · ${shortDate(s.last_seen)}`) : 'No emails yet'}
              </span>
            </Row>
          ))}
          <Row last>
            <span className="text-[13.5px] text-tx">Emails Money could not read</span>
            <Num className="text-tx">{d.unparsed}</Num>
          </Row>
        </Card>
      )}
      {d && d.unparsed_recent.length > 0 && <Note>Latest unread: {d.unparsed_recent.map(u => `${u.source} "${u.subject}"`).join('; ')}</Note>}
    </Page>
  );
}

/* ── Recurring ───────────────────────────────────────── */

export function MoneyRecurring() {
  const { data: d, error } = useLoad(() => api.moneyRecurring());
  return (
    <Page title="Recurring" lead="Found from standing instructions and repeats">
      <State data={d} error={error} />
      {d && (
        <>
          <div className="rounded-card p-5" style={{ background: 'var(--money-dim)' }}>
            <p className="text-[13px] text-money-ink">Subscriptions each month</p>
            <div className="flex items-baseline gap-2">
              <Num className="text-[34px] !font-bold tracking-[-0.03em] leading-[1.15] text-tx">{inr(d.monthly_total)}</Num>
              <span className="text-[14px] text-money-ink">across {d.subscriptions.length} charge{d.subscriptions.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          {d.subscriptions.length > 0 && (
            <Card className="px-4 py-1">
              {d.subscriptions.map((s, i) => (
                <Row key={s.payee} last={i === d.subscriptions.length - 1}>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium text-tx truncate">{s.payee}</p>
                    <p className="text-[12.5px] text-tx-2">{s.bank} ..{s.last4} · next around {shortDate(s.next_date)}</p>
                  </div>
                  <Num className="text-[15px] text-tx">{inr(s.amount)}</Num>
                </Row>
              ))}
            </Card>
          )}
          <div className="flex flex-col gap-1.5">
            <p className="text-[12.5px] text-tx-2 px-1">Fixed every month</p>
            <Card className="px-4 py-1">
              <Row><span className="text-[14.5px] text-tx">Salary in</span><Num><span style={{ color: 'var(--points)' }}>+{inr(d.fixed.salary)}</span></Num></Row>
              <Row><span className="text-[14.5px] text-tx">Rent</span><Num className="text-tx">{inr(d.fixed.rent)}</Num></Row>
              <Row last><span className="text-[14.5px] text-tx">Recurring deposit</span><Num className="text-tx">{inr(d.fixed.recurring_deposit)}</Num></Row>
            </Card>
          </div>
          {d.untracked_cards.length > 0 && <Note>Subscriptions on {d.untracked_cards.join(', ')} will appear once those cards are tracked.</Note>}
        </>
      )}
    </Page>
  );
}

/* ── Savings ─────────────────────────────────────────── */

export function MoneySavings() {
  const { data: d, error } = useLoad(() => api.moneySavings());
  if (!d) return <Page title="Savings"><State data={d} error={error} /></Page>;
  const max = Math.max(1, ...d.history.map(h => h.saved));
  const funds = [
    ['Emergency fund', 'Recurring deposit', d.funds.emergency],
    ['Trip fund', 'Moved to your savings account', d.funds.trip],
    ['Spend fund', 'Moved to your spend-fund account', d.funds.spend],
    ['Invested', 'Sent to a broker', d.funds.invested],
  ];
  return (
    <Page title="Savings" right={<span className="text-[13px] text-tx-2">{monthName(d.month)}</span>}>
      <div className="rounded-card p-5 flex flex-col gap-3" style={{ background: 'var(--money-dim)' }}>
        <div>
          <p className="text-[13px] text-money-ink">Put away so far</p>
          <div className="flex items-baseline gap-2">
            <Num className="text-[40px] !font-bold tracking-[-0.03em] leading-[1.1] text-tx">{inr(d.put_away)}</Num>
            {d.share_of_salary !== null && <span className="text-[14px] text-money-ink">{d.share_of_salary}% of salary</span>}
          </div>
        </div>
        {d.free_to_put_away !== null && d.free_to_put_away > 0 && (
          <div className="bg-card rounded-[12px] px-3 py-2.5 text-[13.5px] leading-snug text-tx">
            <strong>{inr(d.free_to_put_away)} more is free to put away</strong> if you finish the month at the {inr(d.cap)} cap.
          </div>
        )}
      </div>
      <Card className="px-4 py-1">
        {funds.map(([name, meta, v], i) => (
          <Row key={name} last={i === funds.length - 1}>
            <div>
              <p className="text-[14.5px] font-medium text-tx">{name}</p>
              <p className="text-[12.5px] text-tx-2">{v > 0 ? meta : 'Nothing moved yet this month'}</p>
            </div>
            <Num className="text-[15px]"><span style={{ color: v > 0 ? 'var(--text)' : 'var(--text-2)' }}>{inr(v)}</span></Num>
          </Row>
        ))}
      </Card>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[12.5px] text-tx-2 px-1">
          <span>Estimated balances</span>
          <span>{d.balances_as_of ? `opening balance as of ${shortDate(d.balances_as_of)}` : d.tracked_since ? `tracked since ${shortDate(d.tracked_since)}` : ''}</span>
        </div>
        <Card className="px-4 py-1">
          {[['Emergency fund', d.balances.emergency], ['Trip fund', d.balances.trip], ['Spend fund', d.balances.spend]].map(([name, b], i) => (
            <Row key={name} last={i === 2}>
              <div>
                <p className="text-[14.5px] font-medium text-tx">{name}</p>
                <p className="text-[12.5px] text-tx-2">{inr(b.put_in)} put in{d.tracked_since ? ` since ${shortDate(d.tracked_since)}` : ''}{b.sees_withdrawals ? '' : ' · withdrawals not seen'}</p>
              </div>
              <Num className="text-[15px] text-tx">{inr(b.estimate)}</Num>
            </Row>
          ))}
        </Card>
        {d.invested_total > 0 && <Note>{inr(d.invested_total)} sent to brokers in total. Market value is not tracked.</Note>}
      </div>
      {d.funds.from_spend_fund > 0 && (
        <Card className="px-4 py-2.5 flex items-center justify-between min-h-[48px]">
          <span className="text-[13.5px] text-tx">Paid out of the spend fund this month</span>
          <Num className="text-tx">{inr(d.funds.from_spend_fund)}</Num>
        </Card>
      )}
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <h2 className="font-num text-[15px] font-semibold text-tx">Last 6 months</h2>
          <span className="text-[12px] text-tx-2">put away each month</span>
        </div>
        <div className="grid grid-cols-6 gap-2.5 items-end h-[132px]" role="img" aria-label={d.history.map(h => `${monthName(h.month)} ${inr(h.saved)}`).join(', ')}>
          {d.history.map((h, i) => (
            <div key={h.month} className="flex flex-col items-center justify-end gap-1 h-[132px]">
              <span className="font-num text-[11.5px] font-semibold text-tx">{h.saved >= 1000 ? Math.round(h.saved / 1000) + 'k' : Math.round(h.saved)}</span>
              <div className="w-full rounded-[6px]" style={{ height: `${Math.max(2, (h.saved / max) * 84)}px`, background: i === d.history.length - 1 ? 'var(--money)' : 'var(--money-soft)' }} />
              <span className="text-[11.5px] text-tx-2">{monthName(h.month).slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Note>Balances are estimates built from bank emails on top of the opening balance in settings. They leave out interest, and for funds marked "withdrawals not seen" they only ever go up, so check them against the bank now and then.</Note>
    </Page>
  );
}

/* ── Settings ────────────────────────────────────────── */

const FIELDS = [
  ['cap', 'Monthly spending cap (₹)', 'Includes rent.', 'number'],
  ['rent', 'Rent (₹)', 'Counted as a fixed amount each month. A bank debit of exactly this amount is skipped so rent is never counted twice.', 'number'],
  ['salary', 'Salary (₹)', 'Counted as a fixed inflow. Any credit close to this amount is skipped.', 'number'],
  ['salary_day', 'Salary credit day', 'Day of the month, 1 to 31.', 'number'],
  ['own_names', 'Your name as banks print it', 'Comma separated, for example the first 8 to 10 letters. Transfers to or from these names count as moving your own money.', 'text'],
  ['spend_fund_last4', 'Spend-fund account, last 4 digits', 'Payments from this account sit outside the cap.', 'text'],
  ['usd_rate', 'Rupees per US dollar', 'Used to estimate dollar charges, which arrive without a rupee amount. Include your card\'s forex markup.', 'number'],
  ['emergency_opening', 'Emergency fund opening balance (₹)', 'What the recurring deposit holds on the date below. Leave 0 to count only what Money has seen.', 'number'],
  ['trip_opening', 'Trip fund opening balance (₹)', 'Balance of the trip-fund account on the date below.', 'number'],
  ['spend_opening', 'Spend fund opening balance (₹)', 'Balance of the spend-fund account on the date below. Leave 0 if Money has seen the account since it was opened.', 'number'],
  ['balances_as_of', 'Opening balances as of', 'Only transfers after this date are added on top. Set to today when you first enter balances.', 'date'],
  ['untracked_cards', 'Cards that send no email alerts', 'Comma separated. Shown as not tracked so totals are never silently wrong.', 'text'],
];

export function MoneySettings() {
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.moneySettings().then(s => setForm({ ...s, own_names: s.own_names.join(', '), untracked_cards: s.untracked_cards.join(', ') })).catch(e => setError(e.message));
  }, []);
  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await api.saveMoneySettings(form); navigate('/money'); } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return (
    <Page title="Money settings" lead="Set once. Stored on your server only.">
      {!form && <State data={form} error={error} />}
      {form && (
        <form onSubmit={save} className="flex flex-col gap-3">
          <Card className="p-4 flex flex-col gap-4">
            {FIELDS.map(([key, label, help, type]) => (
              <div key={key}>
                <label htmlFor={`ms-${key}`} className="block text-[13.5px] font-medium text-tx">{label}</label>
                <input id={`ms-${key}`} type={type} inputMode={type === 'number' ? 'numeric' : undefined} min={type === 'number' ? 0 : undefined}
                  value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className="w-full h-11 mt-1.5 px-3 rounded-[12px] border border-hair bg-card-2 text-tx text-[16px] font-num outline-none focus:border-tx-3" />
                <p className="text-[12.5px] text-tx-2 mt-1 leading-snug">{help}</p>
              </div>
            ))}
          </Card>
          {error && <p role="alert" className="text-[13px] text-danger px-1">{error}</p>}
          <button type="submit" disabled={saving} className="h-12 rounded-[12px] bg-tx text-page text-[15px] font-semibold press-scale">{saving ? 'Saving…' : 'Save'}</button>
        </form>
      )}
    </Page>
  );
}
