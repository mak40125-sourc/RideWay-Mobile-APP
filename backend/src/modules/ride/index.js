const rideRoutes = require('./ride.routes');
const rideController = require('./ride.controller');
const rideService = require('./ride.service');
const rideRepository = require('./ride.repository');

module.exports = {
  rideRoutes,
  rideController,
  rideService,
  rideRepository,
};