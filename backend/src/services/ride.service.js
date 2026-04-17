const { query } = require('../config/db');
const redisClient = require('../config/redis');
const driverService = require('./driver.service');

/**
 * Creates a ride request and finds candidate drivers
 */
const createRideRequest = async (riderId, pickup, dropoff, fare, distance, duration, vehicleType) => {
  // 1. Persist ride request in Postgres
  const rideRes = await query(
    `INSERT INTO rides (rider_id, pickup_location, drop_location, fare, status, distance, duration)
     VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), ST_SetSRID(ST_Point($4, $5), 4326), $6, 'REQUESTED', $7, $8)
     RETURNING *`,
    [riderId, pickup.lng, pickup.lat, dropoff.lng, dropoff.lat, fare, distance, duration]
  );
  const ride = rideRes.rows[0];

  // 2. Query nearby drivers (Filters by ₹100 min balance automatically)
  const nearbyDrivers = await driverService.findNearbyDrivers(pickup.lat, pickup.lng, 3000);

  // 3. Filter by vehicle type preference
  const candidates = nearbyDrivers.filter(d => d.vehicle_type === vehicleType);

  if (candidates.length > 0) {
    const candidateIds = candidates.map(d => d.user_id);
    const redisKey = `matching:queue:${ride.id}`;
    
    // Store candidates in Redis for matching flow
    await redisClient.sadd(redisKey, ...candidateIds);
    await redisClient.expire(redisKey, 120); // 2 minute timeout for matching
  }

  return { ride, candidateCount: candidates.length };
};

/**
 * Handles atomic ride acceptance using Redis SET NX
 */
const acceptRide = async (rideId, driverId) => {
  const lockKey = `ride:lock:${rideId}`;
  
  // Redis Distributed Lock: First driver to set this wins
  const acquired = await redisClient.set(lockKey, driverId, 'NX', 'EX', 10);
  
  if (!acquired) {
    throw new Error('Ride already accepted by another driver.');
  }

  try {
    // Update Ride status in Postgres
    const res = await query(
      `UPDATE rides 
       SET driver_id = (SELECT id FROM drivers WHERE user_id = $1), 
           status = 'DRIVER_ASSIGNED' 
       WHERE id = $2 AND status = 'REQUESTED' 
       RETURNING *`,
      [driverId, rideId]
    );

    if (res.rowCount === 0) {
      await redisClient.del(lockKey);
      throw new Error('Ride is no longer available.');
    }

    // Cleanup the matching queue
    await redisClient.del(`matching:queue:${rideId}`);

    return res.rows[0];
  } catch (err) {
    // Release lock if DB update fails so another driver can try if applicable
    await redisClient.del(lockKey);
    throw err;
  }
};

module.exports = {
  createRideRequest,
  acceptRide
};