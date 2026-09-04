const TERMINAL_STATUSES = new Set(['RIDE_COMPLETED', 'CANCELLED']);

const RECOVERABLE_STATUSES = new Set([
  'REQUESTED',
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'RIDE_STARTED',
]);

const TRANSITIONS = {
  REQUESTED: new Set(['SEARCHING_DRIVER', 'CANCELLED']),
  SEARCHING_DRIVER: new Set(['DRIVER_ASSIGNED', 'CANCELLED']),
  DRIVER_ASSIGNED: new Set(['DRIVER_ARRIVING', 'CANCELLED']),
  DRIVER_ARRIVING: new Set(['RIDE_STARTED', 'CANCELLED']),
  RIDE_STARTED: new Set(['RIDE_COMPLETED']),
  RIDE_COMPLETED: new Set([]),
  CANCELLED: new Set([]),
  IDLE: new Set([]),
};

function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

function isRecoverable(status) {
  return RECOVERABLE_STATUSES.has(status);
}

function isValidTransition(from, to) {
  if (from === to) return true;
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
}

function assertValidTransition(currentStatus, requestedStatus) {
  if (currentStatus === requestedStatus) return;
  if (!isValidTransition(currentStatus, requestedStatus)) {
    const err = new Error(`Invalid transition: ${currentStatus} -> ${requestedStatus}`);
    err.code = 'INVALID_TRANSITION';
    err.status = 409;
    err.currentStatus = currentStatus;
    err.requestedStatus = requestedStatus;
    throw err;
  }
}

function actorAllowed(status, action, actor) {
  if (action === 'CANCEL') return true;
  if (['DRIVER_ARRIVING', 'RIDE_STARTED', 'RIDE_COMPLETED'].includes(action)) {
    return actor === 'driver';
  }
  if (action === 'DRIVER_ASSIGNED') return actor === 'driver';
  return true;
}

module.exports = {
  TERMINAL_STATUSES,
  RECOVERABLE_STATUSES,
  TRANSITIONS,
  isTerminal,
  isRecoverable,
  isValidTransition,
  assertValidTransition,
  actorAllowed,
};
