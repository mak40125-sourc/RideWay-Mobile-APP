const test = require('node:test');
const assert = require('node:assert');

const ACTIVE_STATUSES = ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'RIDE_STARTED'];
const TERMINAL_STATUSES = ['RIDE_COMPLETED', 'CANCELLED', 'IDLE'];
const FRESHNESS_MS = 24 * 60 * 60 * 1000;

const SUPABASE_MODULE_PATH = require.resolve('../src/core/database/supabase');
const REPOSITORY_MODULE_PATH = require.resolve('../src/modules/ride/ride.repository');

function createSupabaseChain(returnData) {
  const calls = { filters: [], statuses: null, gte: null, orders: [], limits: [] };
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: (col, val) => {
      calls.filters.push({ col, val });
      return chain;
    },
    in: (col, vals) => {
      calls.statuses = { col, vals };
      return chain;
    },
    gte: (col, val) => {
      calls.gte = { col, val };
      return chain;
    },
    order: (col, opts) => {
      calls.orders.push({ col, opts });
      return chain;
    },
    limit: (n) => {
      calls.limits.push(n);
      return chain;
    },
    maybeSingle: async () => ({ data: returnData, error: null }),
  };
  return { chain, calls };
}

function loadRepository(returnData) {
  const { chain, calls } = createSupabaseChain(returnData);
  require.cache[SUPABASE_MODULE_PATH] = {
    id: SUPABASE_MODULE_PATH,
    filename: SUPABASE_MODULE_PATH,
    loaded: true,
    exports: { supabaseAdmin: chain },
  };
  delete require.cache[REPOSITORY_MODULE_PATH];
  const repository = require(REPOSITORY_MODULE_PATH);
  return { repository, calls };
}

test('a fresh DRIVER_ASSIGNED ride is returned', async () => {
  const fresh = {
    id: 'fresh-assigned',
    status: 'DRIVER_ASSIGNED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rider_id: 'rider-1',
  };
  const { repository } = loadRepository(fresh);
  const result = await repository.getRiderActiveRide('rider-1');
  assert.deepStrictEqual(result, fresh);
});

test('a DRIVER_ASSIGNED ride older than 24h is ignored', async () => {
  // null returnData simulates the DB excluding the stale row via the gte filter.
  const { repository, calls } = loadRepository(null);
  const result = await repository.getRiderActiveRide('rider-1');
  assert.strictEqual(result, null);
  assert.strictEqual(calls.gte.col, 'updated_at');
  const expected = new Date(Date.now() - FRESHNESS_MS).getTime();
  const actual = new Date(calls.gte.val).getTime();
  // Slack absorbs sub-second clock adjustments between the two Date.now() reads.
  assert.ok(actual >= expected - 60 * 1000, 'threshold must be at or after now - 24h');
  assert.ok(actual <= Date.now() + 60 * 1000, 'threshold must not be in the future');
});

test('a fresh DRIVER_ARRIVING ride is returned', async () => {
  const fresh = {
    id: 'fresh-arriving',
    status: 'DRIVER_ARRIVING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rider_id: 'rider-1',
  };
  const { repository } = loadRepository(fresh);
  const result = await repository.getRiderActiveRide('rider-1');
  assert.deepStrictEqual(result, fresh);
});

test('a stale RIDE_STARTED ride older than 24h is ignored', async () => {
  const { repository, calls } = loadRepository(null);
  const result = await repository.getRiderActiveRide('rider-1');
  assert.strictEqual(result, null);
  assert.strictEqual(calls.gte.col, 'updated_at');
  const actual = new Date(calls.gte.val).getTime();
  assert.ok(actual >= new Date(Date.now() - FRESHNESS_MS).getTime() - 60 * 1000);
});

test('terminal rides remain excluded', async () => {
  const { repository, calls } = loadRepository(null);
  await repository.getRiderActiveRide('rider-1');
  assert.deepStrictEqual(calls.statuses.vals, ACTIVE_STATUSES);
  for (const status of TERMINAL_STATUSES) {
    assert.ok(!calls.statuses.vals.includes(status), `terminal status ${status} must not be active`);
  }
});

test('multiple stale active rides result in null rather than an old ride', async () => {
  // All stale non-terminal rows are excluded by the gte filter, so the DB
  // returns no row and the endpoint reports no active ride.
  const { repository, calls } = loadRepository(null);
  const result = await repository.getRiderActiveRide('rider-1');
  assert.strictEqual(result, null);
  assert.strictEqual(calls.gte.col, 'updated_at');
  assert.deepStrictEqual(calls.orders, [{ col: 'created_at', opts: { ascending: false } }]);
  assert.deepStrictEqual(calls.limits, [1]);
});