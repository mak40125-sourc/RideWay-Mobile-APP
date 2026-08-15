const { supabaseAdmin } = require('../../core/database/supabase');
const redisService = require('../../core/redis/redis.service');

// Driver persistence. The driver module's business logic (driver.service.js) and
// its controller never access storage directly — all Supabase / Redis
// persistence flows through this repository.

// ── Supabase: driver profile ──────────────────────────────────────
exports.getDriverByUserId = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('drivers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

exports.createDriver = async (userId, data) => {
  const { vehicle_type, vehicle_number, vehicle_model, vehicle_color } = data;

  const { data: driver, error } = await supabaseAdmin
    .from('drivers')
    .insert({
      id: userId,
      user_id: userId,
      vehicle_type,
      vehicle_number,
      vehicle_model: vehicle_model || null,
      vehicle_color: vehicle_color || null,
      kyc_status: 'verified',
      is_verified: true,
    })
    .select()
    .single();
  if (error) throw error;
  return driver;
};

// ── Supabase: profiles ────────────────────────────────────────────
exports.ensureProfile = async (userId, email) => {
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      name: email || 'Driver',
      role: 'driver',
    });
    if (error) throw error;
  }
};

// ── Supabase: driver documents ────────────────────────────────────
exports.insertDocument = async (driverId, documentType, documentUrl) => {
  const { data, error } = await supabaseAdmin
    .from('driver_documents')
    .insert({
      driver_id: driverId,
      document_type: documentType,
      document_url: documentUrl,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Supabase: storage ─────────────────────────────────────────────
exports.uploadToStorage = async (fileBuffer, fileName, contentType) => {
  const { data, error } = await supabaseAdmin.storage
    .from('kyc-documents')
    .upload(fileName, fileBuffer, {
      contentType,
      upsert: true,
    });
  if (error) throw error;

  const { data: urlData } = supabaseAdmin.storage
    .from('kyc-documents')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
};

// ── Redis: driver availability / location / status ────────────────
exports.setDriverLocation = (driverId, latitude, longitude) =>
  redisService.setDriverLocation(driverId, latitude, longitude);

exports.setDriverOnline = (driverId, data) => redisService.setDriverOnline(driverId, data);

exports.setDriverOffline = (driverId) => redisService.setDriverOffline(driverId);

// Repairs the split between Redis availability state: a driver is added to
// `drivers:online` (GEO) by every location update, but its eligibility metadata
// (`rideType`) lives in the `driver:<id>` hash written only by the online
// toggle. If the hash (or its `rideType`) is missing — e.g. the online call
// raced with or failed before the first location update — the driver would be
// silently dropped by the matcher's vehicle_type filter despite being online
// and nearby. Restore the authoritative metadata from the drivers table.
exports.ensureDriverHashMetadata = async (userId) => {
  const { logger } = require('../../core/logger/logger');
  const hash = await redisService.getDriver(userId);
  if (hash && hash.rideType) return hash;

  // Non-UUID members (e.g. stale/orphaned GEO entries) are not real driver ids
  // and cannot be looked up in the drivers table; never treat them as eligible.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId))) {
    return hash || null;
  }

  try {
    const driver = await exports.getDriverByUserId(userId);
    if (!driver || !driver.vehicle_type) return hash || null;

    await redisService.setDriverOnline(userId, {
      rideType: driver.vehicle_type,
      vehicleNumber: driver.vehicle_number || '',
    });
    logger.warn({
      type: 'driver',
      event: 'driver_hash_metadata_restored',
      driverId: userId,
      rideType: driver.vehicle_type,
      previousState: hash || null,
    });
    return redisService.getDriver(userId);
  } catch (err) {
    logger.warn({
      type: 'driver',
      event: 'driver_hash_metadata_lookup_failed',
      driverId: userId,
      error: err.message,
    });
    return hash || null;
  }
};

exports.getNearbyDrivers = (latitude, longitude, radiusMeters) =>
  redisService.getNearbyDrivers(latitude, longitude, radiusMeters);
