const driverRepository = require('./driver.repository');

exports.getDriverByUserId = (userId) => driverRepository.getDriverByUserId(userId);

exports.ensureProfile = (userId, email) => driverRepository.ensureProfile(userId, email);

exports.createDriver = (userId, data) => driverRepository.createDriver(userId, data);

exports.insertDocument = (driverId, documentType, documentUrl) =>
  driverRepository.insertDocument(driverId, documentType, documentUrl);

exports.uploadToStorage = (fileBuffer, fileName, contentType) =>
  driverRepository.uploadToStorage(fileBuffer, fileName, contentType);

exports.updateLocation = async (userId, location) => {
  await driverRepository.setDriverLocation(userId, location.latitude, location.longitude);
  await driverRepository.ensureDriverHashMetadata(userId);
};

exports.setOnline = async (userId, { isOnline, rideType, vehicleNumber }) => {
  if (isOnline) {
    await driverRepository.setDriverOnline(userId, { rideType, vehicleNumber });
  } else {
    await driverRepository.setDriverOffline(userId);
  }
};

exports.getNearbyDrivers = (lat, lng, radius) =>
  driverRepository.getNearbyDrivers(parseFloat(lat), parseFloat(lng), parseFloat(radius));