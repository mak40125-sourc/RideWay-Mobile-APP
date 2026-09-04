const matchingRepository = require('./matching.repository');
const { NEARBY_DRIVER_RADIUS_METERS } = require('./matching.constants');
const { logger, currentCorrelationId } = require('../../core/logger/logger');

// Discovers potentially available drivers for a pickup point, restricted to
// drivers whose vehicle_type matches the requested ride vehicle type, then
// maps them to candidate driver ids.
const findCandidates = async (pickup, vehicleType, rideId) => {
  const correlationId = currentCorrelationId();
  const nearbyDrivers = await matchingRepository.getNearbyDrivers(
    pickup.lat,
    pickup.lng,
    NEARBY_DRIVER_RADIUS_METERS
  );

  const hashes = await Promise.all(
    nearbyDrivers.map((d) => matchingRepository.getDriver(d.user_id).catch(() => null))
  );

  // Repair-at-read: a GEO member whose availability metadata is missing or
  // incomplete (no hash / empty rideType → vehicle_type null) gets one bounded
  // restore attempt from the authoritative drivers table BEFORE vehicle_type
  // filtering. Only actual nearby GEO candidates are repaired — never the full
  // driver population. Restoration failure excludes the driver safely instead
  // of crashing discovery, and is logged for diagnosis.
  const enriched = await Promise.all(
    nearbyDrivers.map(async (d, i) => {
      if (d.vehicle_type) {
        return { ...d, hashExists: Boolean(hashes[i]), onlineSince: hashes[i]?.onlineSince || null };
      }
      try {
        const restored = await matchingRepository.repairDriverMetadata(d.user_id);
        if (restored && restored.rideType) {
          logger.info({
            type: 'matching',
            event: 'candidate_metadata_repaired',
            correlationId,
            rideId,
            driverId: d.user_id,
            rideType: restored.rideType,
          });
          return {
            ...d,
            vehicle_type: restored.rideType,
            status: restored.status || null,
            hashExists: true,
            onlineSince: restored.onlineSince || null,
          };
        }
        logger.warn({
          type: 'matching',
          event: 'candidate_metadata_unrepaired',
          correlationId,
          rideId,
          driverId: d.user_id,
        });
      } catch (err) {
        logger.warn({
          type: 'matching',
          event: 'candidate_metadata_repair_failed',
          correlationId,
          rideId,
          driverId: d.user_id,
          error: err.message,
        });
      }
      return { ...d, hashExists: Boolean(hashes[i]), onlineSince: hashes[i]?.onlineSince || null };
    })
  );

  const candidates = enriched.filter((d) => d.vehicle_type === vehicleType);

  logger.info({
    type: 'matching',
    event: 'candidate_discovery',
    correlationId,
    rideId,
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    radiusMeters: NEARBY_DRIVER_RADIUS_METERS,
    requestedVehicleType: vehicleType,
    nearbyCount: nearbyDrivers.length,
    nearbyDrivers: enriched.map((d) => ({
      driverId: d.user_id,
      distanceMeters: d.distance_meters,
      vehicleType: d.vehicle_type,
      status: d.status,
      hashExists: d.hashExists,
      onlineSince: d.onlineSince,
    })),
    excluded: enriched
      .filter((d) => d.vehicle_type !== vehicleType)
      .map((d) => ({
        driverId: d.user_id,
        vehicleType: d.vehicle_type,
        reason: d.vehicle_type === null ? 'hash_metadata_missing' : 'vehicle_type_mismatch',
      })),
    candidateCount: candidates.length,
  });

  return {
    candidates,
    candidateCount: candidates.length,
    candidateIds: candidates.map((d) => d.user_id),
  };
};

module.exports = { findCandidates };