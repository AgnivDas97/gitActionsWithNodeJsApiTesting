require('dotenv').config();
const { createClient } = require('redis');

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || '60', 10);

let isReady = false;

const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: process.env.NODE_ENV === 'test' ? false : (retries) => {
      if (retries > 3) return false;
      return Math.min(retries * 300, 1000);
    }
  }
});

redisClient.on('connect', () => {
  console.log(`Connected to Redis at ${redisUrl}`);
});

redisClient.on('ready', () => {
  isReady = true;
  console.log('Redis cache client is ready to receive commands.');
});

redisClient.on('error', (err) => {
  isReady = false;
  // Log warning instead of crashing when Redis is unavailable
  console.warn(`[Redis Cache Warning]: ${err.message}. Running in DB-only mode.`);
});

redisClient.on('end', () => {
  isReady = false;
});

// Auto-connect on startup
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    // Suppress unhandled rejection on initial connection failure (graceful fallback)
    console.warn(`[Redis Cache Notice]: Could not establish initial connection to Redis (${err.message}). Cached operations will fallback directly to database.`);
  }
})();

/**
 * Retrieve cached JSON data by key
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function getCache(key) {
  if (!isReady) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn(`[Redis getCache Error]: ${err.message}`);
    return null;
  }
}

/**
 * Store data as JSON in cache with TTL
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlSeconds]
 * @returns {Promise<boolean>}
 */
async function setCache(key, value, ttlSeconds = DEFAULT_TTL) {
  if (!isReady) return false;
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.warn(`[Redis setCache Error]: ${err.message}`);
    return false;
  }
}

/**
 * Cleanly disconnect Redis client during shutdown / tests
 */
async function closeRedis() {
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    } else {
      await redisClient.disconnect();
    }
  } catch {
    try {
      await redisClient.disconnect();
    } catch {
      // ignore
    }
  }
}

module.exports = {
  redisClient,
  getCache,
  setCache,
  closeRedis,
  isReady: () => isReady
};
