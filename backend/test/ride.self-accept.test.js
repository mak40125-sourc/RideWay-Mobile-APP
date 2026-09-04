const test = require('node:test');
const assert = require('node:assert');

const MATCHING_REPO_PATH = require.resolve('../src/modules/matching/matching.repository');
const ACCEPTANCE_MANAGER_PATH = require.resolve('../src/modules/matching/acceptance-manager');

function loadAcceptanceManager(overrides) {
  const defaults = {
    acquireRideLock: async () => true,
    getRideRequest: async () => ({ riderId: 'rider-1' }),
    acceptRide: async () => [{ id: 'ride-1', status: 'DRIVER_ASSIGNED' }],
    releaseRideLock: async () => {},
    deleteRideRequest: async () => {},
    deleteQueue: async () => {},
  };
  require.cache[MATCHING_REPO_PATH] = {
    id: MATCHING_REPO_PATH,
    filename: MATCHING_REPO_PATH,
    loaded: true,
    exports: { ...defaults, ...overrides },
  };
  delete require.cache[ACCEPTANCE_MANAGER_PATH];
  return require(ACCEPTANCE_MANAGER_PATH);
}

test('a rider cannot accept their own ride', async () => {
  const acceptanceManager = loadAcceptanceManager({
    getRideRequest: async () => ({ riderId: 'same-user' }),
  });
  await assert.rejects(
    () => acceptanceManager.acceptRide('ride-1', 'same-user'),
    /Rider cannot accept their own ride\./
  );
});

test('a different driver can accept the ride', async () => {
  const acceptanceManager = loadAcceptanceManager({
    getRideRequest: async () => ({ riderId: 'rider-1' }),
  });
  const result = await acceptanceManager.acceptRide('ride-1', 'driver-2');
  assert.strictEqual(result.status, 'DRIVER_ASSIGNED');
});