const Redis = require('ioredis');

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
  redis.on('error', (err) => console.error('Redis Client Error:', err));
  redis.on('connect', () => console.log('✅ Connected to Redis successfully'));
} else {
  console.warn('⚠️ REDIS_URL not set. Caching is disabled. Performance may degrade under load.');
}

class CacheService {
  /**
   * Get cached data
   * @param {string} key 
   * @returns {Promise<any|null>}
   */
  static async get(key) {
    if (!redis) return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`Cache GET error for key ${key}:`, err);
      return null;
    }
  }

  /**
   * Set cached data
   * @param {string} key 
   * @param {any} value 
   * @param {number} expirationSeconds Default 300s (5 min)
   */
  static async set(key, value, expirationSeconds = 300) {
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), 'EX', expirationSeconds);
    } catch (err) {
      console.error(`Cache SET error for key ${key}:`, err);
    }
  }

  /**
   * Delete a cached key
   * @param {string} key 
   */
  static async delete(key) {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (err) {
      console.error(`Cache DELETE error for key ${key}:`, err);
    }
  }

  /**
   * Clear cache keys matching a pattern
   * @param {string} pattern 
   */
  static async clearPattern(pattern) {
    if (!redis) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (err) {
      console.error(`Cache clear pattern error:`, err);
    }
  }
}

module.exports = CacheService;
