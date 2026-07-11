const { supabaseAdmin } = require('../config/supabase');
const rideService = require('../services/ride.service');

exports.requestRide = async (req, res) => {
  try {
    const { riderId, pickup, dropoff, fare, distance, duration, vehicleType } = req.body;
    const result = await rideService.createRideRequest(
      riderId, pickup, dropoff, fare, distance, duration, vehicleType
    );
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

exports.updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;
    const driverId = req.user.id;

    const validStatuses = ['DRIVER_ARRIVING', 'RIDE_STARTED', 'RIDE_COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const { data: ride, error } = await supabaseAdmin
      .from('rides')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', rideId)
      .eq('driver_id', driverId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!ride) return res.status(404).json({ error: 'Ride not found or not assigned to you' });

    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ride not found' });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.completeRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const { data: ride, error } = await supabaseAdmin
      .from('rides')
      .update({ status: 'RIDE_COMPLETED', updated_at: new Date().toISOString() })
      .eq('id', rideId)
      .eq('driver_id', driverId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ride not found or not assigned to you' });

    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('rides')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', rideId)
      .eq('driver_id', driverId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ride not found or not assigned to you' });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRiderActiveRide = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('rides')
      .select('*')
      .eq('rider_id', riderId)
      .in('status', ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'RIDE_STARTED'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.status(200).json(data || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
