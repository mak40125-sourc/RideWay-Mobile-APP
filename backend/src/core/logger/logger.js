const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');

// Distributed tracing context. A correlation ID set here flows through the whole
// request → service → repository async chain without altering any signatures.
const als = new AsyncLocalStorage();

// In-memory ride trace cache: correlationId -> { requestStart, rideId }
const traceStore = new Map();

const LOG_DIR = path.resolve(__dirname, '..', '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json({ space: 0 })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ level, message }) => {
    const body = typeof message === 'object' && message !== null
      ? JSON.stringify(message)
      : String(message);
    return `${level}: ${body}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'rideway.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

function getStore() {
  return als.getStore() || {};
}

function currentCorrelationId() {
  return getStore().correlationId || 'no-correlation';
}

function withCorrelation(correlationId, fn) {
  return als.run({ correlationId }, fn);
}

function resolveCorrelationId(correlationId) {
  return correlationId || currentCorrelationId();
}

function track(correlationId, fields = {}) {
  if (!correlationId) return;
  const existing = traceStore.get(correlationId) || {};
  traceStore.set(correlationId, { ...existing, ...fields });
}

function traceFor(correlationId) {
  return traceStore.get(resolveCorrelationId(correlationId)) || {};
}

// Emit a lifecycle-stage trace line for a ride. Every ride log carries the
// correlation id, ride id, and (when present) driver id.
function stage(correlationId, stageId, stageName, fields = {}) {
  const cid = resolveCorrelationId(correlationId);
  const cached = traceFor(cid);
  logger.info({
    type: 'stage',
    correlationId: cid,
    rideId: fields.rideId || cached.rideId,
    driverId: fields.driverId || cached.driverId,
    stage: stageId,
    stageName,
    elapsedMs: fields.elapsedMs ?? (cached.requestStart ? Date.now() - cached.requestStart : undefined),
    ...fields,
  });
}

module.exports = {
  logger,
  als,
  withCorrelation,
  currentCorrelationId,
  resolveCorrelationId,
  stage,
  track,
  traceFor,
};