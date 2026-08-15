const express = require('express');
const cors = require('cors');
const { driverRoutes } = require('./modules/driver');
const { rideRoutes } = require('./modules/ride');
const { walletRoutes } = require('./modules/wallet');
const { correlationMiddleware } = require('./core/middleware/correlation.middleware');
const { stage } = require('./core/logger/logger');

const app = express();

app.use(cors());
app.use(express.json());
app.use(correlationMiddleware);

// Log HTTP request entry for every request with its correlation id.
app.use((req, res, next) => {
  stage(req.correlationId, '1', 'http_request_received', {
    method: req.method,
    path: req.originalUrl,
  });
  next();
});

// Prefix all API routes
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/wallet', walletRoutes);

// Simple health check
app.get('/health', (req, res) => res.send('RideWay Backend is Online'));

module.exports = app;