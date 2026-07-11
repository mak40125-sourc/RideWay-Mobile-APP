const { supabaseAdmin } = require('../config/supabase');
const redisClient = require('../config/redis');
const driverService = require('../services/driver.service');

exports.updateLocation = async (req, res) => {
  try {
    const { location } = req.body;
    const userId = req.user.id;

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return res.status(400).json({ error: 'Valid location (latitude, longitude) is required' });
    }

    const { error } = await supabaseAdmin.rpc('update_driver_location', {
      p_user_id: userId,
      p_latitude: location.latitude,
      p_longitude: location.longitude,
    });

    if (error) throw error;

    await redisClient.set(`driver:location:${userId}`, JSON.stringify(location), 'EX', 60);

    res.status(200).json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setOnline = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('drivers')
      .update({ is_online: isOnline, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw error;

    await redisClient.set(`driver:online:${userId}`, isOnline ? '1' : '0');

    res.status(200).json({ message: `Driver is now ${isOnline ? 'online' : 'offline'}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, radius = 3000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng query parameters are required' });
    }

    const drivers = await driverService.findNearbyDrivers(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius)
    );

    res.status(200).json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const driver = await driverService.getDriverByUserId(userId);

    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    res.status(200).json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vehicle_type, vehicle_number, vehicle_model, vehicle_color, documents } = req.body;

    if (!vehicle_type || !vehicle_number) {
      return res.status(400).json({ error: 'vehicle_type and vehicle_number are required' });
    }

    const validTypes = ['bike', 'mini', 'sedan', 'shuttle'];
    if (!validTypes.includes(vehicle_type)) {
      return res.status(400).json({ error: `vehicle_type must be one of: ${validTypes.join(', ')}` });
    }

    const existing = await driverService.getDriverByUserId(userId);
    if (existing) {
      return res.status(409).json({ error: 'Driver profile already exists' });
    }

    const driver = await driverService.createDriver(userId, {
      vehicle_type,
      vehicle_number,
      vehicle_model,
      vehicle_color,
    });

    if (documents && Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        await driverService.insertDocument(driver.id, doc.document_type, doc.document_url);
      }
    }

    res.status(201).json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.uploadDoc = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { document_type } = req.body;
    if (!document_type) {
      return res.status(400).json({ error: 'document_type is required' });
    }

    const userId = req.user.id;
    const fileName = `${userId}/${document_type}.jpg`;

    const documentUrl = await driverService.uploadToStorage(
      req.file.buffer,
      fileName,
      req.file.mimetype
    );

    res.status(200).json({ document_url: documentUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
