const express = require('express');
const cors = require('cors');
const { driverRoutes } = require('./modules/driver');
const { rideRoutes } = require('./modules/ride');
const { walletRoutes } = require('./modules/wallet');
const { dashboardRoutes } = require('./modules/dashboard');
const { referralRoutes } = require('./modules/referral');
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
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/referrals', referralRoutes);

// Velos referral landing redirect: https://velos.app/r/:code -> deep link
app.get('/r/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  // Validate format to avoid open redirect
  if (!/^VEL-[A-Z0-9]{5}$/.test(code)) return res.status(404).send('Invalid referral code');
  const riderScheme = `ridewayrider://r/${code}`;
  const html = `<!doctype html><html><head><meta http-equiv="refresh" content="0; url=${riderScheme}"><title>Velos</title></head><body>Redirecting to Velos... <a href="${riderScheme}">Open app</a></body></html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Simple health check
app.get('/health', (req, res) => res.send('RideWay Backend is Online'));

module.exports = app;