const { test } = require('node:test');
const assert = require('node:assert');

test('session tokens: valid, tampered, expired', () => {
  process.env.APP_PASSWORD = 'test-password';
  const { makeToken, validToken } = require('../auth');
  const tok = makeToken();
  assert.equal(validToken(tok), true);
  assert.equal(validToken(tok.slice(0, -1) + (tok.endsWith('a') ? 'b' : 'a')), false);
  assert.equal(validToken('1.' + tok.split('.')[1]), false);
  assert.equal(validToken(''), false);
  assert.equal(validToken('garbage'), false);
});
