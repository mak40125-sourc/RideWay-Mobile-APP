const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driver.controller');
const { protect } = require('../middleware/auth.middleware');

// All driver routes should be protected
router.put('/location', protect, driverController.updateLocation);
router.put('/online', protect, driverController.setOnline);
router.put('/offline', protect, driverController.setOnline);
router.get('/nearby', protect, driverController.getNearbyDrivers);

module.exports = router;
