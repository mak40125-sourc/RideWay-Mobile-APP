const { supabaseAdmin } = require('../../core/database/supabase');
const redisService = require('../../core/redis/redis.service');
const driverRepository = require('../driver/driver.repository');

// Matching persistence. The matching module's business logic
// (matching.service.js) never accesses storage directly — all Supabase / Redis
// persistence for ride-matching flows through this repository.

// ── Redis: ride request buffer ────────────────────────────────────
exports.createRideRequest = (rideId, data) => redisService.createRideRequest(rideId, data);

exports.getRideRequest = (rideId) => redisService.getRideRequest(rideId);

exports.deleteRideRequest = (rideId) => redisService.deleteRideRequest(rideId);

// ── Redis: passenger identity (book-for-someone-else) ────────────
// Persisted separately from the rides table (which has no passenger columns in
// the current schema) so the driver can see the actual passenger for the whole
// ride lifecycle without a DB migration.
exports.setRidePassenger = (rideId, name, phone) => redisService.setRidePassenger(rideId, name, phone);

exports.getRidePassenger = (rideId) => redisService.getRidePassenger(rideId);

// ── Redis: driver availability ────────────────────────────────────
exports.getNearbyDrivers = (latitude, longitude, radiusMeters) =>
  redisService.getNearbyDrivers(latitude, longitude, radiusMeters);

// Single-driver hash snapshot (current availability metadata), used for
// candidate-discovery diagnostics.
exports.getDriver = (driverId) => redisService.getDriver(driverId);

// Repair-at-read: restore a nearby driver's missing availability metadata from
// the authoritative drivers row. Delegates to the driver module's existing
// repair routine (UUID-guarded, failure-tolerant) so matching never duplicates
// restoration logic. Callers bound this to actual GEO candidates only.
exports.repairDriverMetadata = (driverId) =>
  driverRepository.ensureDriverHashMetadata(driverId);

// ── Redis: offer queue ────────────────────────────────────────────
exports.addDriversToQueue = (rideId, driverIds) => redisService.addDriversToQueue(rideId, driverIds);

exports.deleteQueue = (rideId) => redisService.deleteQueue(rideId);

// ── Redis: distributed lock ───────────────────────────────────────
exports.acquireRideLock = (rideId, driverId, ttl) =>
  redisService.acquireRideLock(rideId, driverId, ttl);

exports.releaseRideLock = (rideId) => redisService.releaseRideLock(rideId);

// ── Redis: pub/sub ────────────────────────────────────────────────
exports.publishNotification = (channel, message) => redisService.publishNotification(channel, message);

// ── Supabase: rider name ──────────────────────────────────────────
exports.getRiderName = async (riderId) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', riderId)
    .single();
  if (error) return null;
  return data?.name || null;
};

// ── Supabase: rides ───────────────────────────────────────────────
exports.acceptRide = async (rideId, rideData, driverId) => {
  const { data, error } = await supabaseAdmin.rpc('accept_ride', {
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
  if (error) return null;
  return data;
};