const test = require('node:test');
const assert = require('node:assert');

// FIX 2 regression tests: candidate discovery must repair missing availability
// metadata for nearby GEO members (bounded to those members only) BEFORE the
// vehicle_type filter runs, and must exclude — never crash on — unrestorable
// or invalid records.

const LOGGER_PATH = require.resolve('../src/core/logger/logger');
const MATCHING_REPO_PATH = require.resolve('../src/modules/matching/matching.repository');
const FINDER_PATH = require.resolve('../src/modules/matching/candidate-finder');

function loadFinder(repoOverrides = {}) {
  const logEvents = [];
  require.cache[LOGGER_PATH] = {
    id: LOGGER_PATH,
    filename: LOGGER_PATH,
    loaded: true,
    exports: {
      logger: {
        info: (entry) => logEvents.push({ level: 'info', entry }),
        warn: (entry) => logEvents.push({ level: 'warn', entry }),
        error: () => {},
      },
      currentCorrelationId: () => 'corr-test',
    },
  };

  const calls = { repairs: [] };
  const defaults = {
    getNearbyDrivers: async () => [],
    getDriver: async () => null,
    repairDriverMetadata: async (driverId) => {
      calls.repairs.push(driverId);
      return null;
    },
    createRideRequest: async () => {},
    getRideRequest: async () => null,
    deleteRideRequest: async () => {},
    addDriversToQueue: async () => {},
    deleteQueue: async () => {},
    acquireRideLock: async () => true,
    releaseRideLock: async () => {},
    publishNotification: async () => {},
    getRiderName: async () => null,
    acceptRide: async () => null,
  };
  require.cache[MATCHING_REPO_PATH] = {
    id: MATCHING_REPO_PATH,
    filename: MATCHING_REPO_PATH,
    loaded: true,
    exports: { ...defaults, ...repoOverrides },
  };
  delete require.cache[FINDER_PATH];
  return { findCandidates: require(FINDER_PATH).findCandidates, calls, logEvents };
}

const PICKUP = { lat: 30.76, lng: 76.66 };

test('a GEO member with a missing hash is repaired at read time and then matched', async () => {
  const { findCandidates, calls } = loadFinder({
    getNearbyDrivers: async () => [
      { driver_id: 'mini-driver', user_id: 'mini-driver', distance_meters: 5, vehicle_type: null, status: null },
    ],
    repairDriverMetadata: async (driverId) => {
      calls.repairs.push(driverId);
      return { rideType: 'mini', status: 'ONLINE', onlineSince: '123' };
    },
  });

  const result = await findCandidates(PICKUP, 'mini', 'ride-1');

  assert.deepStrictEqual(calls.repairs, ['mini-driver']);
  assert.strictEqual(result.candidateCount, 1);
  assert.deepStrictEqual(result.candidateIds, ['mini-driver']);
});

test('an already-complete member is not repaired; filtering stays exact-match', async () => {
  const { findCandidates, calls } = loadFinder({
    getNearbyDrivers: async () => [
      { driver_id: 'bike-1', user_id: 'bike-1', distance_meters: 4, vehicle_type: 'bike', status: 'ONLINE' },
      { driver_id: 'mini-1', user_id: 'mini-1', distance_meters: 9, vehicle_type: 'mini', status: 'ONLINE' },
    ],
  });

  const result = await findCandidates(PICKUP, 'bike', 'ride-1');

  assert.strictEqual(calls.repairs.length, 0); // bounded: no repair for healthy records
  assert.strictEqual(result.candidateCount, 1);
  assert.deepStrictEqual(result.candidateIds, ['bike-1']);
});

test('restoration failure excludes the driver safely and matching still succeeds for others', async () => {
  const { findCandidates, logEvents } = loadFinder({
    getNearbyDrivers: async () => [
      { driver_id: 'broken', user_id: 'broken', distance_meters: 3, vehicle_type: null, status: null },
      { driver_id: 'bike-ok', user_id: 'bike-ok', distance_meters: 7, vehicle_type: 'bike', status: 'ONLINE' },
    ],
    repairDriverMetadata: async () => {
      throw new Error('supabase down');
    },
  });

  const result = await findCandidates(PICKUP, 'bike', 'ride-1');

  assert.strictEqual(result.candidateCount, 1);
  assert.deepStrictEqual(result.candidateIds, ['bike-ok']);
  const failure = logEvents.find((l) => l.entry.event === 'candidate_metadata_repair_failed');
  assert.ok(failure, 'repair failure must be logged');
  assert.strictEqual(failure.entry.error, 'supabase down');
});

test('repair that yields no usable metadata excludes the driver as hash_metadata_missing', async () => {
  const { findCandidates, logEvents } = loadFinder({
    getNearbyDrivers: async () => [
      { driver_id: 'no-type', user_id: 'no-type', distance_meters: 6, vehicle_type: null, status: null },
    ],
    repairDriverMetadata: async () => ({}), // restored but still no rideType
  });

  const result = await findCandidates(PICKUP, 'mini', 'ride-1');

  assert.strictEqual(result.candidateCount, 0);
  const discovery = logEvents.find((l) => l.entry.event === 'candidate_discovery').entry;
  assert.deepStrictEqual(discovery.excluded, [
    { driverId: 'no-type', vehicleType: null, reason: 'hash_metadata_missing' },
  ]);
});

test('candidateCount is non-zero when the ONLY nearby driver was hashless but its drivers row is valid', async () => {
  // Exact production failure from logs/rideway.log 2026-08-13T18:52:
  // one mini driver in GEO with no hash + a mini ride request.
  const { findCandidates } = loadFinder({
    getNearbyDrivers: async () => [
      { driver_id: '21297138', user_id: '21297138', distance_meters: 4.48, vehicle_type: null, status: null },
    ],
    repairDriverMetadata: async () => ({ rideType: 'mini', status: 'ONLINE' }),
  });

  const result = await findCandidates(PICKUP, 'mini', 'ride-1');

  assert.strictEqual(result.candidateCount, 1);
  assert.deepStrictEqual(result.candidateIds, ['21297138']);
});

test('a repaired driver whose authoritative type mismatches the request is excluded by type', async () => {
  const { findCandidates } = loadFinder({
    getNearbyDrivers: async () => [
      { driver_id: 'actually-mini', user_id: 'actually-mini', distance_meters: 2, vehicle_type: null, status: null },
    ],
    repairDriverMetadata: async () => ({ rideType: 'mini', status: 'ONLINE' }),
  });

  const result = await findCandidates(PICKUP, 'bike', 'ride-1');

  assert.strictEqual(result.candidateCount, 0);
});
