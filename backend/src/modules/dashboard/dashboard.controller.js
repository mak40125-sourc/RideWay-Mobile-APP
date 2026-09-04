const dashboardService = require('./dashboard.service')

exports.getStats = async (req, res) => {
  try {
    const stats = await dashboardService.getStats()
    res.status(200).json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.listRides = async (req, res) => {
  try {
    const { search, status, from, to, page, pageSize } = req.query
    const result = await dashboardService.listRides({
      search: search || '',
      status: status || 'ALL',
      from: from || null,
      to: to || null,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 25,
    })
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.getRide = async (req, res) => {
  try {
    const { rideId } = req.params
    const ride = await dashboardService.getRide(rideId)
    if (!ride) return res.status(404).json({ error: 'Ride not found' })
    res.status(200).json(ride)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.listDrivers = async (req, res) => {
  try {
    const { status, kycStatus, search, page, pageSize } = req.query
    const result = await dashboardService.listDrivers({
      status: status || 'all',
      kycStatus: kycStatus || 'all',
      search: search || '',
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 25,
    })
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.getDriver = async (req, res) => {
  try {
    const { driverId } = req.params
    const driver = await dashboardService.getDriver(driverId)
    if (!driver) return res.status(404).json({ error: 'Driver not found' })
    res.status(200).json(driver)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.getDriverKyc = async (req, res) => {
  try {
    const { driverId } = req.params
    const kyc = await dashboardService.getDriverKyc(driverId)
    if (!kyc) return res.status(404).json({ error: 'Driver not found' })
    res.status(200).json(kyc)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.reviewDriverKyc = async (req, res) => {
  try {
    const { driverId } = req.params
    const { action, reason, reviewer } = req.body || {}
    const result = await dashboardService.reviewDriverKyc(driverId, { action, reason, reviewer })
    res.status(200).json(result)
  } catch (error) {
    const status = error.status || 500
    res.status(status).json({ error: error.message })
  }
}
