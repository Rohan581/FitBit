const { test } = require('node:test');
const assert = require('node:assert');
const { parseEmail, parseDate, cleanPayee } = require('../money/parse');

// Synthetic emails in the same wording the banks use. No real account data.
const mail = (from, text, subject = '', date = '2026-01-15T07:05:48Z') => ({ id: 'x', from, subject, date, text });

test('dates in every format the banks use', () => {
  assert.equal(parseDate('13 Nov, 2026'), '2026-11-13');
  assert.equal(parseDate('Nov 14, 2026'), '2026-11-14');
  assert.equal(parseDate('12-11-26'), '2026-11-12');
  assert.equal(parseDate('14/11/2026'), '2026-11-14');
  assert.equal(parseDate('01-NOV-2026'), '2026-11-01');
  assert.equal(parseDate('nonsense'), null);
});

test('HDFC card spend', () => {
  const p = parseEmail(mail('alerts@hdfcbank.bank.in',
    'Dear Customer, Greetings from HDFC Bank. We would like to inform you that Rs. 1,470.35 has been debited from your HDFC Bank Credit Card ending 1111 towards PYU*Corner Grocery on 13 Jan, 2026 at 12:35:39. To check your available balance'));
  assert.equal(p.kind, 'tx');
  assert.deepEqual([p.bank, p.instrument, p.last4, p.direction, p.amount, p.date, p.time, p.payee],
    ['HDFC', 'card', '1111', 'out', 1470.35, '2026-01-13', '12:35:39', 'Corner Grocery']);
});

test('HDFC UPI debit takes the name in brackets', () => {
  const p = parseEmail(mail('alerts@hdfcbank.bank.in',
    'Rs.100.00 is debited from your account ending 2222 towards VPA ******1234@ybl (Tea stall) on 12-01-26. UPI transaction reference no.: 123456789012.'));
  assert.deepEqual([p.instrument, p.last4, p.direction, p.amount, p.date, p.payee, p.channel],
    ['account', '2222', 'out', 100, '2026-01-12', 'Tea Stall', 'upi']);
});

test('HDFC credit', () => {
  const p = parseEmail(mail('alerts@hdfcbank.bank.in',
    "We're writing to inform you that Rs.190.00 has been successfully credited to your HDFC Bank account ending in 2222. Transaction Details: a. Date: 18-01-26 b. Sender: SAMPLE PERSON (VPA: ****03-1@okicici) c. UPI Reference No.: 665732473524 Need Help?"));
  assert.deepEqual([p.direction, p.amount, p.date, p.payee], ['in', 190, '2026-01-18', 'Sample Person']);
});

test('HDFC recurring deposit is hinted as rd', () => {
  const p = parseEmail(mail('alerts@hdfcbank.bank.in',
    'Rs. INR 5,000.00 is deducted from your account ending XX2222 and added to XXXXXXXXXX9999- RD Installment-Jan 2026 account on 01-JAN-2026. The available balance in your account is Rs. INR 10.00.'));
  assert.deepEqual([p.hint, p.amount, p.date, p.last4], ['rd', 5000, '2026-01-01', '2222']);
});

test('HDFC e-mandate notices are ignored, not double counted', () => {
  assert.equal(parseEmail(mail('alerts@hdfcbank.bank.in', 'Your Hosting bill, set up through E-mandate (Auto payment), has been successfully paid using your HDFC Bank Credit Card ending 1111. Transaction Details: Amount Rs. 470.35 debited')).kind, 'ignore');
  assert.equal(parseEmail(mail('alerts@hdfcbank.bank.in', 'There is an upcoming E-mandate (Auto payment) of USD 5.00 for Hosting. Amount will be debited from your HDFC Bank Credit Card ending 1111')).kind, 'ignore');
});

test('an HDFC money email in unknown wording is flagged, never guessed', () => {
  assert.equal(parseEmail(mail('alerts@hdfcbank.bank.in', 'Rs. 900.00 was debited in some brand new sentence shape')).kind, 'unparsed');
  assert.equal(parseEmail(mail('alerts@hdfcbank.bank.in', 'Your statement is ready')).kind, 'ignore');
});

test('ICICI card alert and standing instruction', () => {
  const a = parseEmail(mail('credit_cards@icici.bank.in',
    'Dear Customer, Your ICICI Bank Credit Card XX3333 has been used for a transaction of INR 1,004.00 on Jan 14, 2026 at 04:21:21. Info: ONLINE STORE IN. The Available Credit Limit on your card is INR 1.00'));
  assert.deepEqual([a.last4, a.amount, a.date, a.payee, a.channel], ['3333', 1004, '2026-01-14', 'Online Store', 'card']);
  const b = parseEmail(mail('cards@icici.bank.in',
    'We have successfully processed your payment of INR 130.00 towards Streaming Co - Content Purchase Services, with Standing Instruction AbCdEf, on 14/01/2026, through your ICICI Bank Credit Card 3333. Click here'));
  assert.deepEqual([b.last4, b.amount, b.date, b.payee, b.channel], ['3333', 130, '2026-01-14', 'Streaming Co', 'si']);
});

test('Axis debit and credit', () => {
  const d = parseEmail(mail('alerts@axis.bank.in',
    "03-01-2026 Dear Sample, Here's the summary of your transaction: Amount Debited: INR 600.00 Account Number: XX4444 Date & Time: 03-01-26, 21:18:35 IST Transaction Info: UPI/P2A/630790849117/SOME SHOP If this transaction was not initiated by you:"));
  assert.deepEqual([d.bank, d.last4, d.direction, d.amount, d.date, d.time, d.payee], ['Axis', '4444', 'out', 600, '2026-01-03', '21:18:35', 'Some Shop']);
  const c = parseEmail(mail('alerts@axis.bank.in',
    "Here's the summary of your transaction: Amount Credited: INR 10500.00 Account Number: XX4444 Date & Time: 31-01-26, 17:21:53 IST Transaction Info: UPI/P2A/667015766240/SAMPLE PER/HDFC/Paid Feel free to connect with us"));
  assert.deepEqual([c.direction, c.amount, c.payee], ['in', 10500, 'Sample Per']);
});

test('Splitwise settlement becomes a hint dated in IST', () => {
  const p = parseEmail(mail('hello@splitwise.com', 'whatever', 'Sample Friend paid you ₹3,026.71 on Splitwise', '2026-01-31T19:30:00Z'));
  assert.deepEqual([p.kind, p.hint, p.amount, p.date], ['hint', 'splitwise', 3026.71, '2026-02-01']);
});

test('Amex: dollar charge keeps its currency, rupee charge does not, OTPs are ignored', () => {
  const from = 'donotreply@communication.americanexpress.co.in';
  const usd = parseEmail(mail(from, "A transaction has been initiated on your Card. \u034f \u00ad Dear Card Member, We're reaching out to notify you about a recent transaction that has been initiated on your American Express® Card ending in 9999. You can find the details below. | Date: | | 15-01-2026 | | Merchant: | | =SOFTWARE CO | | Amount: | | USD 23.60 | If you do not recognize"));
  assert.deepEqual([usd.kind, usd.bank, usd.last4, usd.date, usd.payee, usd.currency, usd.amount_orig], ['tx', 'Amex', '9999', '2026-01-15', 'Software Co', 'USD', 23.6]);
  const inr = parseEmail(mail(from, 'a recent transaction that has been initiated on your American Express® Card ending in 9999. Date: 16-01-2026 Merchant: CORNER SHOP Amount: INR 1,250.00 If you'));
  assert.deepEqual([inr.amount, inr.currency, inr.payee], [1250, undefined, 'Corner Shop']);
  assert.equal(parseEmail(mail('Donotreply@welcome.americanexpress.co.in', 'Your One-Time Password for INR 500.00 at Shop is: 123456')).kind, 'ignore');
  assert.equal(parseEmail(mail(from, 'A transaction has been initiated on your Card. Brand new layout nobody has seen')).kind, 'unparsed');
});

test('unknown senders are ignored', () => {
  assert.equal(parseEmail(mail('news@example.com', 'Rs. 500 debited')).kind, 'ignore');
});

test('payee cleaning', () => {
  assert.equal(cleanPayee('RSP*SOME FOOD PVT LTD'), 'Some Food Pvt Ltd');
  assert.equal(cleanPayee(''), 'Unknown');
});
