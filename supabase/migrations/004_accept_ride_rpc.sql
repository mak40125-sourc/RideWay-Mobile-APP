-- Create the accept_ride RPC for the Redis-first matching pipeline.
-- This is only called when a driver accepts a ride (writes to DB on acceptance only).
-- The ride matching pipeline stores requests in Redis until a driver accepts.

CREATE OR REPLACE FUNCTION accept_ride(
  p_ride_id UUID,
  p_rider_id UUID,
  p_driver_id UUID,
  p_pickup_lat FLOAT,
  p_pickup_lng FLOAT,
  p_drop_lat FLOAT,
  p_drop_lng FLOAT,
  p_fare NUMERIC,
  p_distance NUMERIC,
  p_duration NUMERIC,
  p_pickup_address TEXT DEFAULT '',
  p_drop_address TEXT DEFAULT ''
) RETURNS rides AS $$
DECLARE
  result rides;
BEGIN
  INSERT INTO rides (
    id, rider_id, driver_id,
    pickup_location, drop_location,
    pickup_address, drop_address,
    fare, distance, duration, status
  ) VALUES (
    p_ride_id,
    p_rider_id,
    p_driver_id,
    ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(p_drop_lng, p_drop_lat), 4326)::geography,
    p_pickup_address,
    p_drop_address,
    p_fare,
    p_distance,
    p_duration,
    'DRIVER_ASSIGNED'
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
