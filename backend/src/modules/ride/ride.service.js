const crypto = require('crypto');
const rideRepository = require('./ride.repository');

const createRideRequest = async (riderId, pickup, dropoff, fare, distance, duration, vehicleType) => {
  const rideId = crypto.randomUUID();

  await rideRepository.createRideRequest(rideId, {
    riderId,
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    pickupAddress: pickup.address || '',
    dropLat: dropoff.lat,
    dropLng: dropoff.lng,
    dropAddress: dropoff.address || '',
    fare,
    distance,
    duration,
    vehicleType,
  });

  const nearbyDrivers = await rideRepository.getNearbyDrivers(pickup.lat, pickup.lng, 3000);
  const candidates = nearbyDrivers.filter((d) => d.vehicle_type === vehicleType);
  const candidateCount = candidates.length;

  if (candidateCount > 0) {
    const candidateIds = candidates.map((d) => d.user_id);
    await rideRepository.addDriversToQueue(rideId, candidateIds);

    let riderName = 'Rider';
    try {
      const name = await rideRepository.getRiderName(riderId);
      if (name) riderName = name;
    } catch {
    }

    await rideRepository.publishNotification('ride:notifications', {
      rideId,
      pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address || '' },
      dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address || '' },
      fare,
      distance,
      duration,
      riderName,
      candidateDriverIds: candidateIds,
    });
  }

  return { rideId, candidateCount };
};

const acceptRide = async (rideId, driverId) => {
  const acquired = await rideRepository.acquireRideLock(rideId, driverId, 10);
  if (!acquired) {
    throw new Error('Ride already accepted by another driver.');
  }

  try {
    const rideData = await rideRepository.getRideRequest(rideId);
    if (!rideData) {
      await rideRepository.releaseRideLock(rideId);
      throw new Error('Ride request expired or no longer available.');
    }

    const ride = await rideRepository.acceptRide(rideId, rideData, driverId);

    if (!ride) {
      await rideRepository.releaseRideLock(rideId);
      throw new Error('Failed to persist ride acceptance.');
    }

    await rideRepository.deleteRideRequest(rideId);
    await rideRepository.deleteQueue(rideId);
    await rideRepository.releaseRideLock(rideId);

    return Array.isArray(ride) ? ride[0] : ride;
  } catch (err) {
    await rideRepository.releaseRideLock(rideId);
    throw err;
  }
};

const getRide = (rideId) => rideRepository.getRide(rideId);

const updateRideStatus = (rideId, driverId, status) =>
  rideRepository.updateStatus(rideId, driverId, status);

const completeRide = (rideId, driverId) => rideRepository.completeRide(rideId, driverId);

const cancelRide = (rideId, driverId) => rideRepository.cancelRide(rideId, driverId);

const getRiderActiveRide = (riderId) => rideRepository.getRiderActiveRide(riderId);

const getRiderRideHistory = (riderId) => rideRepository.getRiderRideHistory(riderId);

module.exports = {
  createRideRequest,
  acceptRide,
  getRide,
  updateRideStatus,
  completeRide,
  cancelRide,
  getRiderActiveRide,
  getRiderRideHistory,
};
