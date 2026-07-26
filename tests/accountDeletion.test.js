const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldDeleteAuthUser } = require('../routes/account');

test('preserves the Supabase auth identity when removing a profile account', () => {
  assert.equal(shouldDeleteAuthUser(), false);
});
