const matchingRepository = require('./matching.repository');
const { RIDE_LOCK_TTL_SECONDS } = require('./matching.constants');
const { logger, stage, currentCorrelationId } = require('../../core/logger/logger');

// Coordinates a driver accepting a pending ride request under a distributed
// lock, persisting acceptance and clearing the match scratch state.
const acceptRide = async (rideId, driverId) => {
  const correlationId = currentCorrelationId();
  const requestStart = Date.now();

  stage(correlationId, '11', 'driver_accepted', { rideId, driverId });

  const acquired = await matchingRepository.acquireRideLock(rideId, driverId, RIDE_LOCK_TTL_SECONDS);
  if (!acquired) {
    logger.warn({
      type: 'failure',
      correlationId,
      rideId,
      driverId,
      stage: '11',
      stageName: 'lock_acquire',
      rideState: 'UNKNOWN',
      driverState: 'UNKNOWN',
      error: 'Ride already accepted by another driver.',
      elapsedMs: Date.now() - requestStart,
    });
    throw new Error('Ride already accepted by another driver.');
  }
  logger.info({ type: 'stage', correlationId, rideId, driverId, stage: '11', stageName: 'lock_acquired' });

  try {
    // Idempotent fast-path: if DB already shows this driver owns the ride, return it without needing Redis buffer
    try {
      const { supabaseAdmin } = require('../../core/database/supabase');
      const { data: existingRide } = await supabaseAdmin.from('rides').select('*').eq('id', rideId).maybeSingle();
      if (existingRide) {
        if (existingRide.driver_id === driverId && existingRide.status === 'DRIVER_ASSIGNED') {
          logger.info({ type: 'stage', correlationId, rideId, driverId, stage: '11', stageName: 'accept_idempotent_hit', rideState: existingRide.status });
          await matchingRepository.releaseRideLock(rideId);
          return existingRide;
        }
        if (existingRide.driver_id && existingRide.driver_id !== driverId) {
          await matchingRepository.releaseRideLock(rideId);
          const err = new Error('Ride already assigned to another driver.');
          err.status = 409;
          throw err;
        }
        // If ride exists but not in DRIVER_ASSIGNED, fall through to normal validation (will be rejected by DB RPC)
      }
    } catch (e) {
      if (e.status === 409) throw e;
      // ignore lookup errors, proceed with normal flow
    }

    const rideData = await matchingRepository.getRideRequest(rideId);
    if (!rideData) {
      // No Redis buffer — check DB for idempotent hit or terminal state
      try {
        const { supabaseAdmin } = require('../../core/database/supabase');
        const { data: dbRide } = await supabaseAdmin.from('rides').select('*').eq('id', rideId).maybeSingle();
        if (dbRide) {
          if (dbRide.driver_id === driverId) {
            logger.info({ type: 'stage', correlationId, rideId, driverId, stage: '11', stageName: 'accept_idempotent_no_buffer', rideState: dbRide.status });
            await matchingRepository.releaseRideLock(rideId);
            return dbRide;
          }
          const err = new Error('Ride already assigned to another driver.');
          err.status = 409;
          throw err;
        }
      } catch (e) {
        if (e.status === 409) throw e;
      }
      await matchingRepository.releaseRideLock(rideId);
      logger.error({
        type: 'failure',
        correlationId,
        rideId,
        driverId,
        stage: '11',
        stageName: 'ride_buffer_read',
        rideState: 'EXPIRED_OR_MISSING',
        driverState: 'ONLINE',
        error: 'Ride request expired or no longer available.',
        elapsedMs: Date.now() - requestStart,
      });
      throw new Error('Ride request expired or no longer available.');
    }

    if (rideData.riderId === driverId) {
      await matchingRepository.releaseRideLock(rideId);
      logger.warn({
        type: 'failure',
        correlationId,
        rideId,
        driverId,
        stage: '11',
        stageName: 'self_accept_rejected',
        rideState: 'REQUESTED',
        driverState: 'ONLINE',
        error: 'Rider cannot accept their own ride.',
        elapsedMs: Date.now() - requestStart,
      });
      throw new Error('Rider cannot accept their own ride.');
    }

    let ride;
    try {
      ride = await matchingRepository.acceptRide(rideId, rideData, driverId);
    } catch (rpcErr) {
      const msg = rpcErr.message || '';
      if (msg.includes('already assigned') || msg.includes('Invalid transition') || msg.includes('not in accept-able')) {
        const err = new Error(msg);
        err.status = 409;
        throw err;
      }
      throw rpcErr;
    }

    if (!ride) {
      await matchingRepository.releaseRideLock(rideId);
      logger.error({
        type: 'failure',
        correlationId,
        rideId,
        driverId,
        stage: '12',
        stageName: 'assignment_persist',
        rideState: 'REQUESTED',
        driverState: 'ONLINE',
        error: 'Failed to persist ride acceptance.',
        elapsedMs: Date.now() - requestStart,
      });
      throw new Error('Failed to persist ride acceptance.');
    }

    stage(correlationId, '12', 'assignment_completed', { rideId, driverId });

    await matchingRepository.deleteRideRequest(rideId);
    await matchingRepository.deleteQueue(rideId);
    await matchingRepository.releaseRideLock(rideId);
    logger.info({ type: 'stage', correlationId, rideId, driverId, stage: '12', stageName: 'cleanup_completed' });

    return Array.isArray(ride) ? ride[0] : ride;
  } catch (err) {
    await matchingRepository.releaseRideLock(rideId);
    throw err;
  }
};

module.exports = { acceptRide };