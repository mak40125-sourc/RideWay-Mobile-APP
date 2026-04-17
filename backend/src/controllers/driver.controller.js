const { query } = require('../config/db');
const redisClient = require('../config/redis');

exports.updateLocation = async (req, res) => {
  try {
    const { location } = req.body;
    const userId = req.user.id;

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return res.status(400).json({ error: 'Valid location (latitude, longitude) is required' });
    }

    // Update driver location in Postgres
    await query(
      `UPDATE drivers SET location = ST_SetSRID(ST_Point($1, $2), 4326), last_pings_at = NOW() WHERE user_id = $3`,
      [location.longitude, location.latitude, userId]
    );

    // Update Redis for real-time tracking
    await redisClient.set(`driver:location:${userId}`, JSON.stringify(location), 'EX', 60);

    res.status(200).json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setOnline = async (req, res) => {
  try {
    const { driverId, isOnline } = req.body;
    const userId = req.user.id;

    await query(
      `UPDATE drivers SET is_online = $1, updated_at = NOW() WHERE user_id = $2`,
      [isOnline, userId]
    );

    await redisClient.set(`driver:online:${userId}`, isOnline ? '1' : '0');

    res.status(200).json({ message: `Driver is now ${isOnline ? 'online' : 'offline'}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, radius = 3000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng query parameters are required' });
    }

    const drivers = await query(
      `SELECT user_id, vehicle_type, vehicle_number,
       ST_Distance(location, ST_SetSRID(ST_Point($1, $2), 4326)) as distance
       FROM drivers
       WHERE is_online = true
       AND ST_DWithin(location, ST_SetSRID(ST_Point($1, $2), 4326), $3)
       ORDER BY distance ASC
       LIMIT 10`,
      [lng, lat, radius]
    );

    res.status(200).json(drivers.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};