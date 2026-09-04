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

exports.updateStatus = async (rideId, driverId, status) => {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_REQUEST ts=${ts} rideId=${rideId} status=${status} driverId=${driverId} layer=repository.updateStatus`);
  const { data: ride, error } = await supabaseAdmin
    .from('rides')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', rideId)
    .eq('driver_id', driverId)
    .select()
    .maybeSingle();
  if (error) throw error;
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_COMPLETED_PERSISTED ts=${new Date().toISOString()} rideId=${rideId} status=${ride?.status ?? 'null'} layer=repository.updateStatus persisted=${!!ride} error=${error?.message ?? 'none'}`);
  return ride;
};

exports.completeRide = async (rideId, driverId) => {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_REQUEST ts=${ts} rideId=${rideId} status=RIDE_COMPLETED driverId=${driverId} layer=repository.completeRide`);
  const { data: ride, error } = await supabaseAdmin
    .from('rides')
    .update({ status: 'RIDE_COMPLETED', updated_at: new Date().toISOString() })
    .eq('id', rideId)
    .eq('driver_id', driverId)
    .select()
    .maybeSingle();
  if (error) throw error;
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_COMPLETED_PERSISTED ts=${new Date().toISOString()} rideId=${rideId} status=${ride?.status ?? 'null'} layer=repository.completeRide persisted=${!!ride}`);
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