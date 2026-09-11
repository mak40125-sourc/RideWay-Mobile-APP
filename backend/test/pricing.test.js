const test = require('node:test');
const assert = require('node:assert');

// Hermetic: fail fast on OSRM so route resolution uses instant haversine fallback.
global.fetch = async () => { throw new Error('offline-test'); };
const pricing = require('../src/modules/pricing/pricing.service');
const { RATES, MIN_FARE, PRICING_VERSION } = require('../src/modules/pricing/pricing.config');

test('sedan fare matches formula base+km*perKm+min*perMin', () => {
  const q = pricing.calculateFare('sedan', 10, 20);
  assert.strictEqual(q.totalFare, 64 + 10 * 15 + 20 * 3);
  assert.strictEqual(q.currency, 'INR');
  assert.strictEqual(q.pricingVersion, PRICING_VERSION);
  assert.deepStrictEqual(Object.keys(q.breakdown).sort(), ['baseFare', 'distanceFare', 'timeFare']);
});

test('bike fare matches formula', () => {
  const q = pricing.calculateFare('bike', 5, 10);
  assert.strictEqual(q.totalFare, 26 + 5 * 8 + 10 * 1);
});

test('minimum fare floor enforced', () => {
  const q = pricing.calculateFare('bike', 0, 0);
  assert.ok(q.totalFare >= MIN_FARE);
  assert.strictEqual(q.totalFare, Math.max(MIN_FARE, Math.round(26)));
});

test('rounding is integer', () => {
  const q = pricing.calculateFare('mini', 1.234, 3);
  assert.strictEqual(Number.isInteger(q.totalFare), true);
});

test('invalid vehicleType rejected with 422', () => {
  assert.throws(() => pricing.normalizeVehicleType('spaceship'), (e) => e.status === 422);
});

test('invalid coordinates rejected with 422', async () => {
  await assert.rejects(
    pricing.quoteFare({ lat: NaN, lng: 0 }, { lat: 1, lng: 1 }, 'mini'),
    (e) => e.status === 422
  );
  await assert.rejects(
    pricing.quoteFare({ lat: 200, lng: 0 }, { lat: 1, lng: 1 }, 'mini'),
    (e) => e.status === 422
  );
});

test('quoteFare resolves distance/duration server-side (OSRM or fallback)', async () => {
  const q = await pricing.quoteFare(
    { lat: 12.9716, lng: 77.5946 },
    { lat: 12.9352, lng: 77.6245 },
    'mini'
  );
  assert.ok(q.distanceKm > 0);
  assert.ok(q.durationMin >= 1);
  assert.ok(q.totalFare >= MIN_FARE);
  assert.ok(['osrm', 'haversine-fallback'].includes(q.routeSource));
});

test('fake client fare cannot influence quote (security)', async () => {
  const pickup = { lat: 12.9716, lng: 77.5946 };
  const drop = { lat: 12.9352, lng: 77.6245 };
  const q1 = await pricing.quoteFare(pickup, drop, 'sedan');
  const q2 = await pricing.quoteFare(pickup, drop, 'sedan');
  assert.strictEqual(q1.totalFare, q2.totalFare);
  // A tampered client fare of 1 is never an input to quoteFare; it takes no fare arg.
  assert.notStrictEqual(q1.totalFare, 1);
  assert.ok(!('clientFare' in q1));
});

test('all vehicle types produce fares', async () => {
  for (const v of Object.keys(RATES)) {
    const q = await pricing.quoteFare({ lat: 12.9, lng: 77.6 }, { lat: 13.0, lng: 77.7 }, v);
    assert.ok(q.totalFare >= MIN_FARE, v);
    assert.strictEqual(q.vehicleType, v);
  }
});
