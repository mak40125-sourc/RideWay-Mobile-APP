const rideService = require('./ride.service');

exports.estimateFare = async (req, res) => {
  try {
    const { pickup, dropoff, vehicleType } = req.body;
    if (!pickup || !dropoff || !vehicleType) {
      return res.status(422).json({ error: 'pickup, dropoff and vehicleType are required' });
    }
    const quote = await rideService.estimateFare(pickup, dropoff, vehicleType);
    res.status(200).json(quote);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.requestRide = async (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body.idempotencyKey || null;
    // Client fare/distance/duration are accepted for backward compatibility but
    // treated as untrusted; the matching service recomputes authoritative values.
    const { riderId, pickup, dropoff, fare, distance, duration, vehicleType, passengerName, passengerPhone } = req.body;
    const effectiveRiderId = riderId || req.user.id;
    const result = await rideService.createRideRequest(
      effectiveRiderId, pickup, dropoff, fare, distance, duration, vehicleType,
      { passengerName, passengerPhone, idempotencyKey }
    );
    const status = result?.recovered || result?.idempotencyHit ? 200 : 201;
    if (result?.idempotencyHit) {
      res.setHeader('x-idempotency-hit', 'true');
    }
    res.status(status).json(result);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.acceptRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;
    const ride = await rideService.acceptRide(rideId, driverId);
    if (!ride) return res.status(404).json({ error: 'Ride not found or not available for acceptance' });
    res.status(200).json(ride);
  } catch (error) {
    const status = error.status || (error.message.includes('already assigned') || error.message.includes('Invalid transition') ? 409 : 400);
    res.status(status).json({ error: error.message });
  }
};

exports.rejectRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const driverId = req.user.id;
    const result = await rideService.rejectRide(rideId, driverId);
    res.status(200).json(result);
  } catch (error) {
    const status = error.status || 400;
    res.status(status).json({ error: error.message });
  }
};

exports.updateRideStatus = async (req, res) => {
  const { rideId } = req.params;
  const { status } = req.body;
  const driverId = req.user.id;
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_REQUESTED ts=${ts} rideId=${rideId} status=${status} driverId=${driverId} endpoint=PUT:/rides/:rideId/status`);
  try {
    const validStatuses = ['DRIVER_ARRIVING', 'RIDE_STARTED', 'RIDE_COMPLETED'];
    if (!validStatuses.includes(status)) {
      return res.status(422).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const ride = await rideService.updateRideStatus(rideId, driverId, status);
    if (!ride) return res.status(404).json({ error: 'Ride not found or not assigned to you' });

    // eslint-disable-next-line no-console
    console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_EMIT ts=${new Date().toISOString()} rideId=${rideId} status=${ride.status} event=ride:status_changed riderRoom=rider:${ride.rider_id} layer=controller.updateRideStatus`);
    res.status(200).json(ride);
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Failed to update ride status';
    if (status === 409) {
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_REJECTED ts=${new Date().toISOString()} rideId=${rideId} status=${status} reason=${message}`);
    }
    res.status(status).json({ error: message });
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
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
};

exports.cancelRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const actorId = req.user.id;
    // Determine actor role: rider if they own the ride, else driver
    let actorRole = 'driver';
    try {
      const ride = await rideService.getRide(rideId);
      if (ride && ride.rider_id === actorId) actorRole = 'rider';
    } catch {}
    const ride = await rideService.cancelRide(rideId, actorId, actorRole);
    if (!ride) return res.status(404).json({ error: 'Ride not found or not authorized to cancel' });

    res.status(200).json(ride);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
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

exports.getMyActiveRide = async (req, res) => {
  try {
    const riderId = req.user.id;
    const ride = await rideService.getRiderActiveRide(riderId);
    res.status(200).json(ride || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDriverActiveRide = async (req, res) => {
  try {
    const driverId = req.user.id;
    const ride = await rideService.getDriverActiveRide(driverId);
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
