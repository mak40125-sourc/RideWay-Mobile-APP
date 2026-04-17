const rideService = require('../services/ride.service');

exports.requestRide = async (req, res) => {
  try {
    const { riderId, pickup, dropoff, fare, distance, duration, vehicleType } = req.body;
    const result = await rideService.createRideRequest(riderId, pickup, dropoff, fare, distance, duration, vehicleType);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;
    const ride = await rideService.acceptRide(rideId, driverId);
    res.status(200).json(ride);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { query } = require('../config/db');
    const result = await query('SELECT * FROM rides WHERE id = $1', [rideId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.completeRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { query } = require('../config/db');
    const result = await query(
      `UPDATE rides SET status = 'RIDE_COMPLETED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [rideId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { query } = require('../config/db');
    const redisClient = require('../config/redis');
    const result = await query(
      `UPDATE rides SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [rideId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    // Cleanup Redis locks
    await redisClient.del(`ride:lock:${rideId}`);
    await redisClient.del(`matching:queue:${rideId}`);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRiderActiveRide = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { query } = require('../config/db');
    const result = await query(
      `SELECT * FROM rides WHERE rider_id = $1 AND status NOT IN ('RIDE_COMPLETED', 'CANCELLED') ORDER BY created_at DESC LIMIT 1`,
      [riderId]
    );
    res.status(200).json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};