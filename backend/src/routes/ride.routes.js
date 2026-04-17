const express = require('express');
const router = express.Router();
const rideController = require('../controllers/ride.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/request', protect, rideController.requestRide);
router.post('/:rideId/accept', protect, rideController.acceptRide);
router.get('/:rideId', protect, rideController.getRide);
router.post('/:rideId/complete', protect, rideController.completeRide);
router.post('/:rideId/cancel', protect, rideController.cancelRide);
router.get('/rider/:riderId/active', protect, rideController.getRiderActiveRide);

module.exports = router;