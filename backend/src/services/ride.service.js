const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const redisClient = require('../config/redis');
const driverService = require('./driver.service');

const RIDE_REQUEST_TTL = 120;

const createRideRequest = async (riderId, pickup, dropoff, fare, distance, duration, vehicleType) => {
  const rideId = crypto.randomUUID();

  const rideData = {
    riderId,
    pickupLat: String(pickup.lat),
    pickupLng: String(pickup.lng),
    pickupAddress: pickup.address || '',
    dropLat: String(dropoff.lat),
    dropLng: String(dropoff.lng),
    dropAddress: dropoff.address || '',
    fare: String(fare),
    distance: String(distance),
    duration: String(duration),
    vehicleType,
    status: 'REQUESTED',
    createdAt: String(Date.now()),
  };

  const redisKey = `ride:request:${rideId}`;
  await redisClient.hset(redisKey, rideData);
  await redisClient.expire(redisKey, RIDE_REQUEST_TTL);

  const nearbyDrivers = await driverService.findNearbyDrivers(pickup.lat, pickup.lng, 3000);
  const candidates = nearbyDrivers.filter((d) => d.vehicle_type === vehicleType);
  const candidateCount = candidates.length;

  if (candidateCount > 0) {
    const candidateIds = candidates.map((d) => d.user_id);
    const queueKey = `matching:queue:${rideId}`;
    await redisClient.sadd(queueKey, ...candidateIds);
    await redisClient.expire(queueKey, RIDE_REQUEST_TTL);

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

    const notification = JSON.stringify({
      rideId,
      pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address || '' },
      dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address || '' },
      fare,
      distance,
      duration,
      riderName,
      candidateDriverIds: candidateIds,
    });

    await redisClient.publish('ride:notifications', notification);
  }

  return { rideId, candidateCount };
};

const acceptRide = async (rideId, driverId) => {
  const lockKey = `ride:lock:${rideId}`;
  const acquired = await redisClient.set(lockKey, driverId, 'NX', 'EX', 10);

  if (!acquired) {
    throw new Error('Ride already accepted by another driver.');
  }

  try {
    const redisKey = `ride:request:${rideId}`;
    const rideData = await redisClient.hgetall(redisKey);

    if (!rideData || !rideData.riderId) {
      await redisClient.del(lockKey);
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
      await redisClient.del(lockKey);
      throw new Error('Failed to persist ride acceptance.');
    }

    await redisClient.del(redisKey);
    await redisClient.del(`matching:queue:${rideId}`);
    await redisClient.del(lockKey);

    return Array.isArray(ride) ? ride[0] : ride;
  } catch (err) {
    await redisClient.del(lockKey);
    throw err;
  }
};

module.exports = {
  createRideRequest,
  acceptRide,
};
