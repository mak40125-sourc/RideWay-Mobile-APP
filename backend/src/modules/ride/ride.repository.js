const { supabaseAdmin } = require('../../core/database/supabase');
const redisService = require('../../core/redis/redis.service');

// Ride lifecycle persistence. The ride module's business logic (ride.service.js)
// never accesses storage directly — all Supabase persistence flows through this
// repository. Ride-matching persistence lives in
// ../matching/matching.repository.js.

// Best-effort attach of passenger identity (book-for-someone-else) from Redis.
// The rides table has no passenger columns, so this keeps the driver/rider view
// consistent for the whole ride without a DB schema change.
const withPassenger = async (ride) => {
  if (!ride) return ride;
  try {
    const p = await redisService.getRidePassenger(ride.id);
    if (p) {
      ride.passenger_name = p.name || null;
      ride.passenger_phone = p.phone || null;
    }
  } catch {
    // ignore — passenger is optional
  }
  return ride;
};

// ── Supabase: rides ───────────────────────────────────────────────
exports.getRide = async (rideId) => {
  const { data, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('id', rideId)
    .maybeSingle();
  if (error) throw error;
  return withPassenger(data);
};

// Atomic transition using DB row lock + lifecycle validation.
// Uses transition_ride_status RPC (FOR UPDATE) so check+update is one atomic step.
// Idempotent: if already in requested status, returns existing row without bumping timestamps.
// Returns null if ride not found or not owned (caller maps to 404), throws with status 409 on invalid transition.
const mapRpcError = (error) => {
  if (!error) return error;
  const msg = error.message || '';
  if (msg.includes('Could not find the function')) {
    const e = new Error(msg);
    e.code = 'RPC_NOT_FOUND';
    return e;
  }
  if (msg.includes('Ride already assigned') || msg.includes('Invalid transition') || msg.includes('already terminal') || msg.includes('not in accept-able state')) {
    const e = new Error(msg);
    e.status = 409;
    e.code = 'CONFLICT';
    return e;
  }
  if (msg.includes('Not authorized') || error.code === '42501') {
    const e = new Error('Not authorized for this ride');
    e.status = 403;
    e.code = 'FORBIDDEN';
    return e;
  }
  if (msg.includes('Ride not found')) {
    return null;
  }
  return error;
};

async function fallbackTransition(rideId, actorId, newStatus, actorRole) {
  const { isValidTransition } = require('./ride.lifecycle');
  const { data: ride, error } = await supabaseAdmin.from('rides').select('*').eq('id', rideId).maybeSingle();
  if (error) throw error;
  if (!ride) return null;
  if (ride.driver_id && actorRole === 'driver' && ride.driver_id !== actorId && newStatus !== 'CANCELLED') {
    const e = new Error('Not authorized for this ride');
    e.status = 403;
    throw e;
  }
  if (ride.status === newStatus) return withPassenger(ride);
  if (!isValidTransition(ride.status, newStatus)) {
    const e = new Error(`Invalid transition: ${ride.status} -> ${newStatus}`);
    e.status = 409;
    throw e;
  }
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_FALLBACK_TRANSITION rideId=${rideId} ${ride.status}->${newStatus} (RPC not found, using JS validation)`);
  const { data, error: upErr } = await supabaseAdmin.from('rides').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', rideId).select().maybeSingle();
  if (upErr) throw upErr;
  return withPassenger(data);
}

exports.updateStatus = async (rideId, driverId, status) => {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_REQUESTED ts=${ts} rideId=${rideId} status=${status} driverId=${driverId} layer=repository.updateStatus`);
  const { data, error } = await supabaseAdmin.rpc('transition_ride_status', {
    p_ride_id: rideId,
    p_actor_id: driverId,
    p_new_status: status,
    p_actor_role: 'driver',
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (mapped && mapped.code === 'RPC_NOT_FOUND') {
      return fallbackTransition(rideId, driverId, status, 'driver');
    }
    if (mapped === null) return null;
    if (mapped.status) throw mapped;
    throw error;
  }
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_ACCEPTED ts=${new Date().toISOString()} rideId=${rideId} status=${data?.status ?? 'null'} layer=repository.updateStatus`);
  if (data && Array.isArray(data)) return data[0] ? withPassenger(data[0]) : null;
  return withPassenger(data);
};

exports.completeRide = async (rideId, driverId) => {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_REQUESTED ts=${ts} rideId=${rideId} status=RIDE_COMPLETED driverId=${driverId} layer=repository.completeRide`);
  const { data, error } = await supabaseAdmin.rpc('transition_ride_status', {
    p_ride_id: rideId,
    p_actor_id: driverId,
    p_new_status: 'RIDE_COMPLETED',
    p_actor_role: 'driver',
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (mapped && mapped.code === 'RPC_NOT_FOUND') {
      return fallbackTransition(rideId, driverId, 'RIDE_COMPLETED', 'driver');
    }
    if (mapped === null) return null;
    if (mapped.status) throw mapped;
    throw error;
  }
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_ACCEPTED ts=${new Date().toISOString()} rideId=${rideId} status=${data?.status ?? 'null'} layer=repository.completeRide`);
  if (data && Array.isArray(data)) return data[0] ? withPassenger(data[0]) : null;
  return withPassenger(data);
};

exports.cancelRide = async (rideId, driverId, actorRole = 'driver') => {
  const { data, error } = await supabaseAdmin.rpc('transition_ride_status', {
    p_ride_id: rideId,
    p_actor_id: driverId,
    p_new_status: 'CANCELLED',
    p_actor_role: actorRole,
  });
  if (error) {
    const mapped = mapRpcError(error);
    if (mapped && mapped.code === 'RPC_NOT_FOUND') {
      return fallbackTransition(rideId, driverId, 'CANCELLED', actorRole);
    }
    if (mapped === null) return null;
    if (mapped.status) throw mapped;
    throw error;
  }
  if (data && Array.isArray(data)) return data[0] ? withPassenger(data[0]) : null;
  return withPassenger(data);
};

exports.createRideIdempotent = async ({ rideId, riderId, pickupLat, pickupLng, dropLat, dropLng, pickupAddress, dropAddress, fare, distance, duration, idempotencyKey, fareBreakdown = null, pricingVersion = null }) => {
  const { data, error } = await supabaseAdmin.rpc('create_ride_idempotent', {
    p_ride_id: rideId,
    p_rider_id: riderId,
    p_pickup_lat: pickupLat,
    p_pickup_lng: pickupLng,
    p_drop_lat: dropLat,
    p_drop_lng: dropLng,
    p_pickup_address: pickupAddress || '',
    p_drop_address: dropAddress || '',
    p_fare: fare,
    p_distance: distance,
    p_duration: duration,
    p_idempotency_key: idempotencyKey || null,
    p_fare_breakdown: fareBreakdown,
    p_pricing_version: pricingVersion,
  });
  if (error) {
    if (error.message && error.message.includes('Could not find the function')) {
      // Fallback when migration not yet applied: insert directly without idempotency column (graceful)
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] RIDE_FALLBACK_CREATE rideId=${rideId} (RPC not found, inserting without idempotency_key)`);
      const payload = {
        id: rideId,
        rider_id: riderId,
        pickup_location: `SRID=4326;POINT(${pickupLng} ${pickupLat})`,
        drop_location: `SRID=4326;POINT(${dropLng} ${dropLat})`,
        pickup_address: pickupAddress || '',
        drop_address: dropAddress || '',
        fare, distance, duration,
        fare_breakdown: fareBreakdown,
        pricing_version: pricingVersion,
        status: 'SEARCHING_DRIVER',
      };
      const { data: inserted, error: insErr } = await supabaseAdmin.from('rides').insert(payload).select().maybeSingle();
      if (insErr && insErr.message.includes('duplicate')) {
        // Check for existing by idempotency key fallback path (should not happen without column)
        const { data: existing } = await supabaseAdmin.from('rides').select('*').eq('id', rideId).maybeSingle();
        return withPassenger(existing);
      }
      if (insErr) throw insErr;
      return withPassenger(inserted);
    }
    throw error;
  }
  if (data && Array.isArray(data)) return withPassenger(data[0]);
  return withPassenger(data);
};

const ACTIVE_RIDE_FRESHNESS_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'RIDE_STARTED'];

exports.getRiderActiveRide = async (riderId) => {
  const freshnessThreshold = new Date(Date.now() - ACTIVE_RIDE_FRESHNESS_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('rider_id', riderId)
    .in('status', ACTIVE_STATUSES)
    .gte('updated_at', freshnessThreshold)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return withPassenger(data);
};

exports.getDriverActiveRide = async (driverId) => {
  const freshnessThreshold = new Date(Date.now() - ACTIVE_RIDE_FRESHNESS_MS).toISOString();
  const driverStatuses = ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'RIDE_STARTED'];
  const { data, error } = await supabaseAdmin
    .from('rides')
    .select('*')
    .eq('driver_id', driverId)
    .in('status', driverStatuses)
    .gte('updated_at', freshnessThreshold)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return withPassenger(data);
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