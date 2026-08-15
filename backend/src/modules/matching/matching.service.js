const crypto = require('crypto');
const matchingRepository = require('./matching.repository');
const { findCandidates } = require('./candidate-finder');
const { rankCandidates } = require('./candidate-ranker');
const { dispatchOffers } = require('./offer-dispatcher');
const { acceptRide: persistAcceptance } = require('./acceptance-manager');
const { logger, stage, track, currentCorrelationId } = require('../../core/logger/logger');

// Orchestrates the ride-matching pipeline. Business logic only — all
// persistence flows through matching.repository (Controller → Ride Service →
// Matching Service → Repositories → Redis/Supabase).
const normalizeCoords = (point) => {
  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(point.lng ?? point.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid pickup/dropoff coordinates');
  }

  return { lat, lng, address: point.address || '' };
};

const createRideRequest = async (riderId, pickup, dropoff, fare, distance, duration, vehicleType) => {
  const correlationId = currentCorrelationId();
  const rideId = crypto.randomUUID();
  track(correlationId, { rideId });

  // Normalize coordinates at the API boundary: accept either
  // `{ lat, lng }` or `{ latitude, longitude }` from any client.
  const pickupCoords = normalizeCoords(pickup);
  const dropoffCoords = normalizeCoords(dropoff);

  stage(correlationId, '2', 'ride_created', { rideId, riderId, pickup: pickupCoords, dropoff: dropoffCoords, vehicleType });

  await matchingRepository.createRideRequest(rideId, {
    riderId,
    pickupLat: pickupCoords.lat,
    pickupLng: pickupCoords.lng,
    pickupAddress: pickupCoords.address,
    dropLat: dropoffCoords.lat,
    dropLng: dropoffCoords.lng,
    dropAddress: dropoffCoords.address,
    fare,
    distance,
    duration,
    vehicleType,
  });
  stage(correlationId, '3', 'ride_persisted', { rideId, riderId });

  stage(correlationId, '4', 'matching_started', { rideId });
  stage(correlationId, '5', 'driver_search_started', { rideId, vehicleType });

  const { candidates, candidateCount, candidateIds } = await findCandidates(pickupCoords, vehicleType, rideId);
  stage(correlationId, '6', 'nearby_drivers_found', {
    rideId,
    candidateCount,
    candidateIds,
    vehicleType,
  });

  const rankedCandidates = rankCandidates(candidates);
  stage(correlationId, '7', 'candidate_ranking_completed', {
    rideId,
    candidateCount,
    rankedCount: rankedCandidates.length,
  });

  if (rankedCandidates.length > 0) {
    stage(correlationId, '8', 'offer_generated', { rideId, candidateCount });
    await dispatchOffers(rideId, {
      candidateIds,
      riderId,
      pickup: pickupCoords,
      dropoff: dropoffCoords,
      fare,
      distance,
      duration,
    });
  } else {
    logger.warn({
      type: 'stage',
      correlationId,
      rideId,
      rideState: 'REQUESTED',
      stage: '8',
      stageName: 'offer_generated',
      skipped: true,
      reason: 'no eligible candidates',
      candidateCount: 0,
    });
  }

  return { rideId, candidateCount };
};

const acceptRide = (rideId, driverId) => persistAcceptance(rideId, driverId);

module.exports = { createRideRequest, acceptRide };