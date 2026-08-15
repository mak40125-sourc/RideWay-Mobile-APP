const crypto = require('crypto');
const { withCorrelation, track } = require('../logger/logger');

// Generates/propagates a correlation (trace) id per HTTP request and stores it
// in AsyncLocalStorage so every downstream log in the request chain carries it.
const correlationMiddleware = (req, res, next) => {
  const incoming = req.headers['x-correlation-id'];
  const correlationId =
    incoming && typeof incoming === 'string' && incoming.length > 0
      ? incoming
      : `rid_${crypto.randomUUID()}`;

  track(correlationId, { requestStart: Date.now() });
  res.setHeader('x-correlation-id', correlationId);
  req.correlationId = correlationId;

  withCorrelation(correlationId, next);
};

module.exports = { correlationMiddleware };