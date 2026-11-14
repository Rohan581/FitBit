const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { todayIST } = require('../dateUtils');
const { parseEmail } = require('../money/parse');
const { CATEGORIES, classify, findDuplicates } = require('../money/classify');
const { safeEqual } = require('../auth');

const COUNTED_SOURCES = ['HDFC', 'ICICI', 'Axis'];
const DEFAULTS = { cap: 0, rent: 0, salary: 0, salary_day: 1, own_names: [], spend_fund_last4: '', untracked_cards: [] };
const round = n => Math.round(n * 100) / 100;

function getSettings(db) {
  const row = db.prepare("SELECT value FROM money_settings WHERE key = 'settings'").get();
  let saved = {};
  try { saved = row ? JSON.parse(row.value) : {}; } catch {}
  return Object.assign({}, DEFAULTS, saved);
}
function setKV(db, key, value) {
  db.prepare('INSERT INTO money_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { start: `${month}-01`, end: `${next}-01`, days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}
function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}
function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function validMonth(q) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(q || '') ? q : todayIST().slice(0, 7); }

// Recomputes type, fund and category for every row from its raw fields, then runs the
// passes that need more than one row. Cheap for a single user, and it means changing a
// rule or a setting re-sorts history too.
function reclassifyAll(db) {
  const s = getSettings(db);
  const rules = db.prepare('SELECT pattern, category FROM money_rules').all();
  const rows = db.prepare('SELECT * FROM money_tx ORDER BY date, time, id').all();
  const upd = db.prepare('UPDATE money_tx SET type = ?, fund = ?, category = ? WHERE id = ?');
  const dupes = findDuplicates(rows);
  const state = new Map();
  for (const r of rows) {
    const c = dupes.has(r.id) ? { type: 'duplicate', fund: null, category: null } : classify(r, s, rules);
    state.set(r.id, Object.assign({}, r, c));
  }
  const live = [...state.values()].filter(r => r.type !== 'duplicate');

  // A move into the spend-fund account shows up twice: the debit on the main account
  // (saved, fund defaults to trip) and the credit on the fund account (transfer). Pair them.
  if (s.spend_fund_last4) {
    const used = new Set();
    for (const cr of live.filter(r => r.type === 'transfer' && r.last4 === s.spend_fund_last4)) {
      const match = live.find(r => r.type === 'saved' && r.fund === 'trip' && !used.has(r.id) &&
        Math.abs(r.amount - cr.amount) < 1 && r.date >= addDays(cr.date, -1) && r.date <= addDays(cr.date, 1));
      if (match) { used.add(match.id); match.fund = 'spend'; }
    }
  }

  // Splitwise settlements: find bank credits around the settlement date that add up to it.
  const hints = db.prepare("SELECT * FROM money_hints WHERE kind = 'splitwise' ORDER BY date, id").all();
  const taken = new Set();
  for (const h of hints) {
    const pool = live.filter(r => r.type === 'money_in' && !taken.has(r.id) &&
      r.date >= addDays(h.date, -1) && r.date <= addDays(h.date, 3)).slice(0, 12);
    const tol = Math.max(5, h.amount * 0.002);
    let best = null;
    for (let mask = 1; mask < (1 << pool.length); mask++) {
      let sum = 0; const pick = [];
      for (let i = 0; i < pool.length; i++) if (mask & (1 << i)) { sum += pool[i].amount; pick.push(pool[i]); }
      if (Math.abs(sum - h.amount) <= tol && (!best || pick.length < best.length)) best = pick;
    }
    if (best) for (const r of best) { taken.add(r.id); r.type = 'reimbursement'; }
  }

  db.transaction(() => { for (const r of state.values()) upd.run(r.type, r.fund, r.category, r.id); })();
}

// ── Ingest: called by the Gmail forwarder script, authenticated by its own key ──
router.post('/ingest', (req, res) => {
  const key = process.env.MONEY_INGEST_KEY || '';
  if (!key) return res.status(503).json({ error: 'Set MONEY_INGEST_KEY on the server.' });
  if (!safeEqual(req.get('x-ingest-key') || '', key)) return res.status(401).json({ error: 'Bad ingest key' });
  const emails = Array.isArray(req.body && req.body.emails) ? req.body.emails.slice(0, 200) : [];
  const db = getDB();
  const insTx = db.prepare(`INSERT OR IGNORE INTO money_tx
    (source_id, source, bank, instrument, last4, direction, amount, payee_raw, payee, date, time, channel, hint)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insHint = db.prepare('INSERT OR IGNORE INTO money_hints (source_id, kind, amount, date) VALUES (?, ?, ?, ?)');
  const insUnparsed = db.prepare('INSERT OR IGNORE INTO money_unparsed (source_id, source, subject, snippet, date) VALUES (?, ?, ?, ?, ?)');
  const seen = db.prepare('INSERT INTO money_source_seen (source, last_seen) VALUES (?, ?) ON CONFLICT(source) DO UPDATE SET last_seen = MAX(last_seen, excluded.last_seen)');
  const counts = { added: 0, already: 0, ignored: 0, unparsed: 0, hints: 0 };
  db.transaction(() => {
    for (const mail of emails) {
      if (!mail || !mail.id) continue;
      const p = parseEmail(mail);
      const sid = String(mail.id);
      if (p.kind === 'tx') {
        const r = insTx.run(sid, p.source, p.bank, p.instrument, p.last4, p.direction, p.amount,
          String(p.payee_raw).slice(0, 120), p.payee.slice(0, 120), p.date, p.time, p.channel, p.hint);
        if (r.changes) counts.added++; else counts.already++;
        seen.run(p.source, p.date);
      } else if (p.kind === 'hint') {
        if (insHint.run(sid, p.hint, p.amount, p.date).changes) counts.hints++;
      } else if (p.kind === 'unparsed') {
        insUnparsed.run(sid, p.source, String(mail.subject || '').slice(0, 200), String(mail.text || '').replace(/\s+/g, ' ').slice(0, 400), String(mail.date || '').slice(0, 10));
        counts.unparsed++;
      } else counts.ignored++;
    }
  })();
  setKV(db, 'last_ingest_at', new Date().toISOString());
  reclassifyAll(db);
  res.json(counts);
});

function monthFigures(db, month, s) {
  const { start, end, days } = monthRange(month);
  const rows = db.prepare("SELECT * FROM money_tx WHERE date >= ? AND date < ? AND type != 'duplicate'").all(start, end);
  const sum = t => rows.filter(r => r.type === t).reduce((a, r) => a + r.amount, 0);
  const cats = {};
  for (const r of rows) {
    if (r.type !== 'spend' && r.type !== 'refund') continue;
    const k = r.category || 'Uncategorised';
    cats[k] = (cats[k] || 0) + (r.type === 'spend' ? r.amount : -r.amount);
  }
  if (s.rent > 0) cats['Rent and utilities'] = (cats['Rent and utilities'] || 0) + s.rent;
  const variable = sum('spend') - sum('refund') - sum('reimbursement');
  return { rows, days, cats, variable, sum, hasData: rows.length > 0 };
}

router.get('/month', (req, res) => {
  const db = getDB();
  const s = getSettings(db);
  const month = validMonth(req.query.month);
  const today = todayIST();
  const cur = month === today.slice(0, 7);
  const f = monthFigures(db, month, s);
  const day = cur ? Number(today.slice(8, 10)) : (month < today.slice(0, 7) ? f.days : 0);
  const rent = s.rent || 0;
  const spent = rent + f.variable;
  const varBudget = Math.max(0, (s.cap || 0) - rent);
  const expected = varBudget * day / f.days;
  const daysLeft = Math.max(1, f.days - day + 1);
  const salaryIn = s.salary > 0 && (!cur || day >= (s.salary_day || 1)) ? s.salary : 0;

  const prev = [1, 2, 3].map(i => monthFigures(db, shiftMonth(month, -i), s)).filter(p => p.hasData);
  const categories = Object.entries(f.cats).map(([name, amount]) => {
    const avg = prev.length ? prev.reduce((a, p) => a + (p.cats[name] || 0), 0) / prev.length : null;
    return { name, amount: round(amount), vs_avg: avg === null ? null : round(amount - avg) };
  }).filter(c => Math.abs(c.amount) >= 0.5).sort((a, b) => b.amount - a.amount);

  res.json({
    month, is_current: cur, day, days_in_month: f.days, configured: s.cap > 0,
    cap: s.cap, rent, variable: round(f.variable), spent: round(spent), left: round(s.cap - spent),
    expected_variable: round(expected), over_pace: round(f.variable - expected),
    per_day_left: round(Math.max(0, s.cap - spent) / daysLeft),
    inflow: round(salaryIn + f.sum('money_in')), salary: salaryIn,
    saved: round(f.sum('saved') + f.sum('invested')),
    reimbursed: round(f.sum('reimbursement')), from_spend_fund: round(f.sum('spend_fund')),
    categories,
    review_count: db.prepare("SELECT COUNT(*) c FROM money_tx WHERE type IN ('spend','spend_fund') AND category IS NULL").get().c,
    untracked_cards: s.untracked_cards || [],
    last_sync: (db.prepare("SELECT value FROM money_settings WHERE key = 'last_ingest_at'").get() || {}).value || null,
  });
});

router.get('/transactions', (req, res) => {
  const db = getDB();
  const { start, end } = monthRange(validMonth(req.query.month));
  const rows = db.prepare(`SELECT id, date, time, amount, direction, bank, instrument, last4, channel, payee, type, fund, category
    FROM money_tx WHERE date >= ? AND date < ? AND type != 'duplicate' ORDER BY date DESC, time DESC, id DESC`).all(start, end);
  res.json({ transactions: rows });
});

router.get('/review', (req, res) => {
  const db = getDB();
  const s = getSettings(db);
  const today = todayIST();
  const items = db.prepare(`SELECT id, date, amount, bank, instrument, last4, channel, payee FROM money_tx
    WHERE type IN ('spend','spend_fund') AND category IS NULL ORDER BY date DESC, id DESC LIMIT 50`).all();
  const popular = db.prepare(`SELECT category, COUNT(*) c FROM money_tx WHERE type = 'spend' AND category IS NOT NULL GROUP BY category ORDER BY c DESC`).all().map(r => r.category);
  const seenRows = db.prepare('SELECT source, last_seen FROM money_source_seen').all();
  const sources = COUNTED_SOURCES.map(src => {
    const row = seenRows.find(r => r.source === src);
    return { source: src, last_seen: row ? row.last_seen : null, stale: !row || row.last_seen < addDays(today, -7) };
  });
  res.json({
    items, categories: CATEGORIES,
    suggested: [...new Set([...popular, 'Food delivery and eating out', 'Shopping', 'Groceries'])].filter(c => c !== 'Rent and utilities').slice(0, 3),
    sources,
    unparsed: db.prepare('SELECT COUNT(*) c FROM money_unparsed').get().c,
    unparsed_recent: db.prepare('SELECT source, subject, date FROM money_unparsed ORDER BY id DESC LIMIT 5').all(),
    untracked_cards: s.untracked_cards || [],
  });
});

router.post('/review/:id/category', (req, res) => {
  const db = getDB();
  const category = req.body && req.body.category;
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category' });
  const row = db.prepare('SELECT payee FROM money_tx WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare(`INSERT INTO money_rules (pattern, category, is_default) VALUES (?, ?, 0)
    ON CONFLICT(pattern) DO UPDATE SET category = excluded.category, is_default = 0`).run(row.payee.toLowerCase(), category);
  reclassifyAll(db);
  res.json({ ok: true });
});

router.get('/recurring', (req, res) => {
  const db = getDB();
  const s = getSettings(db);
  const rows = db.prepare("SELECT payee, amount, date, bank, last4, channel FROM money_tx WHERE type IN ('spend','spend_fund') ORDER BY date").all();
  const by = new Map();
  for (const r of rows) { if (!by.has(r.payee)) by.set(r.payee, []); by.get(r.payee).push(r); }
  const subs = [];
  const cutoff = addDays(todayIST(), -45);
  for (const [payee, list] of by) {
    const last = list[list.length - 1];
    const months = new Set(list.filter(r => Math.abs(r.amount - last.amount) <= last.amount * 0.15).map(r => r.date.slice(0, 7)));
    const isSI = list.some(r => r.channel === 'si');
    if ((isSI || months.size >= 2) && last.date >= cutoff) {
      const d = new Date(last.date + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1);
      subs.push({ payee, amount: last.amount, bank: last.bank, last4: last.last4, last_date: last.date, next_date: d.toISOString().slice(0, 10) });
    }
  }
  subs.sort((a, b) => b.amount - a.amount);
  const rd = db.prepare("SELECT amount FROM money_tx WHERE type = 'saved' AND fund = 'emergency' ORDER BY date DESC LIMIT 1").get();
  res.json({
    subscriptions: subs, monthly_total: round(subs.reduce((a, r) => a + r.amount, 0)),
    fixed: { salary: s.salary || 0, rent: s.rent || 0, recurring_deposit: rd ? rd.amount : 0 },
    untracked_cards: s.untracked_cards || [],
  });
});

router.get('/savings', (req, res) => {
  const db = getDB();
  const s = getSettings(db);
  const month = validMonth(req.query.month);
  const totals = m => {
    const { start, end } = monthRange(m);
    const rows = db.prepare("SELECT type, fund, amount FROM money_tx WHERE date >= ? AND date < ? AND type IN ('saved','invested','spend_fund')").all(start, end);
    const sum = fn => round(rows.filter(fn).reduce((a, r) => a + r.amount, 0));
    return {
      emergency: sum(r => r.type === 'saved' && r.fund === 'emergency'),
      trip: sum(r => r.type === 'saved' && r.fund === 'trip'),
      spend: sum(r => r.type === 'saved' && r.fund === 'spend'),
      invested: sum(r => r.type === 'invested'),
      from_spend_fund: sum(r => r.type === 'spend_fund'),
    };
  };
  const t = totals(month);
  const put = round(t.emergency + t.trip + t.spend + t.invested);
  const history = [5, 4, 3, 2, 1, 0].map(i => {
    const m = shiftMonth(month, -i); const x = totals(m);
    return { month: m, saved: round(x.emergency + x.trip + x.spend + x.invested) };
  });
  res.json({
    month, funds: t, put_away: put, salary: s.salary || 0,
    share_of_salary: s.salary > 0 ? Math.round(put / s.salary * 100) : null,
    free_to_put_away: s.salary > 0 && s.cap > 0 ? round(Math.max(0, s.salary - s.cap - put)) : null,
    cap: s.cap || 0, history,
  });
});

router.get('/settings', (req, res) => res.json(getSettings(getDB())));

router.put('/settings', (req, res) => {
  const b = req.body || {};
  const num = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };
  const list = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(Boolean).slice(0, 12);
  const next = {
    cap: num(b.cap, 1e8), rent: num(b.rent, 1e8), salary: num(b.salary, 1e9),
    salary_day: Math.min(31, Math.max(1, Math.round(num(b.salary_day, 31)) || 1)),
    own_names: list(b.own_names), untracked_cards: list(b.untracked_cards),
    spend_fund_last4: /^\d{4}$/.test(String(b.spend_fund_last4 || '')) ? String(b.spend_fund_last4) : '',
  };
  const db = getDB();
  setKV(db, 'settings', JSON.stringify(next));
  reclassifyAll(db);
  res.json(next);
});

module.exports = router;
module.exports.reclassifyAll = reclassifyAll;
