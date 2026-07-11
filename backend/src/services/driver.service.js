const { supabaseAdmin } = require('../config/supabase');

exports.findNearbyDrivers = async (lat, lng, radius) => {
  const { data, error } = await supabaseAdmin.rpc('get_nearby_drivers', {
    rider_lat: lat,
    rider_lon: lng,
    radius_meters: radius,
  });

  if (error) throw error;
  return data || [];
};

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
