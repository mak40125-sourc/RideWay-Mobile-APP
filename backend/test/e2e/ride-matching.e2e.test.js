/**
 * Velos / RideWay — Backend E2E: ride-matching pipeline
 *
 * Exercises the REAL stack (no rider/driver apps, no mocks on matching):
 *   auth → Socket.IO → /drivers/online + /drivers/location → Redis GEO/hash
 *   → POST /rides/request → Postgres create_ride_idempotent + Redis buffer
 *   → candidate-finder → offer-dispatcher → notification.service
 *   → Socket.IO room driver:<id> → ride:request
 *
 * Prerequisites:
 *   - backend running on E2E_BASE_URL (default http://localhost:3000)
 *     and owning Redis + Socket.IO (same process owns notification subscription)
 *   - backend/.env with SUPABASE_URL / ANON / SERVICE_ROLE, REDIS_HOST/PORT
 *   - optional AWS mode: E2E_BASE_URL=https://<lightsail>:3000
 *     optionally E2E_DRIVER_EMAIL/PASSWORD + E2E_RIDER_EMAIL/PASSWORD for
 *     pre-existing test users (otherwise ephemeral users are created and deleted)
 *
 * Run:
 *   npm run test:e2e:matching
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e:matching
 *   E2E_BASE_URL=http://100.81.138.116:3000 npm run test:e2e:matching
 *
 * IMPORTANT: never logs tokens / service keys. All secrets redacted.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const E2E_BASE = (process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const API = `${E2E_BASE}/api/v1`;
const WS_BASE = E2E_BASE.replace(/^http/, 'ws');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRIVER_POLE = { lat: 30.7621, lng: 76.6678 }; // production-ish default
const RADIUS_METERS = 3000; // must match matching.constants NEARBY_DRIVER_RADIUS_METERS
const SOCKET_TIMEOUT_MS = 9000;
const REQUEST_TIMEOUT_MS = 15000;

let ioClient = null;
try { ioClient = require('socket.io-client'); } catch {}
let IORedis = null;
try { IORedis = require('ioredis'); } catch {}
let supaAnon = null;
let supaAdmin = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  if (SUPABASE_URL && SUPABASE_ANON_KEY) supaAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch {}

// ---------------------------------------------------------------------------
// Helpers: banner + redacted log
// ---------------------------------------------------------------------------
function banner(lines) {
  const w = 50;
  const bar = '='.repeat(w);
  console.log(`\n${bar}\n${lines.map((l) => l.padEnd(w)).join('\n')}\n${bar}\n`);
}
function step(ok, label, detail) {
  const tag = ok ? '[PASS]' : '[FAIL]';
  console.log(`${tag} ${label}${detail ? ` :: ${detail}` : ''}`);
}
function diag(label, obj) {
  const safe = JSON.stringify(obj, (k, v) => {
    if (/token|secret|key|password|authorization/i.test(k)) return '***';
    if (typeof v === 'string' && v.length > 400) return v.slice(0, 400) + '…';
    return v;
  });
  console.log(`[DIAG] ${label} :: ${safe}`);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function redactToken(t) { return t ? `${t.slice(0, 8)}…${t.slice(-6)}` : null; }

// ---------------------------------------------------------------------------
// Helpers: HTTP + auth + Redis probe
// ---------------------------------------------------------------------------
async function apiReq(method, p, { token, body, extraHeaders } = {}) {
  const url = API + p;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extraHeaders || {}) };
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    let j = null;
    const text = await res.text();
    try { j = text ? JSON.parse(text) : null; } catch { j = text || null; }
    return { status: res.status, body: j, headers: res.headers, url, _raw: text };
  } finally { clearTimeout(t); }
}

async function signUpAndSignIn(email, role) {
  const pwd = `E2ePass_${crypto.randomBytes(6).toString('hex')}!Aa1`;
  const { error: suErr } = await supaAnon.auth.signUp({ email, password: pwd, options: { data: { name: email.split('@')[0], full_name: email.split('@')[0], role } } });
  if (suErr) throw new Error(`signUp ${email}: ${suErr.message}`);
  // small delay: trigger handle_new_user
  await sleep(600);
  const { data, error } = await supaAnon.auth.signInWithPassword({ email, password: pwd });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { userId: data.user.id, token: data.session.access_token, password: pwd, email };
}
async function signInExisting(email, password) {
  const { data, error } = await supaAnon.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn existing ${email}: ${error.message}`);
  return { userId: data.user.id, token: data.session.access_token, email };
}

async function redisProbe() {
  if (!IORedis) return { available: false, reason: 'ioredis not installed' };
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const c = new IORedis({ host, port, lazyConnect: true, enableReadyCheck: false, connectTimeout: 2500, retryStrategy: () => null });
  try {
    await c.connect();
    await c.ping();
    return { available: true, client: c, host, port };
  } catch (e) {
    try { c.disconnect(); } catch {}
    return { available: false, reason: e.message, host, port };
  }
}

// ---------------------------------------------------------------------------
// The E2E test — single test() with explicit phases so output is one banner
// ---------------------------------------------------------------------------
test('E2E: ride-matching pipeline (driver socket → online → geo → request → candidate → offer → ride:request)', async (t) => {
  // gate: need supabase + backend reachable; otherwise mark skip gracefully
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('SKIP: missing SUPABASE_URL/ANON/SERVICE_ROLE in backend/.env');
    t.skip('missing supabase env');
    return;
  }
  if (!ioClient) {
    console.log('SKIP: socket.io-client not installed (npm i -D socket.io-client)');
    t.skip('socket.io-client missing');
    return;
  }

  // quick health probe — if unreachable, skip rather than fail confusingly
  let healthOk = false;
  try {
    const h = await apiReq('GET', '/health'.replace('/api/v1', ''));
    // app.js exposes /health at root
    const res = await fetch(`${E2E_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    healthOk = res.ok;
    if (!healthOk) {
      // try API health via rides endpoint with fake token (expect 401 not ECONNREFUSED)
      const probe = await apiReq('GET', '/rides/rider/active', { token: 'invalid' });
      healthOk = probe.status === 401; // backend is up
    }
  } catch (e) {
    console.log(`SKIP: backend at ${E2E_BASE} unreachable: ${e.message}`);
    t.skip(`backend unreachable at ${E2E_BASE}`);
    return;
  }
  if (!healthOk) {
    console.log(`SKIP: backend at ${E2E_BASE} not healthy`);
    t.skip('backend not healthy');
    return;
  }

  banner(['VELOS RIDE MATCHING E2E', `BASE ${E2E_BASE}`, `SUPABASE ${SUPABASE_URL}`, `WS ${WS_BASE}`]);

  const timings = {};
  const created = { riderEphemeral: false, driverEphemeral: false, rideIds: [], driverOfflineDone: false };
  let rider = null;
  let driver = null;
  let driverSocket = null;
  let redisProbeInfo = null;
  let rideId = null;
  let rideResponse = null;
  let socketPayload = null;
  let socketError = null;

  const usingExistingCreds = !!(process.env.E2E_DRIVER_EMAIL && process.env.E2E_RIDER_EMAIL);

  // ensure cleanup even on assertion failure
  async function cleanup() {
    const quiet = async (p) => { try { await p; } catch {} };
    if (driverSocket) {
      try { driverSocket.removeAllListeners(); driverSocket.disconnect(); } catch {}
      await sleep(200);
    }
    // redis + DB cleanup: only ephemeral data
    if (redisProbeInfo && redisProbeInfo.available && redisProbeInfo.client) {
      try {
        if (driver) {
          await redisProbeInfo.client.del(`driver:${driver.userId}`).catch(() => {});
          await redisProbeInfo.client.zrem('drivers:online', driver.userId).catch(() => {});
        }
        for (const id of created.rideIds) {
          await redisProbeInfo.client.del(`ride:request:${id}`).catch(() => {});
          await redisProbeInfo.client.del(`ride:offers:${id}`).catch(() => {});
          await redisProbeInfo.client.del(`ride:lock:${id}`).catch(() => {});
          await redisProbeInfo.client.del(`ride:passenger:${id}`).catch(() => {});
        }
      } catch {}
      try { redisProbeInfo.client.quit(); } catch {}
    } else if (driver && !usingExistingCreds) {
      // fallback: ask backend to take driver offline
      try { await apiReq('PUT', '/drivers/online', { token: driver.token, body: { isOnline: false } }); } catch {}
    }
    if (supaAdmin) {
      for (const id of created.rideIds) {
        await quiet(supaAdmin.from('rides').delete().eq('id', id));
      }
      if (created.driverEphemeral && driver) {
        await quiet(supaAdmin.from('driver_documents').delete().eq('driver_id', driver.userId));
        await quiet(supaAdmin.from('drivers').delete().eq('id', driver.userId));
        await quiet(supaAdmin.from('profiles').delete().eq('id', driver.userId));
        try { await supaAdmin.auth.admin.deleteUser(driver.userId); } catch {}
      }
      if (created.riderEphemeral && rider) {
        await quiet(supaAdmin.from('profiles').delete().eq('id', rider.userId));
        try { await supaAdmin.auth.admin.deleteUser(rider.userId); } catch {}
      }
    }
  }

  try {
    // -----------------------------------------------------------------
    // A. identities
    // -----------------------------------------------------------------
    const idempotencyKey = `e2e-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

    if (usingExistingCreds) {
      const dEmail = process.env.E2E_DRIVER_EMAIL;
      const dPass = process.env.E2E_DRIVER_PASSWORD;
      const rEmail = process.env.E2E_RIDER_EMAIL;
      const rPass = process.env.E2E_RIDER_PASSWORD;
      if (!dPass || !rPass) throw new Error('E2E_DRIVER_PASSWORD / E2E_RIDER_PASSWORD required when E2E_*_EMAIL is set');
      driver = await signInExisting(dEmail, dPass);
      rider = await signInExisting(rEmail, rPass);
      step(true, 'Driver authenticated (existing)', `userId=${driver.userId} token=${redactToken(driver.token)}`);
      step(true, 'Rider authenticated (existing)', `userId=${rider.userId}`);
    } else {
      const suffix = Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
      const dEmail = `e2e.driver.${suffix}@rideway.test`;
      const rEmail = `e2e.rider.${suffix}@rideway.test`;
      driver = await signUpAndSignIn(dEmail, 'driver');
      rider = await signUpAndSignIn(rEmail, 'rider');
      created.driverEphemeral = true;
      created.riderEphemeral = true;
      // profiles/drivers upserts (handle_new_user trigger may already create profile)
      await supaAdmin.from('profiles').upsert({ id: rider.userId, full_name: 'E2E Rider', role: 'rider' }, { onConflict: 'id' });
      await supaAdmin.from('profiles').upsert({ id: driver.userId, full_name: 'E2E Driver', role: 'driver' }, { onConflict: 'id' });
      const { error: drvErr } = await supaAdmin.from('drivers').upsert({
        id: driver.userId, user_id: driver.userId, vehicle_type: 'bike',
        vehicle_number: 'PB-04-Y-5288', kyc_status: 'verified', is_verified: true,
      }, { onConflict: 'id' });
      if (drvErr) throw new Error(`drivers upsert: ${drvErr.message}`);
      step(true, 'Driver authenticated (ephemeral)', `userId=${driver.userId} bike PB-04-Y-5288`);
      step(true, 'Rider authenticated (ephemeral)', `userId=${rider.userId}`);
    }

    // sanity: driver must be bike
    {
      const { data: drv } = await supaAdmin.from('drivers').select('vehicle_type, vehicle_number').eq('user_id', driver.userId).maybeSingle();
      assert.ok(drv, 'drivers row must exist');
      assert.strictEqual(drv.vehicle_type, 'bike', 'driver vehicle_type must be bike for this test');
    }

    // -----------------------------------------------------------------
    // B. fake driver Socket.IO (same auth as app)
    // -----------------------------------------------------------------
    redisProbeInfo = await redisProbe();
    diag('Redis probe', redisProbeInfo.available ? { available: true, host: redisProbeInfo.host, port: redisProbeInfo.port } : redisProbeInfo);

    const driverRoom = `driver:${driver.userId}`;
    let connected = false;
    let socketId = null;
    driverSocket = ioClient.io(WS_BASE, {
      auth: { token: driver.token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 6000,
    });

    const connectPromise = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('Socket.IO connect timeout')), 7000);
      driverSocket.once('connect', () => { clearTimeout(to); connected = true; socketId = driverSocket.id; resolve(); });
      driverSocket.once('connect_error', (e) => { clearTimeout(to); reject(new Error(`connect_error: ${e.message}`)); });
    });
    await connectPromise;
    step(true, 'Driver Socket.IO connected', `sid=${socketId} room=${driverRoom}`);
    assert.ok(connected, 'driver socket must connect');

    // -----------------------------------------------------------------
    // C. driver ONLINE (real endpoint)
    // -----------------------------------------------------------------
    const onlineRes = await apiReq('PUT', '/drivers/online', { token: driver.token, body: { isOnline: true } });
    assert.strictEqual(onlineRes.status, 200, `PUT /drivers/online must be 200, got ${onlineRes.status} ${JSON.stringify(onlineRes.body)}`);
    step(true, 'Driver ONLINE', `status=${onlineRes.status}`);

    // -----------------------------------------------------------------
    // D. driver location — very close to pickup
    // -----------------------------------------------------------------
    const driverLat = DRIVER_POLE.lat;
    const driverLng = DRIVER_POLE.lng;
    const locRes = await apiReq('PUT', '/drivers/location', { token: driver.token, body: { location: { latitude: driverLat, longitude: driverLng } } });
    assert.strictEqual(locRes.status, 200, `PUT /drivers/location must be 200, got ${locRes.status} ${JSON.stringify(locRes.body)}`);
    step(true, 'Driver location registered', `${driverLat},${driverLng}`);

    // verify Redis geo/hash (best-effort; fallback to /drivers/nearby when redis not directly reachable e.g. AWS)
    let geoOk = false;
    let hashOk = false;
    let nearbyViaApi = null;
    if (redisProbeInfo.available) {
      const c = redisProbeInfo.client;
      const members = await c.zrange('drivers:online', 0, -1);
      geoOk = members.includes(driver.userId);
      const h = await c.hgetall(`driver:${driver.userId}`);
      hashOk = !!(h && h.rideType === 'bike' && h.status === 'ONLINE');
      diag('Redis driver hash', h);
      diag('Redis drivers:online sample', members.slice(0, 8));
      step(geoOk, 'Redis geo candidate exists', geoOk ? `drivers:online contains driver` : `missing; members=${members.length}`);
      step(hashOk, 'Redis hash metadata correct', hashOk ? `rideType=bike ONLINE` : JSON.stringify(h));
    } else {
      // fallback: query production nearby API (authoritative check is still Redis-backed)
      const nr = await apiReq('GET', `/drivers/nearby?lat=${driverLat}&lng=${driverLng}&radius=${RADIUS_METERS}`, { token: rider.token });
      nearbyViaApi = nr.body;
      geoOk = Array.isArray(nr.body) && nr.body.some((d) => d && (d.user_id === driver.userId || d.driver_id === driver.userId || d.id === driver.userId));
      step(geoOk, 'Nearby drivers API sees driver', geoOk ? `found in nearby` : `body=${JSON.stringify(nr.body).slice(0, 400)} status=${nr.status}`);
      diag('nearby fallback', { status: nr.status, body: nearbyViaApi });
    }

    // -----------------------------------------------------------------
    // E/F. rider + listener BEFORE request
    // -----------------------------------------------------------------
    // rider already authenticated above
    step(true, 'Rider authenticated', `userId=${rider.userId}`);
    assert.ok(rider.token, 'rider token required');

    // register listener BEFORE ride request
    const rideRequestPromise = new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        // timeout is expected to be handled by diagnostic below, not as unhandled rejection
        resolve(null);
      }, SOCKET_TIMEOUT_MS);
      driverSocket.once('ride:request', (payload) => {
        clearTimeout(to);
        socketPayload = payload;
        resolve(payload);
      });
      driverSocket.once('connect_error', (e) => { socketError = e; });
      driverSocket.once('disconnect', (reason) => { diag('socket disconnect before ride', { reason }); });
    });

    // -----------------------------------------------------------------
    // G. request ride — bike, pickup very close to driver
    // -----------------------------------------------------------------
    const pickup = { lat: driverLat + 0.0007, lng: driverLng + 0.0007, address: 'E2E pickup' };
    const dropoff = { lat: driverLat + 0.012, lng: driverLng + 0.012, address: 'E2E drop' };
    diag('Ride request plan', { pickup, dropoff, vehicleType: 'bike', idempotencyKey, driverAt: { driverLat, driverLng } });

    const pricingProbeStart = Date.now();
    // pricing is inside createRideRequest; we measure the whole request but also
    // log the OSRM/haversine concern explicitly: the test MUST NOT install OSRM,
    // and the backend must fall back to haversine (pricing.service: haversineKm).
    // We capture this via elapsed time and via HTTP status (422 = bad vehicleType, not OSRM).
    const t0 = Date.now();
    rideResponse = await apiReq('POST', '/rides/request', {
      token: rider.token,
      body: {
        riderId: rider.userId,
        pickup, dropoff,
        // client fare hints — backend recomputes authoritatively
        fare: 10, distance: 0.1, duration: 1,
        vehicleType: 'bike',
        idempotencyKey,
      },
      extraHeaders: { 'x-idempotency-key': idempotencyKey },
    });
    timings.totalMs = Date.now() - t0;
    diag('POST /rides/request response', { status: rideResponse.status, body: rideResponse.body, elapsedMs: timings.totalMs, url: rideResponse.url });

    // -----------------------------------------------------------------
    // H. wait for matching pipeline
    // -----------------------------------------------------------------
    const tWait0 = Date.now();
    const received = await rideRequestPromise;
    timings.socketWaitMs = Date.now() - tWait0;

    // -----------------------------------------------------------------
    // I. assertions + failure diagnostics
    // -----------------------------------------------------------------
    // helper: verify ride row exists (postgres authoritative)
    let dbRide = null;
    let dbRideErr = null;
    if (supaAdmin) {
      try {
        const rid = rideResponse && rideResponse.body && rideResponse.body.rideId;
        if (rid) {
          const { data, error } = await supaAdmin.from('rides').select('id, status, rider_id, fare, pricing_version, idempotency_key').eq('id', rid).maybeSingle();
          dbRide = data || null;
          dbRideErr = error || null;
        }
      } catch (e) { dbRideErr = e; }
    }

    // holder for overall verdict
    const checks = [];
    function check(label, ok, detail) {
      checks.push({ label, ok, detail });
      step(ok, label, detail);
      return ok;
    }

    // 1: HTTP ride request succeeds
    const httpOk = rideResponse && (rideResponse.status === 201 || rideResponse.status === 200) && !!(rideResponse.body && rideResponse.body.rideId);
    check('Ride created (HTTP)', !!httpOk, httpOk ? `status=${rideResponse.status} rideId=${rideResponse.body.rideId} candidateCount=${rideResponse.body.candidateCount}` : `status=${rideResponse.status} body=${JSON.stringify(rideResponse.body).slice(0, 600)}`);

    if (rideResponse && rideResponse.body && rideResponse.body.rideId) {
      rideId = rideResponse.body.rideId;
      created.rideIds.push(rideId);
    }

    // 2: Ride record is created (DB)
    check('Ride record is created (DB)', !!dbRide, dbRide ? `id=${dbRide.id} status=${dbRide.status}` : `error=${dbRideErr ? String(dbRideErr.message || dbRideErr).slice(0, 200) : 'no id'}`);

    // 3/4/5: candidate discovery
    const candidateCount = rideResponse && rideResponse.body && typeof rideResponse.body.candidateCount === 'number' ? rideResponse.body.candidateCount : null;
    const candidateOk = typeof candidateCount === 'number' && candidateCount > 0;
    check('Candidate discovery found driver', !!candidateOk, `candidateCount=${candidateCount}`);

    // driver in candidate list is not directly returned by the API (only count), so we
    // infer via: candidateCount>0 + geoOk/hashOk + offer dispatched. The API does not
    // expose candidateIds to the rider; offer-dispatcher logs candidateIds server-side.
    // We treat candidateOk as success for #5 when geoOk/hashOk true.
    check('Driver ID in candidate list (inferred via geo+hash)', !!(candidateOk && geoOk), geoOk ? `geoOk` : `geo missing; candidateCount=${candidateCount}`);

    // 6: offer dispatch occurs — indicated by candidateCount>0 (offer-dispatcher runs only then)
    check('Offer dispatched', !!candidateOk, candidateOk ? `candidateCount>0 implies dispatchOffers ran` : `candidateCount=0 — dispatch skipped`);

    // 7: socket room exists — inferred from connected=true (server joins on connect)
    check('Socket.IO driver room exists', !!connected, `room=${driverRoom} sid=${socketId} connected=${connected}`);

    // 8: ride:request emitted — payload non-null means server emitted
    check('Socket.IO ride:request emitted', !!received, received ? `rideId=${received.rideId}` : `no event in ${SOCKET_TIMEOUT_MS}ms${socketError ? ` err=${socketError.message}` : ''}`);

    // 9/10/11: fake driver received, ids match, payload sane
    const payloadOk = !!(received && rideId && received.rideId === rideId);
    check('Fake driver received ride:request', !!received, received ? `received rideId=${received.rideId}` : 'no payload');
    check('Received ride ID matches created ride ID', !!payloadOk, payloadOk ? `match ${rideId}` : `expected ${rideId} got ${received ? received.rideId : 'null'}`);
    if (received) {
      diag('Received ride:request payload', received);
      const fareOk = typeof received.fare === 'number' && received.fare > 0;
      check('Received payload has fare/distance/duration', !!fareOk, `fare=${received.fare} distance=${received.distance} duration=${received.duration}`);
    }

    // -----------------------------------------------------------------
    // Elapsed breakdown
    // -----------------------------------------------------------------
    console.log(`\n[TIMING] pricing+request total=${timings.totalMs}ms socketWait=${timings.socketWaitMs}ms`);
    console.log(`[TIMING] note: pricing (OSRM → haversine fallback) runs BEFORE candidate discovery; totalMs includes pricing. OSRM at ${process.env.OSRM_BASE_URL || 'http://localhost:5000 (fallback expected)'}.\n`);

    // -----------------------------------------------------------------
    // Failure taxonomy — exactly the 5 buckets the spec demands
    // -----------------------------------------------------------------
    const failureTree = [];
    if (!httpOk) {
      failureTree.push('FAILURE D: RIDE CREATION / REQUEST PIPELINE FAILURE');
      diag('Failure D detail', { status: rideResponse.status, body: rideResponse.body });
      if (rideResponse.status === 422) failureTree.push(' -> hint: invalid pickup/dropoff/vehicleType');
      if (String(rideResponse.body && rideResponse.body.error).includes('fare_breakdown')) failureTree.push(' -> hint: stale DB (fare_breakdown missing)');
      if (timings.totalMs > 8000 && String(rideResponse.body && rideResponse.body.error).toLowerCase().includes('osrm')) failureTree.push(' -> hint: OSRM timeout path');
    }
    if (httpOk && candidateCount === 0) {
      failureTree.push('FAILURE A: BACKEND CANDIDATE DISCOVERY FAILURE');
      failureTree.push(` -> pickup=${pickup.lat},${pickup.lng} driver=${driverLat},${driverLng} radius=${RADIUS_METERS}m`);
      failureTree.push(` -> requested vehicleType=bike driver vehicle_type=bike`);
      if (redisProbeInfo && redisProbeInfo.available) {
        const members = await redisProbeInfo.client.zrange('drivers:online', 0, -1).catch(() => []);
        const h = await redisProbeInfo.client.hgetall(`driver:${driver.userId}`).catch(() => null);
        failureTree.push(` -> Redis drivers:online members=${JSON.stringify(members).slice(0, 300)}`);
        failureTree.push(` -> Redis driver hash=${JSON.stringify(h)}`);
      } else if (nearbyViaApi !== null) {
        failureTree.push(` -> nearby API body=${JSON.stringify(nearbyViaApi).slice(0, 500)}`);
      }
      failureTree.push(' -> Check: driver ONLINE? location close? radius? rideType repair? See candidate-finder logs (candidate_discovery).');
    }
    if (candidateOk && !received) {
      failureTree.push('FAILURE B: BACKEND SOCKET.IO DELIVERY FAILURE');
      failureTree.push(` -> candidate driverId=${driver.userId} expected room=${driverRoom}`);
      failureTree.push(` -> socket connected=${connected} socketId=${socketId} error=${socketError ? socketError.message : 'none'}`);
      failureTree.push(' -> notification.service checks io.of("/").adapter.rooms.get(room)?.size; 0 => ride:offer_undeliverable no_connected_socket');
      failureTree.push(' -> Ensure single backend process owns Socket.IO + Redis subscription (same server owns initSocket + initNotificationService). For multi-host, add socket.io-redis adapter.');
    }
    if (received && !payloadOk) {
      failureTree.push('FAILURE C: RIDE REQUEST / RESPONSE INTEGRATION FAILURE');
      failureTree.push(` -> HTTP rideId=${rideId} socket rideId=${received ? received.rideId : 'null'}`);
    }
    if (httpOk && String(rideResponse.body && rideResponse.body.error || '').toLowerCase().includes('route') || (!httpOk && timings.totalMs > 9000)) {
      // last guard: fare/routing
      failureTree.push('FAILURE E: FARE/ROUTING PIPELINE FAILURE (OSRM vs haversine)');
      diag('OSRM diagnostic', {
        osrmBase: process.env.OSRM_BASE_URL || 'http://localhost:5000',
        pricingFallback: 'haversineKm (pricing.service resolves via fallback, never blocks matching)',
        productionSequence: 'matching.service calls pricingService.quoteFare BEFORE createRideRequest buffer → candidate-finder',
        totalMs: timings.totalMs,
      });
    }
    if (failureTree.length) {
      console.log('\n[FAILURE DIAGNOSTIC TREE]');
      for (const l of failureTree) console.log(l);
    }

    // -----------------------------------------------------------------
    // OSRM / fare diagnostic (Phase 4)
    // -----------------------------------------------------------------
    console.log('\n[OSRM/FARE DIAGNOSTIC]');
    console.log(` OSRM_BASE_URL=${process.env.OSRM_BASE_URL || 'http://localhost:5000 (default)'}`);
    console.log(' Production sequence: quoteFare (OSRM → haversine fallback) runs BEFORE candidate discovery.');
    console.log(' With OSRM down, pricing.service logs route_fallback and continues via haversine — matching is NOT blocked.');
    console.log(` This run: totalMs=${timings.totalMs} — OSRM unavailability shows as ~8s timeout + route_fallback warn, not 422/500 if fallback works.`);

    // -----------------------------------------------------------------
    // Final verdict banner (spec format)
    // -----------------------------------------------------------------
    const allPass = checks.every((c) => c.ok);
    banner([
      'VELOS RIDE MATCHING E2E',
      '',
      ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.label}`),
      '',
      `RESULT: BACKEND MATCHING PIPELINE = ${allPass ? 'PASS' : 'FAIL'}`,
      allPass ? '' : 'See [FAIL] lines + failure diagnostic tree above.',
    ]);

    // node:test assertion: fail the test if not all pass, with clear message
    if (!allPass) {
      const failed = checks.filter((c) => !c.ok).map((c) => c.label).join(', ');
      assert.fail(`E2E matching pipeline FAILED: ${failed}. See logs above for Failure A-E taxonomy.`);
    }
    // soft-assert OSRM note: the harness already proved fallback works if httpOk.
    assert.ok(httpOk, 'HTTP ride creation must succeed for E2E PASS');
  } catch (err) {
    // ensure banner shows failure even on thrown error
    console.log('\n[UNHANDLED ERROR]', err && err.stack ? err.stack : String(err));
    throw err;
  } finally {
    await cleanup();
  }
});
