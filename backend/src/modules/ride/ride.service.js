const rideRepository = require('./ride.repository');
const { matchingService } = require('../matching');
const { stage, track, currentCorrelationId } = require('../../core/logger/logger');

// Ride lifecycle service. Ride-request matching and driver acceptance
// orchestration live in the matching module (matchingService); this service
// keeps ride lifecycle persistence (status, completion, cancellation, history).
const getRide = (rideId) => rideRepository.getRide(rideId);

const updateRideStatus = async (rideId, driverId, status) => {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_REQUESTED ts=${ts} rideId=${rideId} status=${status} driverId=${driverId} layer=service.updateRideStatus`);
  const correlationId = currentCorrelationId();
  const before = await rideRepository.getRide(rideId);
  const ride = await rideRepository.updateStatus(rideId, driverId, status);
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_ACCEPTED ts=${new Date().toISOString()} rideId=${rideId} status=${ride?.status ?? 'null'} layer=service.updateRideStatus`);
  if (ride) {
    // Idempotency: if status unchanged, don't re-emit as new transition
    const isIdempotent = before && before.status === ride.status;
    if (isIdempotent) {
      stage(correlationId, '15', 'ride_transition_idempotent', { rideId, driverId, status });
    } else {
      stage(correlationId, '15', 'ride_transition', { rideId, driverId, from: before?.status ?? null, to: ride.status });
    }
    // Only emit after successful commit; idempotent hits still publish current authoritative state
    try {
      const { getIO } = require('../../core/socket/socket');
      const io = getIO();
      const riderRoom = `rider:${ride.rider_id}`;
      const driverRoom = `driver:${ride.driver_id}`;
      const payload = { rideId: ride.id, status: ride.status, ride };
      io.to(riderRoom).emit('ride:status_changed', payload);
      if (ride.driver_id) io.to(driverRoom).emit('ride:status_changed', payload);
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_EMIT ts=${new Date().toISOString()} rideId=${ride.id} status=${ride.status} event=ride:status_changed riderRoom=${riderRoom} driverRoom=${driverRoom} idempotent=${isIdempotent}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] RIDE_TRANSITION_EMIT ts=${new Date().toISOString()} rideId=${rideId} status=${status} event=ride:status_changed failed=${e.message}`);
    }
  }
  return ride;
};

const completeRide = async (rideId, driverId) => {
  const correlationId = currentCorrelationId();
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_REQUEST ts=${ts} rideId=${rideId} status=RIDE_COMPLETED driverId=${driverId} layer=service.completeRide`);
  const ride = await rideRepository.completeRide(rideId, driverId);
  // eslint-disable-next-line no-console
  console.log(`[RIDEWAY-DIAG] RIDE_COMPLETED_PERSISTED ts=${new Date().toISOString()} rideId=${rideId} status=${ride?.status ?? 'null'} layer=service.completeRide persisted=${!!ride}`);
  if (ride) {
    track(correlationId, { rideId });
    stage(correlationId, '15', 'ride_completed', { rideId, driverId });
    try {
      const { getIO } = require('../../core/socket/socket');
      const io = getIO();
      const riderRoom = `rider:${ride.rider_id}`;
      const payload = { rideId: ride.id, status: ride.status, ride };
      io.to(riderRoom).emit('ride:status_changed', payload);
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_EMIT ts=${new Date().toISOString()} rideId=${ride.id} status=${ride.status} event=ride:status_changed riderRoom=${riderRoom} layer=service.completeRide`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`[RIDEWAY-DIAG] RIDE_COMPLETION_EMIT ts=${new Date().toISOString()} rideId=${rideId} status=${ride.status} event=ride:status_changed failed=${e.message} layer=service.completeRide`);
    }
  }
  return ride;
};

const cancelRide = async (rideId, actorId, actorRole = 'driver') => {
  const correlationId = currentCorrelationId();
  const before = await rideRepository.getRide(rideId);
  const ride = await rideRepository.cancelRide(rideId, actorId, actorRole);
  if (ride) {
    track(correlationId, { rideId });
    const isIdempotent = before && before.status === 'CANCELLED';
    stage(correlationId, '15', isIdempotent ? 'ride_cancel_idempotent' : 'ride_cancelled', { rideId, actorId, from: before?.status ?? null });
    try {
      const { getIO } = require('../../core/socket/socket');
      const io = getIO();
      const payload = { rideId: ride.id, status: ride.status, ride };
      io.to(`rider:${ride.rider_id}`).emit('ride:status_changed', payload);
      if (ride.driver_id) io.to(`driver:${ride.driver_id}`).emit('ride:status_changed', payload);
    } catch {}
  }
  return ride;
};

const getRiderActiveRide = (riderId) => rideRepository.getRiderActiveRide(riderId);

const getDriverActiveRide = (driverId) => rideRepository.getDriverActiveRide(driverId);

const getRiderRideHistory = (riderId) => rideRepository.getRiderRideHistory(riderId);

module.exports = {
  createRideRequest: matchingService.createRideRequest,
  acceptRide: matchingService.acceptRide,
  getRide,
  updateRideStatus,
  completeRide,
  cancelRide,
  getRiderActiveRide,
  getDriverActiveRide,
  getRiderRideHistory,
};