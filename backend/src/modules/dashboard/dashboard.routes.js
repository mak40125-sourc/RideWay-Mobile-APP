const express = require('express')
const router = express.Router()
const controller = require('./dashboard.controller')

// Internal ops-dashboard guard. When DASHBOARD_API_KEY is set in the backend
// environment, every dashboard request must carry a matching `x-dashboard-key`
// header (sent by the dashboard from VITE_DASHBOARD_API_KEY). When the key is
// NOT configured the endpoints stay open — intended for local development only.
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY
if (!DASHBOARD_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[dashboard] DASHBOARD_API_KEY is not set — dashboard endpoints are unauthenticated (dev mode).')
}

function requireDashboardKey(req, res, next) {
  if (!DASHBOARD_API_KEY) return next()
  const key = req.headers['x-dashboard-key'] || req.query.key
  if (key !== DASHBOARD_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.use(requireDashboardKey)

router.get('/stats', controller.getStats)
router.get('/rides', controller.listRides)
router.get('/rides/:rideId', controller.getRide)
router.get('/drivers', controller.listDrivers)
router.get('/drivers/:driverId', controller.getDriver)
router.get('/drivers/:driverId/kyc', controller.getDriverKyc)
router.post('/drivers/:driverId/kyc/review', controller.reviewDriverKyc)

module.exports = router
