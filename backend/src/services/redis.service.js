const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

function createClient(label) {
  const c = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        console.log(`Redis (${label}): unavailable`);
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  c.on('connect', () => console.log(`Redis (${label}): connected`));
  c.on('error', (err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Redis (${label}): ${err.message}`);
    }
  });

  c.connect().catch(() => {});
  return c;
}

const client = createClient('client');
const subscriber = createClient('subscriber');

const RIDE_REQUEST_TTL = 120;

const redisService = {
  // ── Driver Location ──────────────────────────────────────────────
  setDriverLocation: async (driverId, latitude, longitude) => {
    await client.geoadd('drivers:online', longitude, latitude, driverId);
  },

  getNearbyDrivers: async (latitude, longitude, radiusMeters = 3000) => {
    // Returns [{ driverId, distanceMeters }] sorted by distance
    const results = await client.georadius(
      'drivers:online',
      longitude,
      latitude,
      radiusMeters,
      'm',
      'WITHDIST',
      'ASC'
    );

    if (!results || results.length === 0) return [];

    const driverIds = results.map((r) => r[0]);

    // Fetch driver state hashes in batch
    const pipeline = client.pipeline();
    for (const id of driverIds) {
      pipeline.hgetall(`driver:${id}`);
    }
    const states = await pipeline.exec();

    return results.map((r, i) => {
      const state = states[i]?.[1] || {};
      return {
        driver_id: r[0],
        user_id: r[0],
        distance_meters: parseFloat(r[1]),
        vehicle_type: state.rideType || null,
        status: state.status || null,
      };
    });
  },

  // ── Driver State ─────────────────────────────────────────────────
  setDriverOnline: async (driverId, data) => {
    const key = `driver:${driverId}`;
    const fields = {
      status: 'ONLINE',
      rideType: data.rideType || '',
      socketId: data.socketId || '',
      vehicleNumber: data.vehicleNumber || '',
      onlineSince: String(Date.now()),
    };
    await client.hset(key, fields);
  },

  setDriverOffline: async (driverId) => {
    await client.del(`driver:${driverId}`);
    await client.zrem('drivers:online', driverId);
  },

  getDriver: async (driverId) => {
    const data = await client.hgetall(`driver:${driverId}`);
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  },

  // ── Ride Requests ─────────────────────────────────────────────────
  createRideRequest: async (rideId, data) => {
    const key = `ride:request:${rideId}`;
    const fields = {
      riderId: data.riderId,
      pickupLat: String(data.pickupLat),
      pickupLng: String(data.pickupLng),
      pickupAddress: data.pickupAddress || '',
      dropLat: String(data.dropLat),
      dropLng: String(data.dropLng),
      dropAddress: data.dropAddress || '',
      fare: String(data.fare),
      distance: String(data.distance),
      duration: String(data.duration),
      vehicleType: data.vehicleType || '',
      status: 'REQUESTED',
      createdAt: String(Date.now()),
    };
    await client.hset(key, fields);
    await client.expire(key, RIDE_REQUEST_TTL);
  },

  getRideRequest: async (rideId) => {
    const data = await client.hgetall(`ride:request:${rideId}`);
    if (!data || Object.keys(data).length === 0) return null;
    return data;
  },

  deleteRideRequest: async (rideId) => {
    await client.del(`ride:request:${rideId}`);
  },

  // ── Driver Queue ─────────────────────────────────────────────────
  addDriverToQueue: async (rideId, driverId) => {
    const key = `ride:offers:${rideId}`;
    await client.sadd(key, driverId);
    await client.expire(key, RIDE_REQUEST_TTL);
  },

  addDriversToQueue: async (rideId, driverIds) => {
    if (!driverIds || driverIds.length === 0) return;
    const key = `ride:offers:${rideId}`;
    await client.sadd(key, ...driverIds);
    await client.expire(key, RIDE_REQUEST_TTL);
  },

  getQueue: async (rideId) => {
    return client.smembers(`ride:offers:${rideId}`);
  },

  deleteQueue: async (rideId) => {
    await client.del(`ride:offers:${rideId}`);
  },

  // ── Distributed Lock ─────────────────────────────────────────────
  acquireRideLock: async (rideId, driverId, ttl = 10) => {
    const acquired = await client.set(
      `ride:lock:${rideId}`,
      driverId,
      'NX',
      'EX',
      ttl
    );
    return acquired !== null;
  },

  releaseRideLock: async (rideId) => {
    await client.del(`ride:lock:${rideId}`);
  },

  // ── Pub/Sub ──────────────────────────────────────────────────────
  publishNotification: async (channel, message) => {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    await client.publish(channel, payload);
  },

  subscribeToNotifications: (channel, callback) => {
    subscriber.subscribe(channel, (err) => {
      if (err) {
        console.error(`Redis subscribe (${channel}): ${err.message}`);
      }
    });

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(message));
        } catch {
          callback(message);
        }
      }
    });
  },

  // ── Cleanup ──────────────────────────────────────────────────────
  shutdown: () => {
    subscriber.unsubscribe();
    subscriber.quit();
    client.quit();
  },
};

module.exports = redisService;
