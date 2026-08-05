const driverService = require('./driver.service');

// Phase 2A: thin adapter that temporarily delegates to the existing service.
// Phase 2B migrates persistence into this repository and inverts the dependency.

exports.getDriverByUserId = (userId) => driverService.getDriverByUserId(userId);

exports.ensureProfile = (userId, email) => driverService.ensureProfile(userId, email);

exports.createDriver = (userId, data) => driverService.createDriver(userId, data);

exports.insertDocument = (driverId, documentType, documentUrl) =>
  driverService.insertDocument(driverId, documentType, documentUrl);

exports.uploadToStorage = (fileBuffer, fileName, contentType) =>
  driverService.uploadToStorage(fileBuffer, fileName, contentType);
