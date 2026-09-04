const test = require('node:test');
const assert = require('node:assert');

// FIX 1 regression tests: /drivers/online must derive eligibility metadata
// (rideType/vehicleNumber) from the authoritative Supabase drivers row and
// refuse registration when that row is missing or has an invalid vehicle_type.

const DRIVER_REPO_PATH = require.resolve('../src/modules/driver/driver.repository');
const DRIVER_SERVICE_PATH = require.resolve('../src/modules/driver/driver.service');

function loadService(repoOverrides = {}) {
  const calls = {
    onlineWrites: [],
    offlineIds: [],
    operationOrder: [],
    profileLookups: [],
  };
  const defaults = {
    getDriverByUserId: async (userId) => {
      calls.profileLookups.push(userId);
      return null;
    },
    setDriverOnline: async (driverId, data) => {
      calls.onlineWrites.push({ driverId, data });
    },
    setDriverOffline: async (driverId) => {
      calls.offlineIds.push(driverId);
    },
    setDriverLocation: async () => {
      calls.operationOrder.push('geoadd');
    },
    ensureDriverHashMetadata: async () => {
      calls.operationOrder.push('ensure_metadata');
      return null;
    },
  };

  require.cache[DRIVER_REPO_PATH] = {
    id: DRIVER_REPO_PATH,
    filename: DRIVER_REPO_PATH,
    loaded: true,
    exports: { ...defaults, ...repoOverrides },
  };
  delete require.cache[DRIVER_SERVICE_PATH];
  return { service: require(DRIVER_SERVICE_PATH), calls };
}

const VALID_PROFILE = {
  user_id: 'd1',
  vehicle_type: 'mini',
  vehicle_number: 'KA-01-AB-1234',
};

test('valid online registration writes authoritative metadata from the drivers row', async () => {
  const { service, calls } = loadService({
    getDriverByUserId: async (userId) => {
      calls.profileLookups.push(userId);
      return VALID_PROFILE;
    },
  });

  await service.setOnline('d1', { isOnline: true, rideType: 'bike', vehicleNumber: 'FAKE' });

  assert.strictEqual(calls.profileLookups.length, 1);
  assert.strictEqual(calls.onlineWrites.length, 1);
  // Client-supplied rideType/vehicleNumber ('bike'/'FAKE') are ignored:
  const write = calls.onlineWrites[0];
  assert.strictEqual(write.driverId, 'd1');
  assert.strictEqual(write.data.rideType, 'mini');
  assert.strictEqual(write.data.vehicleNumber, 'KA-01-AB-1234');
});

test('online registration without a driver profile is rejected and never touches Redis', async () => {
  const { service, calls } = loadService(); // getDriverByUserId -> null

  await assert.rejects(
    () => service.setOnline('ghost', { isOnline: true }),
    (err) => err.statusCode === 400 && /valid vehicle_type/.test(err.message)
  );
  assert.strictEqual(calls.onlineWrites.length, 0);
});

test('online registration with an invalid vehicle_type is rejected', async () => {
  const { service, calls } = loadService({
    getDriverByUserId: async () => ({ ...VALID_PROFILE, vehicle_type: 'luxury' }),
  });
  await assert.rejects(() => service.setOnline('d1', { isOnline: true }), { statusCode: 400 });

  const { service: service2, calls: calls2 } = loadService({
    getDriverByUserId: async () => ({ ...VALID_PROFILE, vehicle_type: null }),
  });
  await assert.rejects(() => service2.setOnline('d1', { isOnline: true }), { statusCode: 400 });

  const { service: service3, calls: calls3 } = loadService({
    getDriverByUserId: async () => ({ ...VALID_PROFILE, vehicle_type: '' }),
  });
  await assert.rejects(() => service3.setOnline('d1', { isOnline: true }), { statusCode: 400 });

  assert.strictEqual(calls.onlineWrites.length, 0);
  assert.strictEqual(calls2.onlineWrites.length, 0);
  assert.strictEqual(calls3.onlineWrites.length, 0);
});

test('going offline deletes availability state without any profile lookup', async () => {
  const { service, calls } = loadService();

  await service.setOnline('d1', { isOnline: false });

  assert.deepStrictEqual(calls.offlineIds, ['d1']);
  assert.strictEqual(calls.profileLookups.length, 0);
  assert.strictEqual(calls.onlineWrites.length, 0);
});

test('location updates repair hash metadata BEFORE adding GEO membership', async () => {
  const { service, calls } = loadService();

  await service.updateLocation('d1', { latitude: 12.9, longitude: 77.6 });

  assert.deepStrictEqual(calls.operationOrder, ['ensure_metadata', 'geoadd']);
});
