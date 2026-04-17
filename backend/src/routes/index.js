const express = require('express');
const router = express.Router();

const driverRoutes = require('./driver.routes');
const rideRoutes = require('./ride.routes');
const walletRoutes = require('./wallet.routes');

router.use('/drivers', driverRoutes);
router.use('/rides', rideRoutes);
router.use('/wallet', walletRoutes);

module.exports = router;
