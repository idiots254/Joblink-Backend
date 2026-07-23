const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidSendGridApiKey } = require('../config/emailVerification');

test('rejects placeholder and malformed SendGrid keys', () => {
  assert.equal(isValidSendGridApiKey(''), false);
  assert.equal(isValidSendGridApiKey('<SENDGRID_API_KEY_PLACEHOLDER>'), false);
  assert.equal(isValidSendGridApiKey('abc123'), false);
  assert.equal(isValidSendGridApiKey('SG.abc123.def456'), true);
});
