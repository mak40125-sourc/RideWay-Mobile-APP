const { supabaseAdmin } = require('../../core/database/supabase');

// Ride lifecycle persistence. The ride module's business logic (ride.service.js)
// never accesses storage directly — all Supabase persistence flows through this
// repository. Ride-matching persistence lives in
// ../matching/matching.repository.js.

// ── Supabase: rides ───────────────────────────────────────────────
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