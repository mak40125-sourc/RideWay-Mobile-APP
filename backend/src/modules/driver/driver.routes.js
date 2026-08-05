const express = require('express');
const router = express.Router();
const driverController = require('./driver.controller');
const { protect } = require('../../core/middleware/auth.middleware');
const upload = require('../../core/middleware/upload.middleware');

// All driver routes should be protected
router.get('/me', protect, driverController.getMyProfile);
router.post('/register', protect, driverController.register);
router.post('/upload-document', protect, upload.single('document'), driverController.uploadDoc);
router.put('/location', protect, driverController.updateLocation);
router.put('/online', protect, driverController.setOnline);
router.put('/offline', protect, driverController.setOnline);
router.get('/nearby', protect, driverController.getNearbyDrivers);

module.exports = router;
