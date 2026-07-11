CREATE OR REPLACE FUNCTION update_driver_location(
  p_user_id UUID,
  p_latitude FLOAT,
  p_longitude FLOAT
) RETURNS void AS $$
BEGIN
  UPDATE drivers
  SET location = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      last_pings_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
