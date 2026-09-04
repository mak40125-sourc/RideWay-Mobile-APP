const test = require('node:test');
const assert = require('node:assert');
const lifecycle = require('../src/modules/ride/ride.lifecycle');

test('valid forward transitions pass', () => {
  assert.doesNotThrow(() => lifecycle.assertValidTransition('REQUESTED', 'SEARCHING_DRIVER'));
  assert.doesNotThrow(() => lifecycle.assertValidTransition('SEARCHING_DRIVER', 'DRIVER_ASSIGNED'));
  assert.doesNotThrow(() => lifecycle.assertValidTransition('DRIVER_ASSIGNED', 'DRIVER_ARRIVING'));
  assert.doesNotThrow(() => lifecycle.assertValidTransition('DRIVER_ARRIVING', 'RIDE_STARTED'));
  assert.doesNotThrow(() => lifecycle.assertValidTransition('RIDE_STARTED', 'RIDE_COMPLETED'));
  assert.doesNotThrow(() => lifecycle.assertValidTransition('DRIVER_ASSIGNED', 'CANCELLED'));
  assert.doesNotThrow(() => lifecycle.assertValidTransition('RIDE_STARTED', 'RIDE_STARTED')); // idempotent
});

test('invalid backward transitions rejected with 409', () => {
  assert.throws(() => lifecycle.assertValidTransition('RIDE_STARTED', 'DRIVER_ASSIGNED'), (e) => e.status === 409);
  assert.throws(() => lifecycle.assertValidTransition('RIDE_COMPLETED', 'RIDE_STARTED'), (e) => e.status === 409);
  assert.throws(() => lifecycle.assertValidTransition('CANCELLED', 'DRIVER_ASSIGNED'), (e) => e.status === 409);
  assert.throws(() => lifecycle.assertValidTransition('DRIVER_ASSIGNED', 'RIDE_STARTED'), (e) => e.status === 409);
});

test('terminal states are correctly identified', () => {
  assert.ok(lifecycle.isTerminal('RIDE_COMPLETED'));
  assert.ok(lifecycle.isTerminal('CANCELLED'));
  assert.ok(!lifecycle.isTerminal('DRIVER_ASSIGNED'));
});

test('stale transition RIDE_STARTED -> DRIVER_ARRIVING is invalid', () => {
  assert.throws(() => lifecycle.assertValidTransition('RIDE_STARTED', 'DRIVER_ARRIVING'), (e) => e.code === 'INVALID_TRANSITION');
});

test('complete is idempotent via validator', () => {
  assert.doesNotThrow(() => lifecycle.assertValidTransition('RIDE_COMPLETED', 'RIDE_COMPLETED'));
  assert.throws(() => lifecycle.assertValidTransition('RIDE_COMPLETED', 'RIDE_STARTED'), (e) => e.status === 409);
});
