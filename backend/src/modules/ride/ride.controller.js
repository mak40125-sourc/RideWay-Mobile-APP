const rideService = require('./ride.service');

exports.requestRide = async (req, res) => {
  try {
    const { riderId, pickup, dropoff, fare, distance, duration, vehicleType, passengerName, passengerPhone } = req.body;
    const result = await rideService.createRideRequest(
      riderId, pickup, dropoff, fare, distance, duration, vehicleType,
      { passengerName, passengerPhone }
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
  const { rideId } = req.params;
  const { status } = req.body;
  const driverId = req.user.id;
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_REQUEST ts=${ts} rideId=${rideId} status=${status} driverId=${driverId} endpoint=PUT:/rides/:rideId/status`);
  try {
    const validStatuses = ['DRIVER_ARRIVING', 'RIDE_STARTED', 'RIDE_COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const ride = await rideService.updateRideStatus(rideId, driverId, status);
    if (!ride) return res.status(404).json({ error: 'Ride not found or not assigned to you' });

    // eslint-disable-next-line no-console
    console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_EMIT ts=${new Date().toISOString()} rideId=${rideId} status=${ride.status} event=ride:status_changed riderRoom=rider:${ride.rider_id} layer=controller.updateRideStatus`);
    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = await rideService.getRide(rideId);

    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.completeRide = async (req, res) => {
  const { rideId } = req.params;
  const driverId = req.user.id;
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_REQUEST ts=${ts} rideId=${rideId} status=RIDE_COMPLETED driverId=${driverId} endpoint=POST:/rides/:rideId/complete`);
  try {
    const ride = await rideService.completeRide(rideId, driverId);
    if (!ride) return res.status(404).json({ error: 'Ride not found or not assigned to you' });

    // eslint-disable-next-line no-console
    console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_EMIT ts=${new Date().toISOString()} rideId=${rideId} status=${ride.status} event=ride:status_changed riderRoom=rider:${ride.rider_id} layer=controller.completeRide`);
    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;

    const ride = await rideService.cancelRide(rideId, driverId);
    if (!ride) return res.status(404).json({ error: 'Ride not found or not assigned to you' });

    res.status(200).json(ride);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRiderActiveRide = async (req, res) => {
  try {
    const { riderId } = req.params;
    const ride = await rideService.getRiderActiveRide(riderId);

    res.status(200).json(ride || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRiderRideHistory = async (req, res) => {
  try {
    const { riderId } = req.params;
    const rides = await rideService.getRiderRideHistory(riderId);

    res.status(200).json(rides || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
