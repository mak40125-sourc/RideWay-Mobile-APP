const matchingRepository = require('./matching.repository');
const redisService = require('../../core/redis/redis.service');
const { NOTIFICATION_EVENT } = require('./matching.constants');
const { logger, currentCorrelationId } = require('../../core/logger/logger');

// Queues the drivers for a ride and pushes a notification to them. In wave
// mode the caller passes only the current wave's drivers as candidateIds plus
// their individual offerExpiresAt; without them this falls back to the legacy
// single-broadcast shape (global request TTL, no wave number).
const dispatchOffers = async (rideId, { candidateIds, riderId, pickup, dropoff, fare, distance, duration, passengerName, passengerPhone, offerExpiresAt, waveNumber }) => {
  const correlationId = currentCorrelationId();

  await matchingRepository.addDriversToQueue(rideId, candidateIds);

  let riderName = 'Rider';
  try {
    const name = await matchingRepository.getRiderName(riderId);
    if (name) riderName = name;
  } catch (e) {
    logger.warn({ type: 'stage', correlationId, rideId, stage: '8', stageName: 'rider_name_lookup', error: e.message });
  }

  const message = {
    correlationId,
    rideId,
    pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address || '' },
    dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address || '' },
    fare,
    distance,
    duration,
    riderName,
    // Passenger identity for rides booked on behalf of someone else. Omitted for
    // a normal ride so the driver UI falls back to the booking rider.
    passengerName: passengerName || null,
    passengerPhone: passengerPhone || null,
    // Authoritative per-driver offer deadline (wave mode) so driver clients
    // can run a display-only countdown. Falls back to the global request TTL
    // for legacy callers. The backend always re-validates against Redis.
    expiresAt: offerExpiresAt || Date.now() + redisService.RIDE_REQUEST_TTL * 1000,
    candidateDriverIds: candidateIds,
    ...(waveNumber ? { waveNumber } : {}),
  };

  await matchingRepository.publishNotification(NOTIFICATION_EVENT, message);
};

// Explicit UX-sync cancellation for outstanding wave offers after a winner.
// Late accepts stay rejected by the Redis lock + Postgres transition; this
// event only tells the driver app to close the stale offer immediately.
const dispatchOfferCancelled = async (rideId, { cancelledDriverIds, reason = 'driver_assigned', winnerDriverId, correlationId }) => {
  await matchingRepository.publishNotification(NOTIFICATION_EVENT, {
    type: 'offer_cancelled',
    correlationId: correlationId || currentCorrelationId(),
    rideId,
    reason,
    winnerDriverId: winnerDriverId || null,
    cancelledDriverIds,
  });
};

module.exports = { dispatchOffers, dispatchOfferCancelled };