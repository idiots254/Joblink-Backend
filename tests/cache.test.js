const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const cacheModulePath = path.resolve(__dirname, '..', 'cache.js');

test('does not warn when Redis is not explicitly configured', async () => {
  delete process.env.REDIS_URL;
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_ENABLED;
  delete process.env.CACHE_BACKEND;
  delete require.cache[require.resolve(cacheModulePath)];

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const cache = require(cacheModulePath);
    await cache.initializeRedis();
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
    delete require.cache[require.resolve(cacheModulePath)];
  }
});
