const matchingRepository = require('./matching.repository');
const { dispatchOffers, dispatchOfferCancelled } = require('./offer-dispatcher');
const {
  WAVE_SIZE,
  OFFER_DURATION_SECONDS,
  RIDE_REQUEST_TTL_SECONDS,
} = require('./matching.constants');
const { logger } = require('../../core/logger/logger');

// Wave orchestrator for 2-driver waves with individual 10s offer timers.
// Discovery, ordering, and acceptance authority are unchanged — this module
// only decides WHO is offered WHEN. Server-authoritative state lives in Redis
// (`ride:wave:<id>` + `ride:offer:<id>`); in-process timers only trigger the
// advancement check, never decide validity. Validity is always re-read from
// Redis (+ the global ride:request buffer) at decision time.

// In-memory wave timers + dispatch contexts (single process). Redis holds the
// authoritative state, so a restart simply stops future waves: offers expire
// via their timestamps/TTL and no new wave is dispatched without context.
const waveTimers = new Map();
const waveContexts = new Map();

// Pure chunking: nearest-first order preserved, max WAVE_SIZE per wave.
const createWaves = (candidateIds, size = WAVE_SIZE) => {
  const waves = [];
  for (let i = 0; i < candidateIds.length; i += size) {
    waves.push(candidateIds.slice(i, i + size));
  }
  return waves;
};

const clearWaveTimer = (rideId) => {
  const timer = waveTimers.get(rideId);
  if (timer) {
    clearTimeout(timer);
    waveTimers.delete(rideId);
  }
};

const scheduleWaveCheck = (rideId, delayMs) => {
  clearWaveTimer(rideId);
  const delay = Math.max(0, delayMs);
  const timer = setTimeout(() => {
    waveTimers.delete(rideId);
    advanceWaveIfNeeded(rideId).catch((err) => {
      logger.error({ type: 'matching', event: 'wave_advance_failed', rideId, error: err.message });
    });
  }, delay);
  // Wave checks are background work and must never hold the process open
  // (e.g. during tests or shutdown).
  if (typeof timer.unref === 'function') timer.unref();
  waveTimers.set(rideId, timer);
};

// Entry point from matching.service: wave 1 dispatches immediately, later
// waves follow only after every offer in the current wave is inactive.
const startWaves = async (rideId, candidateIds, context) => {
  const correlationId = context.correlationId;
  const waves = createWaves(candidateIds);
  logger.info({
    type: 'matching',
    event: 'wave_created',
    correlationId,
    rideId,
    waveCount: waves.length,
    waveSize: WAVE_SIZE,
    candidateCount: candidateIds.length,
  });
  waveContexts.set(rideId, context);
  await dispatchWave(rideId, 1, waves[0], candidateIds, context);
  return { waves, waveCount: waves.length };
};

const dispatchWave = async (rideId, waveNumber, waveDriverIds, candidateIds, context, options = {}) => {
  const correlationId = context.correlationId;
  // Global TTL is authoritative: never dispatch when the request is gone.
  const rideData = await matchingRepository.getRideRequest(rideId);
  if (!rideData) {
    logger.warn({
      type: 'matching',
      event: 'wave_stopped',
      correlationId,
      rideId,
      waveNumber,
      reason: 'global_request_expired',
    });
    waveContexts.delete(rideId);
    return { dispatched: false, reason: 'global_request_expired' };
  }

  // Post-win defense: re-read the authoritative wave state immediately before
  // mutating anything. A concurrent accept marks the wave completed/cancelled
  // (or deletes it during cleanup) between the caller's earlier read and this
  // dispatch — never send offers into a completed/stopped/exhausted/stale wave.
  // Wave 1 (no expected prior wave) skips this; it has no predecessor to stale on.
  if (options.expectedPriorWaveNumber != null) {
    const current = await matchingRepository.getWaveState(rideId);
    if (!current || current.status !== 'active' || current.waveNumber !== options.expectedPriorWaveNumber) {
      logger.warn({
        type: 'matching',
        event: 'wave_dispatch_refused',
        correlationId,
        rideId,
        waveNumber,
        reason: 'stale_or_completed_wave',
        currentWaveNumber: current?.waveNumber ?? null,
        currentStatus: current?.status ?? null,
      });
      return { dispatched: false, reason: 'stale_or_completed_wave' };
    }
  }

  const now = Date.now();
  const offerExpiresAt = now + OFFER_DURATION_SECONDS * 1000;
  const candidateIndex = candidateIds.indexOf(waveDriverIds[0]);
  const startIndex = candidateIndex >= 0 ? candidateIndex : (waveNumber - 1) * WAVE_SIZE;

  await matchingRepository.setWaveState(rideId, {
    waveNumber,
    status: 'active',
    waveDriverIds,
    candidateIds,
    candidateIndex: startIndex + waveDriverIds.length,
  });
  await matchingRepository.setDriverOffers(
    rideId,
    waveDriverIds.map((driverId) => ({
      driverId,
      waveNumber,
      status: 'active',
      createdAt: now,
      expiresAt: offerExpiresAt,
      candidatePosition: candidateIds.indexOf(driverId),
    }))
  );

  logger.info({
    type: 'matching',
    event: 'wave_dispatched',
    correlationId,
    rideId,
    waveNumber,
    driverIds: waveDriverIds,
    offerExpiresAt,
  });
  for (const driverId of waveDriverIds) {
    logger.info({
      type: 'matching',
      event: 'driver_offer_sent',
      correlationId,
      rideId,
      waveNumber,
      driverId,
      candidatePosition: candidateIds.indexOf(driverId),
      offerCreatedAt: now,
      offerExpiresAt,
    });
  }

  await dispatchOffers(rideId, { ...context, candidateIds: waveDriverIds, waveNumber, offerExpiresAt });

  // Re-check shortly after the individual offers lapse. The check re-reads
  // Redis, so a winner in the meantime simply stops advancement.
  scheduleWaveCheck(rideId, OFFER_DURATION_SECONDS * 1000 + 500);
  return { dispatched: true, waveNumber, driverIds: waveDriverIds, offerExpiresAt };
};

// Advances only when EVERY offer in the current wave is inactive. Never
// dispatches the next wave while one driver is still within their 10s window,
// after a winner exists, or after the global 120s request expired.
const advanceWaveIfNeeded = async (rideId) => {
  const waveState = await matchingRepository.getWaveState(rideId);
  if (!waveState || waveState.status !== 'active') return { advanced: false, reason: 'no_active_wave' };

  const correlationId = waveContexts.get(rideId)?.correlationId;
  const now = Date.now();
  const offers = await matchingRepository.getDriverOffers(rideId);

  // Server-authoritative expiry sweep for this wave only.
  for (const driverId of waveState.waveDriverIds) {
    const offer = offers[driverId];
    if (offer && offer.status === 'active' && offer.expiresAt <= now) {
      await matchingRepository.updateOfferStatus(rideId, driverId, 'expired');
      offers[driverId] = { ...offer, status: 'expired' };
      logger.info({
        type: 'matching',
        event: 'driver_offer_expired',
        correlationId,
        rideId,
        waveNumber: waveState.waveNumber,
        driverId,
        offerExpiresAt: offer.expiresAt,
      });
    }
  }

  const stillActive = waveState.waveDriverIds.filter((driverId) => {
    const offer = offers[driverId];
    return offer && offer.status === 'active' && offer.expiresAt > now;
  });
  if (stillActive.length > 0) {
    // One driver (e.g. after a peer rejection) is still within their window:
    // wait for them instead of advancing early.
    const earliestExpiry = Math.min(...stillActive.map((driverId) => offers[driverId].expiresAt));
    scheduleWaveCheck(rideId, earliestExpiry - now + 500);
    return { advanced: false, reason: 'wave_still_active', activeDriverIds: stillActive };
  }

  logger.info({
    type: 'matching',
    event: 'wave_completed',
    correlationId,
    rideId,
    waveNumber: waveState.waveNumber,
  });

  // Stop conditions before any next wave.
  const rideData = await matchingRepository.getRideRequest(rideId);
  if (!rideData) {
    await matchingRepository.setWaveState(rideId, { ...waveState, status: 'stopped' });
    waveContexts.delete(rideId);
    logger.warn({ type: 'matching', event: 'wave_stopped', correlationId, rideId, reason: 'global_request_expired' });
    return { advanced: false, reason: 'global_request_expired' };
  }
  try {
    const { supabaseAdmin } = require('../../core/database/supabase');
    const { data: dbRide } = await supabaseAdmin.from('rides').select('id,driver_id').eq('id', rideId).maybeSingle();
    if (dbRide?.driver_id) {
      await matchingRepository.setWaveState(rideId, { ...waveState, status: 'completed' });
      waveContexts.delete(rideId);
      logger.info({ type: 'matching', event: 'wave_cancelled', correlationId, rideId, reason: 'already_assigned' });
      return { advanced: false, reason: 'already_assigned' };
    }
  } catch {
    // DB unreadable — fall through to wave state, acceptance RPC stays authoritative.
  }

  const context = waveContexts.get(rideId);
  const nextDriverIds = waveState.candidateIds.slice(
    waveState.candidateIndex,
    waveState.candidateIndex + WAVE_SIZE
  );
  if (!context || nextDriverIds.length === 0) {
    await matchingRepository.setWaveState(rideId, { ...waveState, status: nextDriverIds.length === 0 ? 'exhausted' : 'stopped' });
    if (!context) waveContexts.delete(rideId);
    else {
      logger.info({ type: 'matching', event: 'wave_completed', correlationId, rideId, reason: 'no_more_candidates' });
      waveContexts.delete(rideId);
    }
    if (!context) {
      logger.warn({ type: 'matching', event: 'wave_stopped', correlationId, rideId, reason: 'no_context' });
    }
    return { advanced: false, reason: nextDriverIds.length === 0 ? 'no_more_candidates' : 'no_context' };
  }

  logger.info({
    type: 'matching',
    event: 'wave_advanced',
    correlationId,
    rideId,
    fromWave: waveState.waveNumber,
    toWave: waveState.waveNumber + 1,
    driverIds: nextDriverIds,
  });
  // Atomic transition claim: only ONE overlapping advancer (two rejects,
  // reject + timer, two processes) may dispatch wave N+1. Losers exit here
  // without publishing anything, so a wave is never dispatched twice and its
  // 10s expiry is never refreshed by a duplicate dispatch. One key per
  // (rideId, N → N+1), so later transitions are never blocked.
  const claimed = await matchingRepository.claimWaveTransition(rideId, waveState.waveNumber, waveState.waveNumber + 1);
  if (!claimed) {
    logger.info({
      type: 'matching',
      event: 'wave_transition_already_claimed',
      correlationId,
      rideId,
      fromWave: waveState.waveNumber,
      toWave: waveState.waveNumber + 1,
    });
    return { advanced: false, reason: 'transition_already_claimed' };
  }
  const dispatchResult = await dispatchWave(rideId, waveState.waveNumber + 1, nextDriverIds, waveState.candidateIds, context, {
    expectedPriorWaveNumber: waveState.waveNumber,
  });
  if (!dispatchResult.dispatched) {
    return { advanced: false, reason: dispatchResult.reason };
  }
  return { advanced: true, waveNumber: waveState.waveNumber + 1, driverIds: nextDriverIds };
};

// Called exactly once per winning acceptance: marks the winner, cancels every
// other active offer for UX sync, and stops all future waves. Late accepts
// remain rejected by the Redis lock + Postgres transition regardless of timing.
const cancelWaveOffers = async (rideId, winnerDriverId, reason = 'driver_assigned') => {
  const correlationId = waveContexts.get(rideId)?.correlationId;
  clearWaveTimer(rideId);
  const offers = await matchingRepository.getDriverOffers(rideId);
  const cancelledDriverIds = [];
  for (const [driverId, offer] of Object.entries(offers)) {
    if (driverId === winnerDriverId) {
      if (offer.status === 'active') await matchingRepository.updateOfferStatus(rideId, driverId, 'accepted');
      continue;
    }
    if (offer.status === 'active') {
      await matchingRepository.updateOfferStatus(rideId, driverId, 'cancelled');
      cancelledDriverIds.push(driverId);
    }
  }
  const waveState = await matchingRepository.getWaveState(rideId);
  if (waveState) {
    await matchingRepository.setWaveState(rideId, { ...waveState, status: 'completed' });
  }
  waveContexts.delete(rideId);

  if (cancelledDriverIds.length > 0) {
    await dispatchOfferCancelled(rideId, { cancelledDriverIds, reason, winnerDriverId, correlationId });
    for (const driverId of cancelledDriverIds) {
      logger.info({
        type: 'matching',
        event: 'ride_offer_cancelled',
        correlationId,
        rideId,
        driverId,
        reason,
      });
    }
  }
  logger.info({
    type: 'matching',
    event: 'ride_assignment_won',
    correlationId,
    rideId,
    winnerDriverId,
    cancelledCount: cancelledDriverIds.length,
  });
  return { cancelledDriverIds };
};

const stopWaves = (rideId) => {
  clearWaveTimer(rideId);
  waveContexts.delete(rideId);
};

module.exports = {
  WAVE_SIZE,
  OFFER_DURATION_SECONDS,
  RIDE_REQUEST_TTL_SECONDS,
  createWaves,
  startWaves,
  dispatchWave,
  advanceWaveIfNeeded,
  cancelWaveOffers,
  stopWaves,
  clearWaveTimer,
};
