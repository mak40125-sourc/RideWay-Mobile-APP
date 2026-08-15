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
    const rideData = await matchingRepository.getRideRequest(rideId);
    if (!rideData) {
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

    const ride = await matchingRepository.acceptRide(rideId, rideData, driverId);

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