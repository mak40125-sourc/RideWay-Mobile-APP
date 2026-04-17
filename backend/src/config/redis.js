const Redis = require('ioredis');
require('dotenv').config();

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  lazyConnect: true,
  retryStrategy: (times) => {
    // Stop retrying after 3 attempts
    if (times > 3) {
      console.log('Redis unavailable - continuing without it');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  // Silently handle errors after initial retries
  if (process.env.NODE_ENV !== 'production') {
    console.error('Redis Client Error', err.message);
  }
});

// Try to connect, but don't block server startup
redisClient.connect().catch(() => {
  console.log('Redis connection failed - server will run without Redis');
});

module.exports = redisClient;