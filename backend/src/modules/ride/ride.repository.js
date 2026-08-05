const { supabaseAdmin } = require('../../core/database/supabase');
const redisService = require('../../core/redis/redis.service');

// Ride persistence. The ride module's business logic (ride.service.js) never
// accesses storage directly — all Supabase / Redis persistence flows through
// this repository.

// ── Redis: ride request buffer ────────────────────────────────────
exports.createRideRequest = (rideId, data) => redisService.createRideRequest(rideId, data);

exports.getRideRequest = (rideId) => redisService.getRideRequest(rideId);

exports.deleteRideRequest = (rideId) => redisService.deleteRideRequest(rideId);

// ── Redis: driver availability ────────────────────────────────────
exports.getNearbyDrivers = (latitude, longitude, radiusMeters) =>
  redisService.getNearbyDrivers(latitude, longitude, radiusMeters);

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

exports.getRide = async (rideId) => {
  const { data, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('id', rideId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

exports.updateStatus = async (rideId, driverId, status) => {
  const { data: ride, error } = await supabaseAdmin
    .from('rides')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', rideId)
    .eq('driver_id', driverId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return ride;
};

exports.completeRide = async (rideId, driverId) => {
  const { data: ride, error } = await supabaseAdmin
    .from('rides')
    .update({ status: 'RIDE_COMPLETED', updated_at: new Date().toISOString() })
    .eq('id', rideId)
    .eq('driver_id', driverId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return ride;
};

exports.cancelRide = async (rideId, driverId) => {
  const { data, error } = await supabaseAdmin
    .from('rides')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', rideId)
    .eq('driver_id', driverId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
};

exports.getRiderActiveRide = async (riderId) => {
  const { data, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('rider_id', riderId)
    .in('status', ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'RIDE_STARTED'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

exports.getRiderRideHistory = async (riderId) => {
  const { data, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('rider_id', riderId)
    .not('status', 'in', '("REQUESTED","SEARCHING_DRIVER","DRIVER_ASSIGNED","DRIVER_ARRIVING","RIDE_STARTED")')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
};
