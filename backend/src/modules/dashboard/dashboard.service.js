const dashboardRepository = require('./dashboard.repository')

const getStats = () => dashboardRepository.getStats()
const listRides = (params) => dashboardRepository.listRides(params)
const getRide = (rideId) => dashboardRepository.getRide(rideId)
const listDrivers = (params) => dashboardRepository.listDrivers(params)
const getDriver = (driverId) => dashboardRepository.getDriver(driverId)
const getDriverKyc = (driverId) => dashboardRepository.getDriverKyc(driverId)
const reviewDriverKyc = (driverId, payload) => dashboardRepository.reviewDriverKyc(driverId, payload)

module.exports = {
  getStats,
  listRides,
  getRide,
  listDrivers,
  getDriver,
  getDriverKyc,
  reviewDriverKyc,
}
