const test = require('node:test');
const assert = require('node:assert');

// Wave discovery tests: 2-driver waves + 10s individual server-authoritative
// offers. Repository, offer-dispatcher, supabase, and logger are mocked;
// wave-dispatcher + acceptance-manager run for real.

const LOGGER_PATH = require.resolve('../src/core/logger/logger');
const MATCHING_REPO_PATH = require.resolve('../src/modules/matching/matching.repository');
const OFFER_DISPATCHER_PATH = require.resolve('../src/modules/matching/offer-dispatcher');
const WAVE_PATH = require.resolve('../src/modules/matching/wave-dispatcher');
const ACCEPT_PATH = require.resolve('../src/modules/matching/acceptance-manager');
const SUPABASE_PATH = require.resolve('../src/core/database/supabase');

function installLogger() {
  require.cache[LOGGER_PATH] = {
    id: LOGGER_PATH,
    filename: LOGGER_PATH,
    loaded: true,
    exports: {
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      stage: () => {},
      track: () => {},
      currentCorrelationId: () => 'corr-test',
    },
  };
}

// In-memory fake of the matching repository surface used by waves.
function installRepo() {
  const store = {
    requests: {}, // rideId -> rideData (presence = global 120s TTL alive)
    waves: {}, // rideId -> wave state
    offers: {}, // rideId -> { driverId -> offer }
    published: [], // every publishNotification payload
    locks: {},
    transitions: {}, // "rideId:from->to" -> claimed (mirrors Redis SET NX)
  };
  require.cache[MATCHING_REPO_PATH] = {
    id: MATCHING_REPO_PATH,
    filename: MATCHING_REPO_PATH,
    loaded: true,
    exports: {
      createRideRequest: async (rideId, data) => { store.requests[rideId] = data; },
      getRideRequest: async (rideId) => store.requests[rideId] || null,
      deleteRideRequest: async (rideId) => { delete store.requests[rideId]; },
      setRidePassenger: async () => {},
      getRidePassenger: async () => null,
      getNearbyDrivers: async () => [],
      getDriver: async () => null,
      repairDriverMetadata: async () => null,
      addDriversToQueue: async () => {},
      deleteQueue: async () => {},
      acquireRideLock: async (rideId, driverId) => {
        if (store.locks[rideId]) return false;
        store.locks[rideId] = driverId;
        return true;
      },
      releaseRideLock: async (rideId) => { delete store.locks[rideId]; },
      publishNotification: async (channel, message) => { store.published.push({ channel, message }); },
      getRiderName: async () => 'Rider',
      acceptRide: async (rideId, rideData, driverId) => {
        store.assigned = { id: rideId, driver_id: driverId, status: 'DRIVER_ASSIGNED' };
        return { ...store.assigned };
      },
      setWaveState: async (rideId, state) => {
        const prev = store.waves[rideId] || {};
        store.waves[rideId] = { ...prev, ...state };
      },
      getWaveState: async (rideId) => store.waves[rideId] || null,
      deleteWaveState: async (rideId) => { delete store.waves[rideId]; },
      claimWaveTransition: async (rideId, fromWave, toWave) => {
        const key = `${rideId}:${fromWave}->${toWave}`;
        if (store.transitions[key]) return false; // SET NX: already claimed
        store.transitions[key] = Date.now();
        return true;
      },
      setDriverOffers: async (rideId, offers) => {
        store.offers[rideId] = store.offers[rideId] || {};
        for (const o of offers) store.offers[rideId][o.driverId] = { ...o };
      },
      getDriverOffers: async (rideId) => ({ ...(store.offers[rideId] || {}) }),
      getDriverOffer: async (rideId, driverId) => (store.offers[rideId] || {})[driverId] || null,
      updateOfferStatus: async (rideId, driverId, status) => {
        const offer = (store.offers[rideId] || {})[driverId];
        if (!offer) return null;
        offer.status = status;
        return offer;
      },
      deleteOfferState: async (rideId) => { delete store.offers[rideId]; },
      getRideRequestTtl: async (rideId) => (store.requests[rideId] ? 100 : -2),
    },
  };
  return store;
}

function installOfferDispatcher(store) {
  require.cache[OFFER_DISPATCHER_PATH] = {
    id: OFFER_DISPATCHER_PATH,
    filename: OFFER_DISPATCHER_PATH,
    loaded: true,
    exports: {
      dispatchOffers: async (rideId, payload) => {
        store.published.push({
          channel: 'ride:notifications',
          message: { rideId, candidateDriverIds: payload.candidateIds, expiresAt: payload.offerExpiresAt, waveNumber: payload.waveNumber },
        });
      },
      dispatchOfferCancelled: async (rideId, payload) => {
        store.published.push({
          channel: 'ride:notifications',
          message: { type: 'offer_cancelled', rideId, ...payload },
        });
      },
    },
  };
}

function installSupabase(store) {
  require.cache[SUPABASE_PATH] = {
    id: SUPABASE_PATH,
    filename: SUPABASE_PATH,
    loaded: true,
    exports: {
      supabaseAdmin: {
        // Mirrors production: after a winner persists, losers see driver_id set → 409.
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: store.assigned || null, error: null }) }) }) }),
        rpc: async () => ({ data: null, error: null }),
      },
    },
  };
}

function freshWave() {
  delete require.cache[WAVE_PATH];
  delete require.cache[ACCEPT_PATH];
  return { wave: require(WAVE_PATH), acceptMod: require(ACCEPT_PATH) };
}

const CTX = (over = {}) => ({
  correlationId: 'corr-test',
  riderId: 'rider-1',
  pickup: { lat: 1, lng: 1, address: '' },
  dropoff: { lat: 2, lng: 2, address: '' },
  fare: 100,
  distance: 5,
  duration: 10,
  passengerName: null,
  passengerPhone: null,
  ...over,
});

// ── Wave formation ──────────────────────────────────────────────
test('createWaves chunks nearest-first ids into max-2 waves', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave } = freshWave();
  try {
    assert.deepStrictEqual(wave.createWaves([]), []);
    assert.deepStrictEqual(wave.createWaves(['A']), [['A']]);
    assert.deepStrictEqual(wave.createWaves(['A', 'B']), [['A', 'B']]);
    assert.deepStrictEqual(wave.createWaves(['A', 'B', 'C']), [['A', 'B'], ['C']]);
    assert.deepStrictEqual(wave.createWaves(['A', 'B', 'C', 'D']), [['A', 'B'], ['C', 'D']]);
    assert.deepStrictEqual(wave.createWaves(['A', 'B', 'C', 'D', 'E']), [['A', 'B'], ['C', 'D'], ['E']]);
  } finally {
    wave.stopWaves('__none__');
  }
});

test('startWaves dispatches ONLY wave 1 with 10s individual offers', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave } = freshWave();
  const rideId = 'ride-wave1';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    const before = Date.now();
    const { waveCount } = await wave.startWaves(rideId, ['A', 'B', 'C', 'D'], CTX());
    assert.strictEqual(waveCount, 2);
    assert.strictEqual(store.published.length, 1);
    assert.deepStrictEqual(store.published[0].message.candidateDriverIds, ['A', 'B']);
    const offers = await require(MATCHING_REPO_PATH).getDriverOffers(rideId);
    assert.deepStrictEqual(Object.keys(offers).sort(), ['A', 'B']);
    for (const id of ['A', 'B']) {
      assert.strictEqual(offers[id].status, 'active');
      const ttl = offers[id].expiresAt - before;
      assert.ok(ttl > 9000 && ttl <= 11000, `offer window ~10s, got ${ttl}`);
    }
    const state = await require(MATCHING_REPO_PATH).getWaveState(rideId);
    assert.strictEqual(state.waveNumber, 1);
    assert.strictEqual(state.status, 'active');
  } finally {
    wave.stopWaves(rideId);
  }
});

test('no advance while one wave driver is still active', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave } = freshWave();
  const rideId = 'ride-still-active';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C'], CTX());
    const res = await wave.advanceWaveIfNeeded(rideId);
    assert.strictEqual(res.advanced, false);
    assert.strictEqual(res.reason, 'wave_still_active');
    assert.strictEqual(store.published.length, 1); // wave 2 NOT dispatched
  } finally {
    wave.stopWaves(rideId);
  }
});

test('both reject in wave 1 → wave 2 dispatches; single reject waits', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave, acceptMod } = freshWave();
  const rideId = 'ride-reject-advance';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C'], CTX());
    await acceptMod.rejectRide(rideId, 'A');
    assert.strictEqual(store.published.length, 1); // B still active → wait
    await acceptMod.rejectRide(rideId, 'B');
    assert.strictEqual(store.published.length, 2); // wave 2 dispatched
    assert.deepStrictEqual(store.published[1].message.candidateDriverIds, ['C']);
    assert.strictEqual(store.published[1].message.waveNumber, 2);
  } finally {
    wave.stopWaves(rideId);
  }
});

test('both offers expire → next wave dispatches', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave } = freshWave();
  const rideId = 'ride-expire-advance';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C', 'D'], CTX());
    // Force expiry server-side (timers only trigger the check; state decides).
    store.offers[rideId].A.expiresAt = Date.now() - 1;
    store.offers[rideId].B.expiresAt = Date.now() - 1;
    const res = await wave.advanceWaveIfNeeded(rideId);
    assert.strictEqual(res.advanced, true);
    assert.deepStrictEqual(store.published[1].message.candidateDriverIds, ['C', 'D']);
    const repo = require(MATCHING_REPO_PATH);
    assert.strictEqual((await repo.getDriverOffer(rideId, 'A')).status, 'expired');
  } finally {
    wave.stopWaves(rideId);
  }
});

test('accept wins, peer offer cancelled, future waves stopped', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store); // no pre-existing owner → normal RPC path
  const { wave, acceptMod } = freshWave();
  const rideId = 'ride-accept-win';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C'], CTX());
    const ride = await acceptMod.acceptRide(rideId, 'A');
    assert.strictEqual(ride.status, 'DRIVER_ASSIGNED');
    const cancel = store.published.find((p) => p.message.type === 'offer_cancelled');
    assert.ok(cancel, 'cancellation published');
    assert.deepStrictEqual(cancel.message.cancelledDriverIds, ['B']);
    assert.strictEqual(cancel.message.reason, 'driver_assigned');
    // Late accept by B is rejected even though the wave had offered them.
    await assert.rejects(acceptMod.acceptRide(rideId, 'B'), /already assigned|cancelled|No active offer/i);
    assert.strictEqual(store.published.filter((p) => !p.message.type).length, 1); // no wave 2
  } finally {
    wave.stopWaves(rideId);
  }
});

test('accept after individual 10s expiry is rejected (410)', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave, acceptMod } = freshWave();
  const rideId = 'ride-late-accept';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A'], CTX());
    store.offers[rideId].A.expiresAt = Date.now() - 1;
    await assert.rejects(acceptMod.acceptRide(rideId, 'A'), (err) => {
      assert.strictEqual(err.status, 410);
      return true;
    });
  } finally {
    wave.stopWaves(rideId);
  }
});

test('accept with no offer for driver is rejected (404)', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave, acceptMod } = freshWave();
  const rideId = 'ride-no-offer';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A'], CTX());
    await assert.rejects(acceptMod.acceptRide(rideId, 'ZZZ'), (err) => {
      assert.strictEqual(err.status, 404);
      return true;
    });
  } finally {
    wave.stopWaves(rideId);
  }
});

test('reject with no offer is 404; duplicate reject is idempotent', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave, acceptMod } = freshWave();
  const rideId = 'ride-reject-edge';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B'], CTX());
    await assert.rejects(acceptMod.rejectRide(rideId, 'ZZZ'), (err) => {
      assert.strictEqual(err.status, 404);
      return true;
    });
    const first = await acceptMod.rejectRide(rideId, 'A');
    assert.strictEqual(first.status, 'rejected');
    const dup = await acceptMod.rejectRide(rideId, 'A');
    assert.strictEqual(dup.alreadyInactive, true);
  } finally {
    wave.stopWaves(rideId);
  }
});

test('global 120s expiry stops waves: no wave 2 after request gone', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave } = freshWave();
  const rideId = 'ride-global-ttl';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C'], CTX());
    store.offers[rideId].A.expiresAt = Date.now() - 1;
    store.offers[rideId].B.expiresAt = Date.now() - 1;
    delete store.requests[rideId]; // global TTL lapsed
    const res = await wave.advanceWaveIfNeeded(rideId);
    assert.strictEqual(res.advanced, false);
    assert.strictEqual(res.reason, 'global_request_expired');
    assert.strictEqual(store.published.length, 1);
  } finally {
    wave.stopWaves(rideId);
  }
});

// ── Race-guard tests (B1/B2 fixes) ──────────────────────────────

// TEST 1 — concurrent advancement: two overlapping advanceWaveIfNeeded calls
// must produce exactly ONE wave N+1 dispatch (single SET NX winner).
test('TEST 1: concurrent advancement dispatches next wave exactly once', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave } = freshWave();
  const rideId = 'ride-race-advance';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C', 'D'], CTX());
    store.offers[rideId].A.expiresAt = Date.now() - 1;
    store.offers[rideId].B.expiresAt = Date.now() - 1;
    const [r1, r2] = await Promise.all([
      wave.advanceWaveIfNeeded(rideId),
      wave.advanceWaveIfNeeded(rideId),
    ]);
    const winners = [r1, r2].filter((r) => r.advanced);
    assert.strictEqual(winners.length, 1, `exactly one winner, got ${JSON.stringify([r1, r2])}`);
    // Only one wave-2 publication: setDriverOffers ran once, so the 10s
    // expiry was written once and never refreshed by a duplicate dispatch.
    const wave2pubs = store.published.filter((p) => p.message.waveNumber === 2);
    assert.strictEqual(wave2pubs.length, 1);
    assert.deepStrictEqual(wave2pubs[0].message.candidateDriverIds, ['C', 'D']);
  } finally {
    wave.stopWaves(rideId);
  }
});

// TEST 2 — reject/reject race: simultaneous peer rejects → one next wave.
test('TEST 2: simultaneous rejects dispatch next wave exactly once', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave, acceptMod } = freshWave();
  const rideId = 'ride-race-reject';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C'], CTX());
    await Promise.all([acceptMod.rejectRide(rideId, 'A'), acceptMod.rejectRide(rideId, 'B')]);
    const wave2pubs = store.published.filter((p) => p.message.waveNumber === 2);
    assert.strictEqual(wave2pubs.length, 1);
    assert.deepStrictEqual(wave2pubs[0].message.candidateDriverIds, ['C']);
  } finally {
    wave.stopWaves(rideId);
  }
});

// TEST 3 — reject + expiry race: peer reject overlapping the expiry check.
test('TEST 3: reject overlapping expiry check dispatches next wave exactly once', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave, acceptMod } = freshWave();
  const rideId = 'ride-race-reject-expiry';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C'], CTX());
    store.offers[rideId].A.expiresAt = Date.now() - 1; // timer side sees expiry
    await Promise.all([acceptMod.rejectRide(rideId, 'B'), wave.advanceWaveIfNeeded(rideId)]);
    const wave2pubs = store.published.filter((p) => p.message.waveNumber === 2);
    assert.strictEqual(wave2pubs.length, 1);
    assert.deepStrictEqual(wave2pubs[0].message.candidateDriverIds, ['C']);
  } finally {
    wave.stopWaves(rideId);
  }
});

// TEST 4 — accept vs advance: after a win, advancement sends nothing.
test('TEST 4: advancement after acceptance sends no further offers', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave, acceptMod } = freshWave();
  const rideId = 'ride-race-accept-advance';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C'], CTX());
    await acceptMod.acceptRide(rideId, 'A');
    const offerPubsBefore = store.published.filter((p) => !p.message.type).length;
    const res = await wave.advanceWaveIfNeeded(rideId);
    assert.strictEqual(res.advanced, false);
    const offerPubsAfter = store.published.filter((p) => !p.message.type).length;
    assert.strictEqual(offerPubsAfter, offerPubsBefore, 'no Wave N+1 ride:request after win');
  } finally {
    wave.stopWaves(rideId);
  }
});

// TEST 5 — completed wave dispatch protection: dispatchWave refuses against
// a wave whose authoritative state already became completed.
test('TEST 5: dispatchWave refuses when authoritative wave state is completed', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave } = freshWave();
  const rideId = 'ride-race-stale-dispatch';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C'], CTX());
    // Simulate the winner path: wave completed before dispatchWave runs.
    store.waves[rideId] = { ...store.waves[rideId], status: 'completed' };
    const pubsBefore = store.published.length;
    const res = await wave.dispatchWave(rideId, 2, ['C'], ['A', 'B', 'C'], CTX(), { expectedPriorWaveNumber: 1 });
    assert.strictEqual(res.dispatched, false);
    assert.strictEqual(res.reason, 'stale_or_completed_wave');
    assert.strictEqual(store.published.length, pubsBefore, 'no ride:request published');
    const repo = require(MATCHING_REPO_PATH);
    assert.strictEqual(await repo.getDriverOffer(rideId, 'C'), null, 'no stale offer created');
  } finally {
    wave.stopWaves(rideId);
  }
});

// TEST 6 — stale transition: claiming wave N → N+1 twice; second exits safely.
test('TEST 6: same transition claimed twice — first wins, second exits', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  freshWave();
  const repo = require(MATCHING_REPO_PATH);
  const rideId = 'ride-race-claim';
  try {
    assert.strictEqual(await repo.claimWaveTransition(rideId, 1, 2), true);
    assert.strictEqual(await repo.claimWaveTransition(rideId, 1, 2), false);
    // A different transition is unaffected (see TEST 7 for end-to-end proof).
    assert.strictEqual(await repo.claimWaveTransition(rideId, 2, 3), true);
  } finally {
    const { wave } = freshWave();
    wave.stopWaves(rideId);
  }
});

// TEST 7 — legitimate progression: per-transition keys never block the next wave.
test('TEST 7: waves 1→2→3 each dispatch exactly once', async () => {
  installLogger();
  const store = installRepo();
  installOfferDispatcher(store);
  installSupabase(store);
  const { wave } = freshWave();
  const rideId = 'ride-race-progress';
  store.requests[rideId] = { riderId: 'rider-1' };
  try {
    await wave.startWaves(rideId, ['A', 'B', 'C', 'D', 'E'], CTX());
    store.offers[rideId].A.expiresAt = Date.now() - 1;
    store.offers[rideId].B.expiresAt = Date.now() - 1;
    const r1 = await wave.advanceWaveIfNeeded(rideId);
    assert.strictEqual(r1.advanced, true);
    assert.strictEqual(r1.waveNumber, 2);
    store.offers[rideId].C.expiresAt = Date.now() - 1;
    store.offers[rideId].D.expiresAt = Date.now() - 1;
    const r2 = await wave.advanceWaveIfNeeded(rideId);
    assert.strictEqual(r2.advanced, true);
    assert.strictEqual(r2.waveNumber, 3);
    const pubs = store.published.filter((p) => !p.message.type);
    assert.strictEqual(pubs.length, 3); // wave 1 + wave 2 + wave 3, each once
    assert.deepStrictEqual(pubs[2].message.candidateDriverIds, ['E']);
    assert.strictEqual(pubs[2].message.waveNumber, 3);
  } finally {
    wave.stopWaves(rideId);
  }
});
