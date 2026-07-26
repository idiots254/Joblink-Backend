const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const cacheModulePath = path.resolve(__dirname, '..', 'cache.js');

test('does not initialize Redis unless it is explicitly enabled', () => {
  delete process.env.REDIS_URL;
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_ENABLED;
  delete process.env.REDIS_PORT;
  delete process.env.CACHE_BACKEND;
  delete require.cache[require.resolve(cacheModulePath)];

  const cache = require(cacheModulePath);
  assert.equal(cache.resolveRedisUrl(), null);
});

test('falls back gracefully when Redis is enabled but unavailable', async () => {
  process.env.REDIS_ENABLED = 'true';
  process.env.REDIS_URL = 'redis://127.0.0.1:6380/0';
  process.env.NODE_ENV = 'test';
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_PORT;
  delete process.env.CACHE_BACKEND;
  delete require.cache[require.resolve(cacheModulePath)];

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const cache = require(cacheModulePath);
    const client = await cache.initializeRedis();
    assert.equal(client, null);
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_ENABLED;
    delete process.env.NODE_ENV;
    delete require.cache[require.resolve(cacheModulePath)];
  }
});

test('retries Redis connection when startup is delayed', async () => {
  process.env.REDIS_ENABLED = 'true';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379/0';
  process.env.NODE_ENV = 'test';
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_PORT;
  delete process.env.CACHE_BACKEND;
  delete require.cache[require.resolve(cacheModulePath)];

  const Redis = require('ioredis');
  const originalConnect = Redis.prototype.connect;
  let attempts = 0;
  Redis.prototype.connect = async function () {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('temporarily unavailable');
    }
    this.status = 'ready';
    return this;
  };

  try {
    const cache = require(cacheModulePath);
    const client = await cache.initializeRedis();
    assert.ok(client);
    assert.equal(attempts, 2);
  } finally {
    Redis.prototype.connect = originalConnect;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_ENABLED;
    delete process.env.NODE_ENV;
    delete require.cache[require.resolve(cacheModulePath)];
  }
});
