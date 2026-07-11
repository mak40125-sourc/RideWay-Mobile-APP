const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const redisService = require('./redis.service');

const createRideRequest = async (riderId, pickup, dropoff, fare, distance, duration, vehicleType) => {
  const rideId = crypto.randomUUID();

  await redisService.createRideRequest(rideId, {
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

  const nearbyDrivers = await redisService.getNearbyDrivers(pickup.lat, pickup.lng, 3000);
  const candidates = nearbyDrivers.filter((d) => d.vehicle_type === vehicleType);
  const candidateCount = candidates.length;

  if (candidateCount > 0) {
    const candidateIds = candidates.map((d) => d.user_id);
    await redisService.addDriversToQueue(rideId, candidateIds);

    let riderName = 'Rider';
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', riderId)
        .single();
      if (profile?.name) riderName = profile.name;
    } catch {
    }

    await redisService.publishNotification('ride:notifications', {
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
  const acquired = await redisService.acquireRideLock(rideId, driverId, 10);
  if (!acquired) {
    throw new Error('Ride already accepted by another driver.');
  }

  try {
    const rideData = await redisService.getRideRequest(rideId);
    if (!rideData) {
      await redisService.releaseRideLock(rideId);
      throw new Error('Ride request expired or no longer available.');
    }

    const { data: ride, error } = await supabaseAdmin.rpc('accept_ride', {
      p_ride_id: rideId,
      p_rider_id: rideData.riderId,
      p_driver_id: driverId,
      p_pickup_lat: parseFloat(rideData.pickupLat),
      p_pickup_lng: parseFloat(rideData.pickupLng),
      p_drop_lat: parseFloat(rideData.dropLat),
      p_drop_lng: parseFloat(rideData.dropLng),
      p_fare: parseFloat(rideData.fare),
      p_distance: parseFloat(rideData.distance),
      p_duration: parseFloat(rideData.duration),
      p_pickup_address: rideData.pickupAddress || '',
      p_drop_address: rideData.dropAddress || '',
    });

    if (error || !ride) {
      await redisService.releaseRideLock(rideId);
      throw new Error('Failed to persist ride acceptance.');
    }

    await redisService.deleteRideRequest(rideId);
    await redisService.deleteQueue(rideId);
    await redisService.releaseRideLock(rideId);

    return Array.isArray(ride) ? ride[0] : ride;
  } catch (err) {
    await redisService.releaseRideLock(rideId);
    throw err;
  }
};

module.exports = {
  createRideRequest,
  acceptRide,
};
