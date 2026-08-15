const rideRepository = require('./ride.repository');
const { matchingService } = require('../matching');
const { stage, track, currentCorrelationId } = require('../../core/logger/logger');

// Ride lifecycle service. Ride-request matching and driver acceptance
// orchestration live in the matching module (matchingService); this service
// keeps ride lifecycle persistence (status, completion, cancellation, history).
const getRide = (rideId) => rideRepository.getRide(rideId);

const updateRideStatus = (rideId, driverId, status) =>
  rideRepository.updateStatus(rideId, driverId, status);

const completeRide = async (rideId, driverId) => {
  const correlationId = currentCorrelationId();
  const ride = await rideRepository.completeRide(rideId, driverId);
  if (ride) {
    track(correlationId, { rideId });
    stage(correlationId, '15', 'ride_completed', { rideId, driverId });
  }
  return ride;
};

const cancelRide = async (rideId, driverId) => {
  const correlationId = currentCorrelationId();
  const ride = await rideRepository.cancelRide(rideId, driverId);
  if (ride) {
    track(correlationId, { rideId });
    stage(correlationId, '15', 'ride_cancelled', { rideId, driverId });
  }
  return ride;
};

const getRiderActiveRide = (riderId) => rideRepository.getRiderActiveRide(riderId);

const getRiderRideHistory = (riderId) => rideRepository.getRiderRideHistory(riderId);

module.exports = {
  createRideRequest: matchingService.createRideRequest,
  acceptRide: matchingService.acceptRide,
  getRide,
  updateRideStatus,
  completeRide,
  cancelRide,
  getRiderActiveRide,
  getRiderRideHistory,
};