// Decides what a transaction is. Pure functions; see tests/moneyClassify.test.js.
//
// Types and how the Month view treats them:
//   spend          counts against the cap
//   refund         reduces spend
//   reimbursement  reduces spend (a Splitwise settlement landed in the bank)
//   spend_fund     paid from the spend-fund account: shown on its own line, outside the cap
//   saved          moved to your own savings (fund: emergency | trip | spend)
//   invested       sent to a broker
//   money_in       other income
//   card_payment, transfer, rent_payment, salary_credit, duplicate   never counted
//     (rent and salary are fixed amounts from Settings, so the matching bank rows are skipped)

const CATEGORIES = [
  'Rent and utilities', 'Groceries', 'Food delivery and eating out', 'Transport', 'Travel',
  'Shopping', 'Subscriptions', 'Health and fitness', 'Entertainment', 'Other',
];

// Starter rules: lowercase substring of the payee -> category. Editable in the app via Review.
const DEFAULT_RULES = [
  ['instamart', 'Groceries'], ['blinkit', 'Groceries'], ['zepto', 'Groceries'], ['bigbasket', 'Groceries'], ['dmart', 'Groceries'],
  ['swiggy', 'Food delivery and eating out'], ['zomato', 'Food delivery and eating out'], ['cafe', 'Food delivery and eating out'],
  ['coffee', 'Food delivery and eating out'], ['restaurant', 'Food delivery and eating out'], ['kitchen', 'Food delivery and eating out'],
  ['food', 'Food delivery and eating out'], ['bakery', 'Food delivery and eating out'], ['hospitality', 'Food delivery and eating out'],
  ['uber', 'Transport'], ['ola', 'Transport'], ['rapido', 'Transport'], ['metro', 'Transport'], ['petrol', 'Transport'], ['fuel', 'Transport'], ['fastag', 'Transport'],
  ['yatra', 'Travel'], ['makemytrip', 'Travel'], ['airbnb', 'Travel'], ['indigo', 'Travel'], ['irctc', 'Travel'], ['cleartrip', 'Travel'], ['booking.com', 'Travel'], ['flight', 'Travel'],
  ['amazon', 'Shopping'], ['flipkart', 'Shopping'], ['myntra', 'Shopping'], ['ajio', 'Shopping'],
  ['netflix', 'Subscriptions'], ['spotify', 'Subscriptions'], ['google play', 'Subscriptions'], ['youtube', 'Subscriptions'], ['zee', 'Subscriptions'], ['hotstar', 'Subscriptions'], ['apple.com', 'Subscriptions'],
  ['book my show', 'Entertainment'], ['bookmyshow', 'Entertainment'], ['pvr', 'Entertainment'], ['inox', 'Entertainment'],
  ['pharmacy', 'Health and fitness'], ['apollo', 'Health and fitness'], ['cult', 'Health and fitness'], ['hospital', 'Health and fitness'], ['clinic', 'Health and fitness'],
  ['electricity', 'Rent and utilities'], ['bescom', 'Rent and utilities'], ['airtel', 'Rent and utilities'], ['jio', 'Rent and utilities'], ['broadband', 'Rent and utilities'],
];

const BROKERS = /zerodha|groww|indmoney|kuvera|upstox|smallcase/i;
const CARD_BILL = /\bcred\b|credit ?card|card ?bill|cc ?payment|billdesk|amex|american express|sbi ?card|cardmember/i;

function matchesOwnName(payee, ownNames) {
  const p = String(payee || '').toLowerCase();
  return (ownNames || []).some(n => n && p.includes(n.toLowerCase()));
}

function categorise(payee, rules) {
  const p = String(payee || '').toLowerCase();
  let best = null;
  for (const r of rules || []) {
    if (r.pattern && p.includes(r.pattern) && (!best || r.pattern.length > best.pattern.length)) best = r;
  }
  return best ? best.category : null;
}

// t: { instrument, last4, direction, amount, payee, hint }
// s: { rent, salary, own_names: [], spend_fund_last4 }
function classify(t, s, rules) {
  s = s || {};
  const out = { type: 'spend', fund: null, category: null };
  if (t.hint === 'rd') return Object.assign(out, { type: 'saved', fund: 'emergency' });

  if (t.instrument === 'card') {
    out.type = t.direction === 'out' ? 'spend' : 'refund';
  } else if (t.direction === 'out') {
    if (matchesOwnName(t.payee, s.own_names)) {
      // Money leaving the spend-fund account for another of your accounts is not new saving.
      if (s.spend_fund_last4 && t.last4 === s.spend_fund_last4) return Object.assign(out, { type: 'transfer' });
      return Object.assign(out, { type: 'saved', fund: 'trip' });
    }
    if (BROKERS.test(t.payee)) return Object.assign(out, { type: 'invested' });
    if (CARD_BILL.test(t.payee)) return Object.assign(out, { type: 'card_payment' });
    if (s.rent > 0 && Math.abs(t.amount - s.rent) < 1) return Object.assign(out, { type: 'rent_payment' });
    out.type = s.spend_fund_last4 && t.last4 === s.spend_fund_last4 ? 'spend_fund' : 'spend';
  } else {
    if (matchesOwnName(t.payee, s.own_names)) return Object.assign(out, { type: 'transfer' });
    if (s.salary > 0 && t.amount >= 0.9 * s.salary) return Object.assign(out, { type: 'salary_credit' });
    return Object.assign(out, { type: 'money_in' });
  }
  if (['spend', 'spend_fund', 'refund'].includes(out.type)) out.category = categorise(t.payee, rules);
  return out;
}

// rows sorted by date,time. Marks the later of two alerts for one charge as a duplicate:
// same instrument, same amount, same direction, within 10 minutes; or a standing-instruction
// notice on the same day as a matching card alert.
function findDuplicates(rows) {
  const dupes = new Set();
  const secs = r => {
    const [h, m, s] = String(r.time || '00:00:00').split(':').map(Number);
    return h * 3600 + m * 60 + (s || 0);
  };
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    if (dupes.has(a.id)) continue;
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j];
      if (b.date !== a.date) break;
      if (dupes.has(b.id) || a.last4 !== b.last4 || a.direction !== b.direction || Math.abs(a.amount - b.amount) > 0.005) continue;
      const si = a.channel === 'si' || b.channel === 'si';
      if (si && a.channel !== b.channel) dupes.add(a.channel === 'si' ? a.id : b.id);
      else if (!si && a.time && b.time && Math.abs(secs(a) - secs(b)) <= 600) dupes.add(b.id);
    }
  }
  return dupes;
}

module.exports = { CATEGORIES, DEFAULT_RULES, classify, categorise, findDuplicates, matchesOwnName };
