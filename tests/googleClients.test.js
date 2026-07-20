const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGoogleAudienceList } = require('../config/googleClients');

test('buildGoogleAudienceList keeps the configured web and android client IDs', () => {
  const list = buildGoogleAudienceList({
    GOOGLE_CLIENT_ID: 'web-client.apps.googleusercontent.com',
    GOOGLE_ANDROID_CLIENT_ID: 'android-client.apps.googleusercontent.com',
  });

  assert.ok(list.includes('web-client.apps.googleusercontent.com'));
  assert.ok(list.includes('android-client.apps.googleusercontent.com'));
  assert.ok(list.includes('1053677464000-2sbmgpffk5qjtmpmtkj093uhkvrfnbsn.apps.googleusercontent.com'));
});
