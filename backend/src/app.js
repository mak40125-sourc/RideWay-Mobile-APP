const express = require('express');
const cors = require('cors');
const { driverRoutes } = require('./modules/driver');
const { rideRoutes } = require('./modules/ride');
const { walletRoutes } = require('./modules/wallet');

const app = express();

app.use(cors());
app.use(express.json());

// Prefix all API routes
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/wallet', walletRoutes);

// Simple health check
app.get('/health', (req, res) => res.send('RideWay Backend is Online'));

module.exports = app;