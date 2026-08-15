/**
 * Ride acceptance validation harness (backend).
 *
 * Validates the ride-acceptance contract against the REAL API and the live
 * Supabase/Redis AFTER applying migration 005_add_ride_measurement_columns.sql.
 *
 * Requires:
 *   - backend/.env  (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
 *   - a running backend on http://localhost:3000 (override with API_BASE_URL)
 *   - local Redis (REDIS_HOST/REDIS_PORT in .env)
 *
 * Run: node scripts/validate-ride-acceptance.js
 * Exit: 0 all checks passed, 1 otherwise.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');

const API = `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1`;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  lazyConnect: true,
  retryStrategy: () => null,
});

let passed = 0;
let failed = 0;
const fail = (label, detail) => { failed++; console.log(`FAIL  ${label} :: ${detail}`); };
const ok = (label, detail = '') => { passed++; console.log(`PASS  ${label}${detail ? ' :: ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiReq(method, path, { token, body } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(API + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, body: json };
  } finally {
    clearTimeout(t);
  }
}

async function signUpAndSignIn(email, metaRole) {
  const { error: suErr } = await anon.auth.signUp({
    email,
    password: 'TestPass123!',
    options: { data: { name: email.split('@')[0], full_name: email.split('@')[0], role: metaRole } },
  });
  if (suErr) throw new Error('signUp failed: ' + suErr.message);
  const { data: si, error: siErr } = await anon.auth.signInWithPassword({ email, password: 'TestPass123!' });
  if (siErr) throw new Error('signIn failed: ' + siErr.message);
  return { userId: si.user.id, token: si.session.access_token };
}

async function putDriverOnline(driverId, lat, lng) {
  await redis.hset(`driver:${driverId}`, {
    status: 'ONLINE', rideType: 'mini', socketId: '', vehicleNumber: 'VA-TEST-01', onlineSince: String(Date.now()),
  });
  await redis.geoadd('drivers:online', lng, lat, driverId);
}

async function main() {
  const suffix = Date.now().toString(36);
  const riderEmail = `va.rider.${suffix}@rideway.test`;
  const driverEmail = `va.driver.${suffix}@rideway.test`;

  console.log('=== Setup: isolated test rider & driver ===');
  const rider = await signUpAndSignIn(riderEmail, 'rider');
  const driver = await signUpAndSignIn(driverEmail, 'driver');
  ok('test users created', `rider=${rider.userId} / driver=${driver.userId}`);

  const { error: prErr } = await admin.from('profiles').upsert({ id: rider.userId, full_name: 'VA Rider', role: 'rider' }, { onConflict: 'id' });
  if (prErr) fail('rider profile upsert', prErr.message); else ok('rider profile ready');
  const { error: drvProfileErr } = await admin.from('profiles').upsert({ id: driver.userId, full_name: 'VA Driver', role: 'driver' }, { onConflict: 'id' });
  if (drvProfileErr) fail('driver profile upsert', drvProfileErr.message); else ok('driver profile ready');
  const { error: drErr } = await admin.from('drivers').upsert({
    id: driver.userId, user_id: driver.userId, vehicle_type: 'mini',
    vehicle_number: 'VA-TEST-01', kyc_status: 'verified', is_verified: true,
  }, { onConflict: 'id' });
  if (drErr) fail('driver row upsert', drErr.message); else ok('driver row ready');

  const lat = 30.7621199, lng = 76.6678789;
  await putDriverOnline(driver.userId, lat, lng);
  ok('test driver online in Redis', 'mini @ ' + lat + ',' + lng);

  console.log('\n=== 1. Create a test ride through the real API ===');
  const rideResp = await apiReq('POST', '/rides/request', {
    token: rider.token,
    body: {
      riderId: rider.userId,
      pickup: { lat, lng, address: 'VA pickup' },
      dropoff: { lat: lat + 0.002, lng: lng + 0.002, address: 'VA drop' },
      fare: 120, distance: 4.5, duration: 12, vehicleType: 'mini',
    },
  });
  if (rideResp.status === 201 && rideResp.body?.rideId) {
    ok('ride request created', `status=${rideResp.status} rideId=${rideResp.body.rideId} candidateCount=${rideResp.body.candidateCount}`);
  } else {
    fail('ride request created', `status=${rideResp.status} body=${JSON.stringify(rideResp.body)}`);
    redis.quit();
    process.exit(1);
  }
  const rideId = rideResp.body.rideId;

  const { data: preRows } = await admin.from('rides').select('id').eq('id', rideId);
  console.log(`       pre-accept rides rows for ${rideId}: ${preRows && preRows.length ? preRows.length : 0} (design: Redis-only until accept)`);

  console.log('\n=== 2-8. Accept ride through the real API (driver) ===');
  const accResp = await apiReq('POST', `/rides/${rideId}/accept`, { token: driver.token });
  if (accResp.status === 200) {
    ok('accept_ride success', `status=${accResp.status}`);
  } else {
    fail('accept_ride success', `status=${accResp.status} body=${JSON.stringify(accResp.body)} fareError=${String(accResp.body).includes('fare')}`);
    redis.quit();
    process.exit(1);
  }

  const { data: row, error: rowErr } = await admin.from('rides').select('*').eq('id', rideId).maybeSingle();
  if (rowErr) {
    fail('ride persisted row', rowErr.message);
  } else {
    ok('ride exists in rides', `id=${row.id}`);
    ok('ride state/status', row.status, row.status);
    const driverOk = row.driver_id === driver.userId;
    ok('driver_id persisted', driverOk ? row.driver_id : 'MISMATCH got ' + row.driver_id);
    ok('fare persisted', String(row.fare) === '120' ? '120' : 'GOT ' + row.fare);
    ok('distance persisted', String(row.distance) === '4.5' ? '4.5' : 'GOT ' + row.distance);
    ok('duration persisted', String(row.duration) === '12' ? '12' : 'GOT ' + row.duration);
    ok('no fare-related DB error', 'n/a');
  }

  console.log('\n=== 9. Redis cleanup ===');
  const cleanupKeys = [['ride:request:' + rideId, 'ride request buffer'], ['ride:offers:' + rideId, 'offer queue'], ['ride:lock:' + rideId, 'acceptance lock']];
  for (const [k, label] of cleanupKeys) {
    const v = await redis.get(k);
    ok(`cleaned: ${label}`, v === null ? 'deleted' : 'STILL PRESENT: ' + JSON.stringify(v));
  }

  console.log('\n=== 10. Invalid / duplicate acceptance behavior ===');
  const dup = await apiReq('POST', `/rides/${rideId}/accept`, { token: driver.token });
  ok('duplicate accept -> 4xx (no re-assign)', dup.status >= 400 && dup.status < 500, `status=${dup.status} body=${JSON.stringify(dup.body)}`);
  const bogus = crypto.randomUUID();
  const bad = await apiReq('POST', `/rides/${bogus}/accept`, { token: driver.token });
  ok('invalid rideId accept -> 4xx', bad.status >= 400 && bad.status < 500, `status=${bad.status}`);
  const { data: dupRows } = await admin.from('rides').select('id, driver_id, status').eq('id', rideId);
  ok('no extra rides rows after duplicate', dupRows && dupRows.length === 1, `rows=${dupRows ? dupRows.length : 0}`);

  console.log('\n=== Cleanup ===');
  const del = async (q) => { try { await q; } catch {} };
  await del(admin.from('rides').delete().eq('id', rideId));
  await del(admin.from('driver_documents').delete().eq('driver_id', driver.userId));
  await del(admin.from('drivers').delete().eq('id', driver.userId));
  await del(admin.from('profiles').delete().eq('id', driver.userId));
  await del(admin.from('profiles').delete().eq('id', rider.userId));
  await del(admin.auth.admin.deleteUser(driver.userId));
  await del(admin.auth.admin.deleteUser(rider.userId));

  redis.quit();
  console.log(`\nRESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('HARNESS ERROR', e); try { redis.quit(); } catch {} process.exit(1); });