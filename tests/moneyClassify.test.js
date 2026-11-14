const { test } = require('node:test');
const assert = require('node:assert');
const { classify, categorise, findDuplicates } = require('../money/classify');

const S = { rent: 20000, salary: 100000, own_names: ['sample per'], spend_fund_last4: '4444' };
const RULES = [{ pattern: 'grocery', category: 'Groceries' }, { pattern: 'corner grocery', category: 'Shopping' }];
const t = o => Object.assign({ instrument: 'account', last4: '2222', direction: 'out', amount: 100, payee: 'Someone', hint: null }, o);

test('card spends and refunds', () => {
  assert.equal(classify(t({ instrument: 'card', payee: 'Big Grocery' }), S, RULES).type, 'spend');
  assert.equal(classify(t({ instrument: 'card', payee: 'Big Grocery' }), S, RULES).category, 'Groceries');
  assert.equal(classify(t({ instrument: 'card', direction: 'in' }), S, RULES).type, 'refund');
});

test('the longest matching rule wins', () => {
  assert.equal(categorise('Corner Grocery', RULES), 'Shopping');
  assert.equal(categorise('Nothing known', RULES), null);
});

test('money that is not spending', () => {
  assert.deepEqual(classify(t({ hint: 'rd' }), S, RULES), { type: 'saved', fund: 'emergency', category: null });
  assert.equal(classify(t({ payee: 'Sample Person' }), S, RULES).type, 'saved');
  assert.equal(classify(t({ payee: 'Zerodha Broking' }), S, RULES).type, 'invested');
  assert.equal(classify(t({ payee: 'Cred Club' }), S, RULES).type, 'card_payment');
  assert.equal(classify(t({ amount: 20000, payee: 'Landlord' }), S, RULES).type, 'rent_payment');
});

test('spend-fund account spends sit outside the cap', () => {
  assert.equal(classify(t({ last4: '4444', payee: 'Some Shop' }), S, RULES).type, 'spend_fund');
  assert.equal(classify(t({ last4: '2222', payee: 'Some Shop' }), S, RULES).type, 'spend');
});

test('credits', () => {
  assert.equal(classify(t({ direction: 'in', payee: 'Sample Per' }), S, RULES).type, 'transfer');
  assert.equal(classify(t({ direction: 'in', amount: 100000, payee: 'Employer' }), S, RULES).type, 'salary_credit');
  assert.equal(classify(t({ direction: 'in', amount: 500, payee: 'A Friend' }), S, RULES).type, 'money_in');
});

test('works with empty settings', () => {
  assert.equal(classify(t({ amount: 20000 }), {}, []).type, 'spend');
});

test('duplicates: two alerts within 10 minutes, and a standing-instruction notice', () => {
  const rows = [
    { id: 1, date: '2026-01-13', time: '12:35:39', last4: '1111', direction: 'out', amount: 470.35, channel: 'card' },
    { id: 2, date: '2026-01-13', time: '12:37:00', last4: '1111', direction: 'out', amount: 470.35, channel: 'card' },
    { id: 3, date: '2026-01-13', time: '19:00:00', last4: '1111', direction: 'out', amount: 470.35, channel: 'card' },
    { id: 4, date: '2026-01-14', time: '02:24:06', last4: '3333', direction: 'out', amount: 130, channel: 'si' },
    { id: 5, date: '2026-01-14', time: '09:51:21', last4: '3333', direction: 'out', amount: 130, channel: 'card' },
    { id: 6, date: '2026-01-14', time: '10:00:00', last4: '3333', direction: 'out', amount: 131, channel: 'card' },
  ];
  assert.deepEqual([...findDuplicates(rows)].sort(), [2, 4]);
});
