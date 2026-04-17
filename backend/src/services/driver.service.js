const { query } = require('../config/db');

exports.findNearbyDrivers = async (lat, lng, radius) => {
  const drivers = await query(
    `SELECT user_id, vehicle_type, 
     ST_Distance(location, ST_SetSRID(ST_Point($1, $2), 4326)) as distance
     FROM drivers
     WHERE is_online = true 
     AND wallet_balance >= 100
     AND ST_DWithin(location, ST_SetSRID(ST_Point($1, $2), 4326), $3)
     ORDER BY distance ASC`,
    [lng, lat, radius]
  );
  return drivers.rows;
};