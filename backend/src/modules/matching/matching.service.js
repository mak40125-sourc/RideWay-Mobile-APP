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

const createRideRequest = async (riderId, pickup, dropoff, fare, distance, duration, vehicleType, passenger, options = {}) => {
  const correlationId = currentCorrelationId();
  const idempotencyKey = options.idempotencyKey || passenger?.idempotencyKey || null;

  // DB-enforced idempotency: if same rider+key seen before, return existing ride without side effects.
  if (idempotencyKey) {
    try {
      const { supabaseAdmin } = require('../../core/database/supabase');
      const { data: existingByKey } = await supabaseAdmin
        .from('rides')
        .select('id')
        .eq('rider_id', riderId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existingByKey?.id) {
        logger.info({ type: 'stage', correlationId, stage: '2', stageName: 'ride_idempotency_hit', riderId, existingRideId: existingByKey.id, idempotencyKey });
        return { rideId: existingByKey.id, candidateCount: 0, passengerName: passenger?.passengerName || null, passengerPhone: passenger?.passengerPhone || null, recovered: true, idempotencyHit: true };
      }
    } catch {}
  }

  // Fallback guard: prevent two active rides without explicit key (double-tap)
  if (!idempotencyKey) {
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
    } catch {}
  }

  const rideId = crypto.randomUUID();
  track(correlationId, { rideId });

  // Normalize coordinates at the API boundary: accept either
  // `{ lat, lng }` or `{ latitude, longitude }` from any client.
  const pickupCoords = normalizeCoords(pickup);
  const dropoffCoords = normalizeCoords(dropoff);

  // Backend-authoritative pricing: client fare/distance/duration are untrusted
  // display hints and are never persisted. The pricing engine derives the
  // authoritative values from coordinates + vehicle type.
  const { pricingService } = require('../pricing');
  const quote = await pricingService.quoteFare(pickupCoords, dropoffCoords, vehicleType);
  const authFare = quote.totalFare;
  const authDistance = quote.distanceKm;
  const authDuration = quote.durationMin;
  if (Number(fare) !== authFare || Number(distance) !== authDistance || Number(duration) !== authDuration) {
    logger.warn({
      type: 'pricing',
      event: 'client_values_untrusted',
      correlationId,
      rideId,
      riderId,
      clientFare: fare,
      clientDistance: distance,
      clientDuration: duration,
      authFare,
      authDistance,
      authDuration,
    });
  }

  const passengerName = passenger?.passengerName || null;
  const passengerPhone = passenger?.passengerPhone || null;

  if (passengerName || passengerPhone) {
    await matchingRepository.setRidePassenger(rideId, passengerName, passengerPhone).catch(() => {});
  }

  stage(correlationId, '2', 'ride_created', { rideId, riderId, pickup: pickupCoords, dropoff: dropoffCoords, vehicleType, idempotencyKey: idempotencyKey || undefined, authFare });

  // Postgres authoritative row first (idempotent) — Redis is ephemeral scratch.
  // Persist authoritative fare snapshot, never client values.
  try {
    const rideRepository = require('../ride/ride.repository');
    const dbRide = await rideRepository.createRideIdempotent({
      rideId,
      riderId,
      pickupLat: pickupCoords.lat,
      pickupLng: pickupCoords.lng,
      dropLat: dropoffCoords.lat,
      dropLng: dropoffCoords.lng,
      pickupAddress: pickupCoords.address,
      dropAddress: dropoffCoords.address,
      fare: authFare,
      distance: authDistance,
      duration: authDuration,
      idempotencyKey,
      fareBreakdown: quote.breakdown,
      pricingVersion: quote.pricingVersion,
    });
    // If DB returned a different id (idempotency hit race), adopt it and skip Redis/ matching side-effects.
    if (dbRide && dbRide.id !== rideId) {
      logger.info({ type: 'stage', correlationId, stage: '2', stageName: 'ride_idempotency_created_race', riderId, requestedRideId: rideId, existingRideId: dbRide.id, idempotencyKey });
      return { rideId: dbRide.id, candidateCount: 0, passengerName: passenger?.passengerName || null, passengerPhone: passenger?.passengerPhone || null, recovered: true, idempotencyHit: true };
    }
    logger.info({ type: 'stage', correlationId, stage: '2', stageName: 'ride_idempotency_created', rideId, riderId, idempotencyKey: idempotencyKey || null });
  } catch (e) {
    // If create fails due to unique violation, treat as hit
    const msg = e.message || '';
    if (msg.includes('duplicate') || msg.includes('unique') || e.code === '23505') {
      try {
        const { supabaseAdmin } = require('../../core/database/supabase');
        const { data: existingByKey } = await supabaseAdmin.from('rides').select('id').eq('rider_id', riderId).eq('idempotency_key', idempotencyKey).maybeSingle();
        if (existingByKey?.id) {
          logger.info({ type: 'stage', correlationId, stage: '2', stageName: 'ride_idempotency_hit_after_error', riderId, existingRideId: existingByKey.id });
          return { rideId: existingByKey.id, candidateCount: 0, passengerName: passenger?.passengerName || null, passengerPhone: passenger?.passengerPhone || null, recovered: true, idempotencyHit: true };
        }
      } catch {}
    }
    throw e;
  }

  await matchingRepository.createRideRequest(rideId, {
    riderId,
    pickupLat: pickupCoords.lat,
    pickupLng: pickupCoords.lng,
    pickupAddress: pickupCoords.address,
    dropLat: dropoffCoords.lat,
    dropLng: dropoffCoords.lng,
    dropAddress: dropoffCoords.address,
    fare: authFare,
    distance: authDistance,
    duration: authDuration,
    vehicleType: quote.vehicleType,
    passengerName,
    passengerPhone,
  });
  stage(correlationId, '3', 'ride_persisted', { rideId, riderId, authFare });

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
      fare: authFare,
      distance: authDistance,
      duration: authDuration,
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

  return { rideId, candidateCount, passengerName, passengerPhone, fare: authFare, distance: authDistance, duration: authDuration, fareBreakdown: quote.breakdown, pricingVersion: quote.pricingVersion, vehicleType: quote.vehicleType };
};

const acceptRide = (rideId, driverId) => persistAcceptance(rideId, driverId);

module.exports = { createRideRequest, acceptRide };