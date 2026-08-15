const matchingRepository = require('./matching.repository');
const { NOTIFICATION_EVENT } = require('./matching.constants');
const { logger, currentCorrelationId } = require('../../core/logger/logger');

// Queues the ranked candidates for a ride and pushes a notification to them.
const dispatchOffers = async (rideId, { candidateIds, riderId, pickup, dropoff, fare, distance, duration }) => {
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
    candidateDriverIds: candidateIds,
  };

  await matchingRepository.publishNotification(NOTIFICATION_EVENT, message);
};

module.exports = { dispatchOffers };