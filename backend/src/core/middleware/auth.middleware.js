const { supabaseAdmin } = require('../database/supabase');
const { logger } = require('../logger/logger');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  // --- temporary diagnostic instrumentation (no secrets/PII) ---
  const correlationId = req.correlationId || 'no-correlation';
  const hasToken = !!token;
  const tokenLength = token ? token.length : 0;
  const dotCount = token ? (token.match(/\./g) || []).length : 0;
  const ts = new Date().toISOString();
  logger.info({
    type: 'auth_diag',
    event: 'AUTH_DIAG_TOKEN_META',
    correlationId,
    hasToken,
    tokenLength,
    dotCount,
    timestamp: ts,
  });
  logger.info({
    type: 'auth_diag',
    event: 'AUTH_GETUSER_START',
    correlationId,
    timestamp: new Date().toISOString(),
  });
  // --- end diag meta ---

  const startMs = Date.now();
  const AUTH_TIMEOUT_MS = 7000;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error('auth getUser timeout');
      err.code = 'AUTH_TIMEOUT';
      err.status = 504;
      reject(err);
    }, AUTH_TIMEOUT_MS);
  });

  let data;
  let error;
  try {
    const result = await Promise.race([supabaseAdmin.auth.getUser(token), timeoutPromise]);
    clearTimeout(timeoutId);
    data = result.data;
    error = result.error;
    const elapsedMs = Date.now() - startMs;
    if (error || !data?.user) {
      logger.info({
        type: 'auth_diag',
        event: 'AUTH_GETUSER_ERROR',
        correlationId,
        elapsedMs,
        status: error?.status || null,
        code: error?.code || null,
        message: error?.message || 'no user',
      });
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    logger.info({
      type: 'auth_diag',
      event: 'AUTH_GETUSER_SUCCESS',
      correlationId,
      elapsedMs,
      hasUser: !!data?.user,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startMs;
    if (err && err.code === 'AUTH_TIMEOUT') {
      logger.info({
        type: 'auth_diag',
        event: 'AUTH_GETUSER_TIMEOUT',
        correlationId,
        elapsedMs,
      });
      return res.status(504).json({ error: 'Authentication timeout' });
    }
    logger.info({
      type: 'auth_diag',
      event: 'AUTH_GETUSER_ERROR',
      correlationId,
      elapsedMs,
      status: err?.status || null,
      code: err?.code || null,
      message: err?.message || String(err),
    });
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  req.user = data.user;
  next();
};

module.exports = { protect };