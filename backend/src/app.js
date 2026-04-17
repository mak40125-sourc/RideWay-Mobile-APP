const express = require('express');
const cors = require('cors');
const allRoutes = require('./routes/index');

const app = express();

app.use(cors());
app.use(express.json());

// Prefix all API routes
app.use('/api/v1', allRoutes);

// Simple health check
app.get('/health', (req, res) => res.send('RideWay Backend is Online'));

module.exports = app;