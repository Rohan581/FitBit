// Turns one bank alert email into a transaction, a hint, or nothing.
// Pure functions, no I/O: everything here is covered by tests/moneyParse.test.js.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = n => String(n).padStart(2, '0');
const amt = s => Number(String(s).replace(/,/g, ''));
const norm = s => String(s || '').replace(/[\u034f\u00ad\u200b-\u200d\ufeff]/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function year4(y) { y = Number(y); return y < 100 ? 2000 + y : y; }
// "13 Nov, 2026" | "Nov 14, 2026" | "12-11-26" | "14/11/2026" | "01-NOV-2026"  ->  "2026-11-13"
function parseDate(s) {
  if (!s) return null;
  s = s.trim();
  let m;
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})$/))) return iso(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  if ((m = s.match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/))) return iso(m[3], MONTHS[m[1].toLowerCase()], m[2]);
  if ((m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/))) return iso(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/))) return iso(m[3], m[2], m[1]);
  return null;
}
function iso(y, mo, d) {
  mo = Number(mo); d = Number(d);
  if (!mo || mo > 12 || !d || d > 31) return null;
  return `${year4(y)}-${pad(mo)}-${pad(d)}`;
}
// Email timestamp (ISO, UTC) -> { date, time } in IST.
function istParts(isoDate) {
  const t = new Date(isoDate);
  if (isNaN(t)) return { date: null, time: null };
  const ist = new Date(t.getTime() + 330 * 60000).toISOString();
  return { date: ist.slice(0, 10), time: ist.slice(11, 19) };
}

function cleanPayee(raw) {
  let s = norm(raw).replace(/^[A-Z]{2,4}\*\s*/, '').replace(/\s+(IN|IND|INDIA)$/i, '');
  if (!s) return 'Unknown';
  return s.toLowerCase().replace(/(^|[\s\-/.])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

function tx(base) {
  return Object.assign({ kind: 'tx', channel: 'other', hint: null, time: null }, base, { payee: cleanPayee(base.payee_raw) });
}

function parseHDFC(text, mail) {
  let m;
  if (/upcoming E-mandate|E-mandate \(Auto payment\)/i.test(text)) return { kind: 'ignore' };
  if ((m = text.match(/Rs\.?\s*([\d,]+\.?\d*) has been debited from your HDFC Bank Credit Card ending (\d{4}) towards (.+?) on (\d{1,2} [A-Za-z]{3},? \d{4}) at (\d{2}:\d{2}:\d{2})/i))) {
    return tx({ bank: 'HDFC', instrument: 'card', last4: m[2], direction: 'out', amount: amt(m[1]), payee_raw: m[3], date: parseDate(m[4]), time: m[5], channel: 'card' });
  }
  if ((m = text.match(/Rs\.?\s*(?:INR\s*)?([\d,]+\.?\d*) is deducted from your account ending X*(\d{4}) and added to \S+\s*-?\s*RD Installment.*? on (\d{1,2}-[A-Za-z]{3}-\d{4})/i))) {
    return tx({ bank: 'HDFC', instrument: 'account', last4: m[2], direction: 'out', amount: amt(m[1]), payee_raw: 'Recurring deposit', date: parseDate(m[3]), channel: 'transfer', hint: 'rd' });
  }
  if ((m = text.match(/Rs\.?\s*([\d,]+\.?\d*) is debited from your account ending (\d{4}) towards (.+?) on (\d{2}-\d{2}-\d{2,4})/i))) {
    const vpa = m[3].match(/^VPA \S+ \((.+)\)$/i);
    return tx({ bank: 'HDFC', instrument: 'account', last4: m[2], direction: 'out', amount: amt(m[1]), payee_raw: vpa ? vpa[1] : m[3].replace(/^VPA\s+/i, ''), date: parseDate(m[4]), channel: 'upi' });
  }
  if ((m = text.match(/Rs\.?\s*([\d,]+\.?\d*) has been successfully credited to your HDFC Bank account ending in (\d{4})/i))) {
    const d = text.match(/Date:\s*(\d{2}-\d{2}-\d{2,4})/i);
    const s = text.match(/Sender:\s*(.+?)(?:\s*\(VPA|\s+[a-z]\.\s|\s+Need Help|$)/i);
    return tx({ bank: 'HDFC', instrument: 'account', last4: m[2], direction: 'in', amount: amt(m[1]), payee_raw: s ? s[1] : 'Unknown sender', date: d ? parseDate(d[1]) : null, channel: 'upi' });
  }
  if (/\b(debited|credited|deducted)\b/i.test(text) && /Rs\.?\s*(?:INR\s*)?[\d,]+/i.test(text)) return { kind: 'unparsed' };
  return { kind: 'ignore' };
}

function parseICICI(text, mail) {
  let m;
  if ((m = text.match(/Credit Card X*(\d{4}) has been used for a transaction of INR ([\d,]+\.?\d*) on ([A-Za-z]{3} \d{1,2},? \d{4}) at (\d{2}:\d{2}:\d{2})\. Info: (.+?)\.\s/i))) {
    return tx({ bank: 'ICICI', instrument: 'card', last4: m[1], direction: 'out', amount: amt(m[2]), payee_raw: m[5], date: parseDate(m[3]), time: m[4], channel: 'card' });
  }
  if ((m = text.match(/successfully processed your payment of INR ([\d,]+\.?\d*) towards (.+?), with Standing Instruction \S+, on (\d{2}\/\d{2}\/\d{4}), through your ICICI Bank Credit Card X*(\d{4})/i))) {
    return tx({ bank: 'ICICI', instrument: 'card', last4: m[4], direction: 'out', amount: amt(m[1]), payee_raw: m[2].replace(/\s*-\s.*$/, ''), date: parseDate(m[3]), channel: 'si' });
  }
  if (/transaction of INR/i.test(text)) return { kind: 'unparsed' };
  return { kind: 'ignore' };
}

function parseAxis(text, mail) {
  const m = text.match(/Amount (Debited|Credited):\s*INR ([\d,]+\.?\d*)\s*Account Number:\s*X*(\d{4})\s*Date & Time:\s*(\d{2}-\d{2}-\d{2,4}),\s*(\d{2}:\d{2}:\d{2})\s*IST\s*Transaction Info:\s*(.+?)(?=\s+(?:If this|Feel free|Call us|Always open)|$)/i);
  if (m) {
    const parts = m[6].split('/').map(s => s.trim());
    const isUpi = /^UPI$/i.test(parts[0]);
    const name = isUpi && parts[3] ? parts[3] : m[6];
    return tx({ bank: 'Axis', instrument: 'account', last4: m[3], direction: /debited/i.test(m[1]) ? 'out' : 'in', amount: amt(m[2]), payee_raw: name, date: parseDate(m[4]), time: m[5], channel: isUpi ? 'upi' : 'transfer' });
  }
  if (/Amount (Debited|Credited)/i.test(text)) return { kind: 'unparsed' };
  return { kind: 'ignore' };
}

// Amex sends one "transaction initiated" email per charge. Foreign charges carry only the
// foreign amount; the server converts them at the rate in Money settings and marks them estimated.
function parseAmex(text, mail) {
  const t = text.replace(/\|/g, ' ').replace(/\s+/g, ' ');
  const m = t.match(/transaction that has been initiated on your American Express.{0,3} Card ending in (\d{4,5})\b.*?Date:\s*(\d{2}-\d{2}-\d{4})\s*Merchant:\s*=?\s*(.+?)\s*Amount:\s*([A-Z]{3})\s*([\d,]+\.?\d*)/i);
  if (m) {
    const cur = m[4].toUpperCase();
    const out = tx({ bank: 'Amex', instrument: 'card', last4: m[1].slice(-4), direction: 'out', amount: amt(m[5]), payee_raw: m[3], date: parseDate(m[2]), channel: 'card' });
    if (cur !== 'INR') { out.currency = cur; out.amount_orig = out.amount; }
    return out;
  }
  if (/transaction has been initiated on your Card/i.test(t)) return { kind: 'unparsed' };
  return { kind: 'ignore' };
}

function parseSplitwise(text, mail) {
  const m = norm(mail.subject).match(/paid you ₹\s*([\d,]+\.?\d*) on Splitwise/i);
  if (m) return { kind: 'hint', hint: 'splitwise', amount: amt(m[1]) };
  return { kind: 'ignore' };
}

// mail = { id, from, subject, date (ISO), text }
function parseEmail(mail) {
  const from = String(mail.from || '').toLowerCase();
  const text = norm(mail.text);
  let out;
  if (from.includes('hdfcbank') || from.includes('hdfc.bank')) out = parseHDFC(text, mail);
  else if (from.includes('icici')) out = parseICICI(text, mail);
  else if (from.includes('axis')) out = parseAxis(text, mail);
  else if (from.includes('americanexpress')) out = parseAmex(text, mail);
  else if (from.includes('splitwise')) out = parseSplitwise(text, mail);
  else out = { kind: 'ignore' };

  const when = istParts(mail.date);
  if (out.kind === 'tx' || out.kind === 'hint') {
    out.date = out.date || when.date;
    out.time = out.time || when.time;
    if (!out.date || !(out.amount > 0)) return { kind: 'unparsed', source: sourceOf(from) };
  }
  out.source = sourceOf(from);
  return out;
}
function sourceOf(from) {
  if (from.includes('hdfc')) return 'HDFC';
  if (from.includes('icici')) return 'ICICI';
  if (from.includes('axis')) return 'Axis';
  if (from.includes('americanexpress')) return 'Amex';
  if (from.includes('splitwise')) return 'Splitwise';
  return 'Other';
}

module.exports = { parseEmail, parseDate, cleanPayee, istParts, norm };
