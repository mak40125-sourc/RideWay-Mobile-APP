const express = require('express');
const router = express.Router();
const rideController = require('./ride.controller');
const { protect } = require('../../core/middleware/auth.middleware');

router.get('/rider/active', protect, rideController.getMyActiveRide);
router.get('/driver/active', protect, rideController.getDriverActiveRide);
router.post('/estimate', protect, rideController.estimateFare);
router.post('/request', protect, rideController.requestRide);
router.post('/:rideId/accept', protect, rideController.acceptRide);
router.post('/:rideId/reject', protect, rideController.rejectRide);
router.put('/:rideId/status', protect, rideController.updateRideStatus);
router.get('/:rideId', protect, rideController.getRide);
router.post('/:rideId/complete', protect, rideController.completeRide);
router.post('/:rideId/cancel', protect, rideController.cancelRide);
router.get('/rider/:riderId/active', protect, rideController.getRiderActiveRide);
router.get('/rider/:riderId/history', protect, rideController.getRiderRideHistory);

module.exports = router;
