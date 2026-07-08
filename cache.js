const Redis = require('ioredis');
const client = require('prom-client');

let redisClient = null;
let redisReady = false;
let redisConnectPromise = null;
let redisUnavailableMessageShown = false;
const inMemory = new Map();

// Prometheus counters
const cacheHits = new client.Counter({ name: 'cache_hits_total', help: 'Cache hits' });
const cacheMisses = new client.Counter({ name: 'cache_misses_total', help: 'Cache misses' });

function isRedisEnabled() {
  const explicitSetting = process.env.REDIS_ENABLED;
  if (explicitSetting !== undefined) {
    return ['1', 'true', 'yes', 'on'].includes(String(explicitSetting).toLowerCase());
  }

  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST || process.env.REDIS_PORT || process.env.CACHE_BACKEND === 'redis');
}

function resolveRedisUrl() {
  if (!isRedisEnabled()) {
    return null;
  }

  const configuredUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0';
  return configuredUrl.replace(/^redis:\/\/localhost(?=[:/])/i, 'redis://127.0.0.1');
}

function warnRedisUnavailable(error) {
  if (!redisUnavailableMessageShown) {
    redisUnavailableMessageShown = true;
    console.warn('[cache] Redis unavailable, falling back to in-memory cache:', error?.message || error);
  }
}

async function ensureRedisClient() {
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) return null;
  if (redisReady && redisClient) return redisClient;
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      reconnectOnError: () => false,
    });
    redisClient.on('error', (error) => {
      if (!redisReady) {
        warnRedisUnavailable(error);
      }
    });
  }
  if (!redisConnectPromise) {
    redisConnectPromise = redisClient.connect().then(() => {
      redisReady = true;
      return redisClient;
    }).catch((error) => {
      redisReady = false;
      redisClient = null;
      redisConnectPromise = null;
      warnRedisUnavailable(error);
      return null;
    });
  }
  return redisConnectPromise;
}

async function initializeRedis() {
  const connectedClient = await ensureRedisClient();
  if (connectedClient) {
    console.log('✅ Redis connected:', resolveRedisUrl());
    return connectedClient;
  }
  return null;
}

async function get(key) {
  try {
    const clientRedis = await ensureRedisClient();
    if (clientRedis) {
      const v = await clientRedis.get(key);
      if (v !== null && v !== undefined) {
        cacheHits.inc();
        return v ? JSON.parse(v) : null;
      }
      cacheMisses.inc();
      return null;
    }
    const v = inMemory.get(key);
    if (v === undefined) {
      cacheMisses.inc();
      return null;
    }
    cacheHits.inc();
    return v;
  } catch (e) {
    console.warn('[cache] get error', e?.message || e);
    return null;
  }
}

async function set(key, value, ttlSeconds = 60) {
  try {
    const clientRedis = await ensureRedisClient();
    if (clientRedis) {
      await clientRedis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    }
    inMemory.set(key, value);
    setTimeout(() => inMemory.delete(key), ttlSeconds * 1000);
    return true;
  } catch (e) {
    console.warn('[cache] set error', e?.message || e);
    return false;
  }
}

async function del(key) {
  try {
    const clientRedis = await ensureRedisClient();
    if (clientRedis) return clientRedis.del(key);
    return inMemory.delete(key);
  } catch (e) {
    console.warn('[cache] del error', e?.message || e);
    return false;
  }
}

module.exports = { get, set, del, initializeRedis };
