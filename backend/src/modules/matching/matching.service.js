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

const createRideRequest = async (riderId, pickup, dropoff, fare, distance, duration, vehicleType, passenger) => {
  const correlationId = currentCorrelationId();

  // Idempotency: if rider already has an active ride, return it instead of creating a duplicate.
  // Protects against: request sent → backend persisted → response lost → app retries/crashes → new request.
  try {
    const { supabaseAdmin } = require('../../core/database/supabase');
    const ACTIVE_STATUSES = ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'RIDE_STARTED'];
    const freshnessThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from('rides')
      .select('id')
      .eq('rider_id', riderId)
      .in('status', ACTIVE_STATUSES)
      .gte('updated_at', freshnessThreshold)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      logger.info({ type: 'stage', correlationId, stage: '2', stageName: 'ride_create_duplicate_prevented', riderId, existingRideId: existing.id });
      return { rideId: existing.id, candidateCount: 0, passengerName: passenger?.passengerName || null, passengerPhone: passenger?.passengerPhone || null, recovered: true };
    }
  } catch {
    // best-effort idempotency check; fall through to create new ride on error
  }

  const rideId = crypto.randomUUID();
  track(correlationId, { rideId });

  // Normalize coordinates at the API boundary: accept either
  // `{ lat, lng }` or `{ latitude, longitude }` from any client.
  const pickupCoords = normalizeCoords(pickup);
  const dropoffCoords = normalizeCoords(dropoff);

  const passengerName = passenger?.passengerName || null;
  const passengerPhone = passenger?.passengerPhone || null;

  if (passengerName || passengerPhone) {
    await matchingRepository.setRidePassenger(rideId, passengerName, passengerPhone).catch(() => {});
  }

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
    passengerName,
    passengerPhone,
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
      passengerName,
      passengerPhone,
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

  return { rideId, candidateCount, passengerName, passengerPhone };
};

const acceptRide = (rideId, driverId) => persistAcceptance(rideId, driverId);

module.exports = { createRideRequest, acceptRide };