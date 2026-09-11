const test = require('node:test');
const assert = require('node:assert');

// Hermetic: fail fast on OSRM so pricing uses instant haversine fallback.
global.fetch = async () => { throw new Error('offline-test'); };

// Verifies createRideRequest persists authoritative fare even when the client
// sends a fake fare/distance/duration. Mocks DB + Redis + matching collaborators.
const MATCHING_SVC_PATH = require.resolve('../src/modules/matching/matching.service');
const MATCHING_REPO_PATH = require.resolve('../src/modules/matching/matching.repository');
const RIDE_REPO_PATH = require.resolve('../src/modules/ride/ride.repository');
const LOGGER_PATH = require.resolve('../src/core/logger/logger');

const SUPABASE_PATH = require.resolve('../src/core/database/supabase');
const REDIS_SVC_PATH = require.resolve('../src/core/redis/redis.service');

function loadServiceWithMocks() {
  // Stub redis.service: the real module opens ioredis connections at load
  // (via offer-dispatcher) which would keep the test process alive forever.
  require.cache[REDIS_SVC_PATH] = {
    id: REDIS_SVC_PATH, filename: REDIS_SVC_PATH, loaded: true,
    exports: { RIDE_REQUEST_TTL: 120 },
  };
  require.cache[SUPABASE_PATH] = {
    id: SUPABASE_PATH, filename: SUPABASE_PATH, loaded: true,
    exports: {
      supabaseAdmin: {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              in: () => ({
                gte: () => ({
                  order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
                }),
              }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      },
    },
  };
  require.cache[LOGGER_PATH] = {
    id: LOGGER_PATH, filename: LOGGER_PATH, loaded: true,
    exports: {
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      stage: () => {}, track: () => {}, currentCorrelationId: () => 'test',
    },
  };
  const captured = {};
  require.cache[RIDE_REPO_PATH] = {
    id: RIDE_REPO_PATH, filename: RIDE_REPO_PATH, loaded: true,
    exports: {
      createRideIdempotent: async (args) => {
        captured.createArgs = args;
        return { id: args.rideId, status: 'SEARCHING_DRIVER' };
      },
    },
  };
  require.cache[MATCHING_REPO_PATH] = {
    id: MATCHING_REPO_PATH, filename: MATCHING_REPO_PATH, loaded: true,
    exports: {
      setRidePassenger: async () => {},
      createRideRequest: async (rideId, data) => { captured.redisArgs = { rideId, data }; },
      getRideRequest: async () => null,
      deleteRideRequest: async () => {},
      addDriversToQueue: async () => {},
      deleteQueue: async () => {},
      acquireRideLock: async () => true,
      releaseRideLock: async () => {},
      publishNotification: async () => {},
      getRiderName: async () => 'Test',
      getNearbyDrivers: async () => [],
      getDriver: async () => null,
      repairDriverMetadata: async () => null,
      acceptRide: async () => null,
    },
  };
  delete require.cache[MATCHING_SVC_PATH];
  delete require.cache[require.resolve('../src/modules/matching/candidate-finder')];
  delete require.cache[require.resolve('../src/modules/matching/candidate-ranker')];
  delete require.cache[require.resolve('../src/modules/matching/offer-dispatcher')];
  const svc = require(MATCHING_SVC_PATH);
  return { svc, captured };
}

test('ride lifecycle: request persists authoritative fare, ignoring fake client fare', async () => {
  const { svc, captured } = loadServiceWithMocks();
  const pickup = { lat: 12.9716, lng: 77.5946 };
  const dropoff = { lat: 12.9352, lng: 77.6245 };
  const result = await svc.createRideRequest(
    'rider-1', pickup, dropoff,
    1, 0.1, 1, // FAKE client fare/distance/duration
    'sedan', null, { idempotencyKey: 'test-key-fake-fare' }
  );
  assert.ok(result.rideId);
  assert.ok(result.fare > 1, 'authoritative fare must replace fake fare=1');
  assert.strictEqual(captured.createArgs.fare, result.fare);
  assert.notStrictEqual(captured.createArgs.fare, 1);
  assert.strictEqual(captured.redisArgs.data.fare, result.fare);
  delete require.cache[MATCHING_SVC_PATH];
});

test('ride lifecycle: authoritative amount flows to completion snapshot', async () => {
  const { svc, captured } = loadServiceWithMocks();
  const result = await svc.createRideRequest(
    'rider-1', { lat: 12.9, lng: 77.6 }, { lat: 13.0, lng: 77.7 },
    99999, 999, 999, // absurd fake values
    'bike', null, {}
  );
  assert.ok(result.fare < 99999, 'absurd fake fare must not persist');
  assert.ok(result.distance < 999 && result.duration < 999);
  assert.ok(captured.createArgs.fareBreakdown && captured.createArgs.pricingVersion === 'v1');
  delete require.cache[MATCHING_SVC_PATH];
});
