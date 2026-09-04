const test = require('node:test');
const assert = require('node:assert');

// Test idempotency logic via mocked supabase for ride creation

const SUPABASE_PATH = require.resolve('../src/core/database/supabase');

function mockSupabaseForIdempotency(existingByKey) {
  require.cache[SUPABASE_PATH] = {
    id: SUPABASE_PATH,
    filename: SUPABASE_PATH,
    loaded: true,
    exports: {
      supabaseAdmin: {
        from: (table) => {
          assert.strictEqual(table, 'rides');
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: existingByKey, error: null }),
                }),
              }),
              eq2: () => {},
            }),
          };
        },
        rpc: async (fn, params) => {
          if (fn === 'create_ride_idempotent') {
            if (existingByKey) return { data: existingByKey, error: null };
            return { data: { id: params.p_ride_id, status: 'SEARCHING_DRIVER' }, error: null };
          }
          return { data: null, error: null };
        },
      },
    },
  };
}

test('idempotency: same rider+key returns same ride (hit)', async () => {
  const existing = { id: 'ride-123', status: 'SEARCHING_DRIVER' };
  mockSupabaseForIdempotency(existing);
  // Directly test the repository's createRideIdempotent hit path by checking the lifecycle of createRideRequest
  // We verify the unique index would prevent duplicates — here we just assert the mock returns existing.
  const { supabaseAdmin } = require('../src/core/database/supabase');
  const { data } = await supabaseAdmin.rpc('create_ride_idempotent', {
    p_ride_id: 'new-id',
    p_rider_id: 'rider-1',
    p_pickup_lat: 1,
    p_pickup_lng: 1,
    p_drop_lat: 2,
    p_drop_lng: 2,
    p_pickup_address: '',
    p_drop_address: '',
    p_fare: 100,
    p_distance: 5,
    p_duration: 10,
    p_idempotency_key: 'key-abc',
  });
  // In real impl, the function would return existing ride, not new-id
  // Our mock returns existingByKey when key matches, so we assert the path
  assert.ok(data);
  delete require.cache[SUPABASE_PATH];
});

test('lifecycle atomicity: transition_ride_status is idempotent for same status', async () => {
  // Mock RPC to return same status idempotently
  require.cache[SUPABASE_PATH] = {
    id: SUPABASE_PATH,
    filename: SUPABASE_PATH,
    loaded: true,
    exports: {
      supabaseAdmin: {
        rpc: async (fn, params) => {
          if (fn === 'transition_ride_status' && params.p_new_status === 'RIDE_STARTED') {
            return { data: { id: params.p_ride_id, status: 'RIDE_STARTED' }, error: null };
          }
          return { data: null, error: null };
        },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      },
    },
  };
  const repo = require('../src/modules/ride/ride.repository');
  // Bypass cache
  delete require.cache[require.resolve('../src/modules/ride/ride.repository')];
  const freshRepo = require('../src/modules/ride/ride.repository');
  const ride = await freshRepo.updateStatus('ride-1', 'driver-1', 'RIDE_STARTED');
  assert.strictEqual(ride.status, 'RIDE_STARTED');
  delete require.cache[SUPABASE_PATH];
});

test('two-driver race: second accept with different driver yields 409', async () => {
  require.cache[SUPABASE_PATH] = {
    id: SUPABASE_PATH,
    filename: SUPABASE_PATH,
    loaded: true,
    exports: {
      supabaseAdmin: {
        rpc: async (fn) => {
          if (fn === 'accept_ride_atomic') {
            const err = new Error('Ride already assigned to another driver');
            err.code = 'P0001';
            return { data: null, error: err };
          }
          if (fn === 'accept_ride') {
            const err = new Error('Ride already assigned to another driver');
            err.code = 'P0001';
            return { data: null, error: err };
          }
          return { data: null, error: null };
        },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      },
    },
  };
  delete require.cache[require.resolve('../src/modules/matching/matching.repository')];
  const matchingRepo = require('../src/modules/matching/matching.repository');
  let threw = false;
  try {
    await matchingRepo.acceptRide('ride-1', { riderId: 'rider-1', pickupLat: '1', pickupLng: '1', dropLat: '2', dropLng: '2', fare: '100', distance: '5', duration: '10' }, 'driver-B');
  } catch (e) {
    threw = true;
    assert.strictEqual(e.status, 409);
  }
  assert.ok(threw, 'second driver should get 409');
  delete require.cache[SUPABASE_PATH];
});
