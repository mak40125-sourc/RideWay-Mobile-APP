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

  const candidates = nearbyDrivers.filter((d) => d.vehicle_type === vehicleType);

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
    nearbyDrivers: nearbyDrivers.map((d, i) => ({
      driverId: d.user_id,
      distanceMeters: d.distance_meters,
      vehicleType: d.vehicle_type,
      status: d.status,
      hashExists: Boolean(hashes[i]),
      onlineSince: hashes[i]?.onlineSince || null,
    })),
    excluded: nearbyDrivers
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