const matchingRepository = require('./matching.repository');
const { RIDE_LOCK_TTL_SECONDS } = require('./matching.constants');
const { cancelWaveOffers, advanceWaveIfNeeded } = require('./wave-dispatcher');
const { logger, stage, currentCorrelationId } = require('../../core/logger/logger');

// Server-authoritative per-driver offer check. The client countdown is
// display-only: an accept past the individual 10s expiry (or for a wave the
// driver was never part of) is rejected here even if the UI still shows it.
// The Redis lock + Postgres transition below stay the final authority.
const assertActiveOffer = async (rideId, driverId, correlationId) => {
  const offer = await matchingRepository.getDriverOffer(rideId, driverId);
  if (!offer) {
    const err = new Error('No active offer for this driver.');
    err.status = 404;
    throw err;
  }
  if (offer.status === 'cancelled') {
    const err = new Error('Offer was cancelled. Another driver was assigned.');
    err.status = 409;
    throw err;
  }
  if (offer.status === 'rejected') {
    const err = new Error('Offer was already declined.');
    err.status = 409;
    throw err;
  }
  if (offer.status === 'expired' || (offer.status === 'active' && offer.expiresAt <= Date.now())) {
    if (offer.status === 'active') {
      await matchingRepository.updateOfferStatus(rideId, driverId, 'expired').catch(() => {});
      logger.info({
        type: 'matching',
        event: 'driver_offer_expired',
        correlationId,
        rideId,
        waveNumber: offer.waveNumber,
        driverId,
        offerExpiresAt: offer.expiresAt,
      });
    }
    const err = new Error('Offer expired. The ride was offered to the next drivers.');
    err.status = 410;
    throw err;
  }
  return offer;
};

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

    // Wave offer must be active for THIS driver and within its 10s window.
    // (Idempotent owner + buffer checks above run first, so duplicate accepts
    // by the winner still succeed while losers fail here or at the RPC.)
    const offer = await assertActiveOffer(rideId, driverId, correlationId).catch(async (e) => {
      await matchingRepository.releaseRideLock(rideId);
      throw e;
    });
    logger.info({
      type: 'stage',
      correlationId,
      rideId,
      driverId,
      stage: '11',
      stageName: 'offer_validated',
      waveNumber: offer.waveNumber,
    });

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

    // Winner path: cancel every other active wave offer immediately and stop
    // all future waves BEFORE clearing scratch state (cancellation publish
    // reads the offer hash). Late accepts stay rejected by lock + RPC.
    await cancelWaveOffers(rideId, driverId).catch((e) => {
      logger.warn({ type: 'matching', event: 'wave_cancel_failed', correlationId, rideId, driverId, error: e.message });
    });
    logger.info({
      type: 'matching',
      event: 'driver_offer_accepted',
      correlationId,
      rideId,
      waveNumber: offer.waveNumber,
      driverId,
    });

    await matchingRepository.deleteRideRequest(rideId);
    await matchingRepository.deleteQueue(rideId);
    await matchingRepository.deleteWaveState(rideId).catch(() => {});
    await matchingRepository.deleteOfferState(rideId).catch(() => {});
    await matchingRepository.releaseRideLock(rideId);
    logger.info({ type: 'stage', correlationId, rideId, driverId, stage: '12', stageName: 'cleanup_completed' });

    return Array.isArray(ride) ? ride[0] : ride;
  } catch (err) {
    await matchingRepository.releaseRideLock(rideId);
    throw err;
  }
};

// Explicit decline: "this driver does not want this offer" — never cancels
// the ride itself. If the wave still has an active peer, advancement waits
// for them; otherwise the next wave dispatches immediately.
const rejectRide = async (rideId, driverId) => {
  const correlationId = currentCorrelationId();

  const offer = await matchingRepository.getDriverOffer(rideId, driverId);
  if (!offer) {
    const err = new Error('No active offer for this driver.');
    err.status = 404;
    throw err;
  }
  if (offer.status !== 'active') {
    logger.info({
      type: 'matching',
      event: 'driver_offer_rejected',
      correlationId,
      rideId,
      waveNumber: offer.waveNumber,
      driverId,
      duplicate: true,
      status: offer.status,
    });
    return { rideId, driverId, status: offer.status, alreadyInactive: true };
  }
  if (offer.expiresAt <= Date.now()) {
    await matchingRepository.updateOfferStatus(rideId, driverId, 'expired').catch(() => {});
    const err = new Error('Offer already expired.');
    err.status = 410;
    throw err;
  }
  const rideData = await matchingRepository.getRideRequest(rideId);
  if (!rideData) {
    await matchingRepository.updateOfferStatus(rideId, driverId, 'expired').catch(() => {});
    const err = new Error('Ride request expired or no longer available.');
    err.status = 410;
    throw err;
  }

  await matchingRepository.updateOfferStatus(rideId, driverId, 'rejected');
  logger.info({
    type: 'matching',
    event: 'driver_offer_rejected',
    correlationId,
    rideId,
    waveNumber: offer.waveNumber,
    driverId,
    candidatePosition: offer.candidatePosition ?? null,
  });

  // Prompt wave check: advances immediately when this was the last active
  // offer, otherwise waits for the remaining peer's 10s window.
  await advanceWaveIfNeeded(rideId).catch((e) => {
    logger.warn({ type: 'matching', event: 'wave_advance_failed', correlationId, rideId, error: e.message });
  });
  return { rideId, driverId, status: 'rejected', waveNumber: offer.waveNumber };
};

module.exports = { acceptRide, rejectRide };