const driverRepository = require('./driver.repository');

// Canonical eligibility types — must stay in sync with registration validation
// (driver.controller.js) and rider ride options.
const VALID_VEHICLE_TYPES = ['bike', 'mini', 'sedan', 'shuttle'];

exports.getDriverByUserId = (userId) => driverRepository.getDriverByUserId(userId);

exports.ensureProfile = (userId, email) => driverRepository.ensureProfile(userId, email);

exports.createDriver = (userId, data) => driverRepository.createDriver(userId, data);

exports.insertDocument = (driverId, documentType, documentUrl) =>
  driverRepository.insertDocument(driverId, documentType, documentUrl);

exports.uploadToStorage = (fileBuffer, fileName, contentType) =>
  driverRepository.uploadToStorage(fileBuffer, fileName, contentType);

exports.updateLocation = async (userId, location) => {
  // Metadata repair runs BEFORE the GEOADD: a driver becomes discoverable in
  // `drivers:online` only once its availability hash exists (or is known to be
  // unrestorable). This closes the split-brain window at the source — matching
  // can never see a GEO member whose hash was never written.
  await driverRepository.ensureDriverHashMetadata(userId);
  await driverRepository.setDriverLocation(userId, location.latitude, location.longitude);
};

exports.setOnline = async (userId, { isOnline }) => {
  if (!isOnline) {
    await driverRepository.setDriverOffline(userId);
    return;
  }

  // The Supabase drivers row is the authoritative eligibility record. Values
  // supplied by the client (rideType/vehicleNumber) are deliberately ignored:
  // a stale, missing, or tampered payload must not be able to register
  // availability metadata that differs from the verified profile.
  const profile = await driverRepository.getDriverByUserId(userId);
  if (!profile || !VALID_VEHICLE_TYPES.includes(profile.vehicle_type)) {
    const error = new Error(
      'Verified driver profile with a valid vehicle_type is required to go online'
    );
    error.statusCode = 400;
    throw error;
  }

  await driverRepository.setDriverOnline(userId, {
    rideType: profile.vehicle_type,
    vehicleNumber: profile.vehicle_number || '',
  });
};

exports.getNearbyDrivers = (lat, lng, radius) =>
  driverRepository.getNearbyDrivers(parseFloat(lat), parseFloat(lng), parseFloat(radius));