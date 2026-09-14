const Redis = require('ioredis');
const { logger, currentCorrelationId } = require('../logger/logger');

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

function createClient(label) {
  const c = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn({ type: 'redis', event: 'unavailable', label });
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  c.on('connect', () => logger.info({ type: 'redis', event: 'connected', label }));
  c.on('ready', () => logger.info({ type: 'redis', event: 'ready', label }));
  c.on('close', () => logger.warn({ type: 'redis', event: 'disconnected', label }));
  c.on('error', (err) => {
    logger.error({ type: 'redis', event: 'error', label, error: err.message });
  });

  c.connect().catch(() => {});
  return c;
}

const client = createClient('client');
const subscriber = createClient('subscriber');

const RIDE_REQUEST_TTL = 120;

const redisService = {
  // Offer window shared with clients via the ride:request payload (expiresAt).
  RIDE_REQUEST_TTL,

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
    // One pipeline round trip: availability metadata and GEO membership are
    // removed together so going offline can never leave half-deleted state.
    const pipeline = client.pipeline();
    pipeline.del(`driver:${driverId}`);
    pipeline.zrem('drivers:online', driverId);
    await pipeline.exec();
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
    logger.info({
      type: 'redis',
      event: 'ride_request_buffer_set',
      correlationId: currentCorrelationId(),
      rideId,
      key,
      ttl: RIDE_REQUEST_TTL,
    });
  },

  getRideRequest: async (rideId) => {
    const key = `ride:request:${rideId}`;
    const data = await client.hgetall(key);
    if (!data || Object.keys(data).length === 0) {
      logger.warn({
        type: 'redis',
        event: 'ride_request_buffer_missing',
        correlationId: currentCorrelationId(),
        rideId,
        key,
        ttl: await client.ttl(key).catch(() => -2),
      });
      return null;
    }
    return data;
  },

  deleteRideRequest: async (rideId) => {
    const key = `ride:request:${rideId}`;
    await client.del(key);
    logger.info({
      type: 'redis',
      event: 'ride_request_buffer_deleted',
      correlationId: currentCorrelationId(),
      rideId,
      key,
    });
  },

  // Passenger identity for "book for someone else" rides. Stored in its own hash
  // (long TTL) so it survives the short-lived ride:request buffer and is
  // available to the driver for the whole ride without a DB schema change.
  setRidePassenger: async (rideId, name, phone) => {
    const key = `ride:passenger:${rideId}`;
    await client.hset(key, { name: name || '', phone: phone || '' });
    await client.expire(key, 24 * 60 * 60);
  },

  getRidePassenger: async (rideId) => {
    const key = `ride:passenger:${rideId}`;
    const data = await client.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    return { name: data.name || null, phone: data.phone || null };
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

  // ── Wave / Offer State (2-driver waves + 10s individual timers) ──
  // Single source of truth for wave progression lives in two hashes:
  //   ride:wave:<rideId>  — { waveNumber, status, waveDriverIds[], candidateIds[], candidateIndex }
  //   ride:offer:<rideId> — field per driverId → { waveNumber, status, createdAt, expiresAt, candidatePosition }
  // Offer status: active | rejected | expired | accepted | cancelled. Both keys
  // carry the global 120s TTL so wave state can never outlive the ride request.
  setWaveState: async (rideId, state) => {
    const key = `ride:wave:${rideId}`;
    await client.hset(key, {
      waveNumber: String(state.waveNumber),
      status: state.status || 'active',
      waveDriverIds: JSON.stringify(state.waveDriverIds || []),
      candidateIds: JSON.stringify(state.candidateIds || []),
      candidateIndex: String(state.candidateIndex ?? 0),
      updatedAt: String(Date.now()),
    });
    await client.expire(key, RIDE_REQUEST_TTL);
  },

  getWaveState: async (rideId) => {
    const key = `ride:wave:${rideId}`;
    const data = await client.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    let waveDriverIds = [];
    let candidateIds = [];
    try { waveDriverIds = JSON.parse(data.waveDriverIds || '[]'); } catch { waveDriverIds = []; }
    try { candidateIds = JSON.parse(data.candidateIds || '[]'); } catch { candidateIds = []; }
    return {
      waveNumber: Number(data.waveNumber || 1),
      status: data.status || 'active',
      waveDriverIds,
      candidateIds,
      candidateIndex: Number(data.candidateIndex || 0),
      updatedAt: Number(data.updatedAt || 0),
    };
  },

  deleteWaveState: async (rideId) => {
    await client.del(`ride:wave:${rideId}`);
  },

  // ── Wave transition guard (duplicate-dispatch protection) ──
  // Atomic single-claim per (rideId, fromWave → toWave): only the first
  // caller wins and proceeds to dispatch; concurrent advancers (two
  // rejects, reject + timer, two processes) lose and must exit without
  // dispatching. SET NX is atomic, so simultaneous callers cannot both win.
  // One key per transition, so wave 1→2 never blocks a later wave 2→3.
  // Bounded TTL (same 120s as all matching scratch state) so a crashed
  // process can never block wave progression permanently.
  claimWaveTransition: async (rideId, fromWaveNumber, toWaveNumber, ttl = RIDE_REQUEST_TTL) => {
    const key = `ride:wave:transition:${rideId}:${fromWaveNumber}:${toWaveNumber}`;
    const acquired = await client.set(key, String(Date.now()), 'NX', 'EX', ttl);
    logger.info({
      type: 'redis',
      event: acquired !== null ? 'wave_transition_claimed' : 'wave_transition_contended',
      correlationId: currentCorrelationId(),
      rideId,
      key,
    });
    return acquired !== null;
  },

  setDriverOffers: async (rideId, offers) => {
    if (!offers || offers.length === 0) return;
    const key = `ride:offer:${rideId}`;
    const pipeline = client.pipeline();
    for (const o of offers) {
      pipeline.hset(key, o.driverId, JSON.stringify({
        waveNumber: o.waveNumber,
        status: o.status || 'active',
        createdAt: o.createdAt,
        expiresAt: o.expiresAt,
        candidatePosition: o.candidatePosition ?? null,
      }));
    }
    await pipeline.exec();
    await client.expire(key, RIDE_REQUEST_TTL);
  },

  getDriverOffers: async (rideId) => {
    const key = `ride:offer:${rideId}`;
    const data = await client.hgetall(key);
    if (!data || Object.keys(data).length === 0) return {};
    const out = {};
    for (const [driverId, raw] of Object.entries(data)) {
      try {
        out[driverId] = JSON.parse(raw);
      } catch {
        // ignore corrupt fields
      }
    }
    return out;
  },

  getDriverOffer: async (rideId, driverId) => {
    const key = `ride:offer:${rideId}`;
    const raw = await client.hget(key, driverId);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  updateOfferStatus: async (rideId, driverId, status) => {
    const key = `ride:offer:${rideId}`;
    const raw = await client.hget(key, driverId);
    if (!raw) return null;
    let offer;
    try {
      offer = JSON.parse(raw);
    } catch {
      return null;
    }
    offer.status = status;
    offer.updatedAt = Date.now();
    await client.hset(key, driverId, JSON.stringify(offer));
    return offer;
  },

  deleteOfferState: async (rideId) => {
    await client.del(`ride:offer:${rideId}`);
  },

  getRideRequestTtl: async (rideId) => {
    try {
      return await client.ttl(`ride:request:${rideId}`);
    } catch {
      return -2;
    }
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
    logger.info({
      type: 'redis',
      event: acquired !== null ? 'lock_acquired' : 'lock_contended',
      correlationId: currentCorrelationId(),
      rideId,
      driverId,
      ttl,
    });
    return acquired !== null;
  },

  releaseRideLock: async (rideId) => {
    const key = `ride:lock:${rideId}`;
    await client.del(key);
    logger.info({
      type: 'redis',
      event: 'lock_released',
      correlationId: currentCorrelationId(),
      rideId,
      key,
    });
  },

  // ── Pub/Sub ──────────────────────────────────────────────────────
  publishNotification: async (channel, message) => {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    let correlationId;
    if (typeof message === 'object' && message !== null) {
      correlationId = message.correlationId;
    }
    try {
      const result = await client.publish(channel, payload);
      logger.info({
        type: 'redis',
        event: 'publish_success',
        correlationId: correlationId || currentCorrelationId(),
        channel,
        subscriberCount: result,
      });
    } catch (err) {
      logger.error({
        type: 'redis',
        event: 'publish_failure',
        correlationId: correlationId || currentCorrelationId(),
        channel,
        error: err.message,
      });
      throw err;
    }
  },

  subscribeToNotifications: (channel, callback) => {
    subscriber.subscribe(channel, (err) => {
      if (err) {
        logger.error({ type: 'redis', event: 'subscribe_failure', channel, error: err.message });
      } else {
        logger.info({ type: 'redis', event: 'subscribe_success', channel });
      }
    });

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch {
          callback(message);
        }
      }
    });
  },

  // ── Dashboard: online driver aggregates ─────────────────────────
  // Returns the set of online driver ids (members of the `drivers:online` GEO
  // set). Returns null when Redis is unavailable so callers can fall back to the
  // Supabase `is_online` column without crashing the dashboard read path.
  getOnlineDriverIds: async () => {
    try {
      return await client.zrange('drivers:online', 0, -1)
    } catch {
      return null
    }
  },

  countOnlineDrivers: async () => {
    try {
      return await client.zcard('drivers:online')
    } catch {
      return null
    }
  },

  // ── Cleanup ──────────────────────────────────────────────────────
  shutdown: () => {
    subscriber.unsubscribe();
    subscriber.quit();
    client.quit();
  },
};

module.exports = redisService;
