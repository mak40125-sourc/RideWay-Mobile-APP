-- Pricing authority: snapshot authoritative fare on the ride row.
-- Additive, idempotent. Existing fares are preserved; new rides store the
-- backend-computed breakdown + pricing version.

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS fare_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS pricing_version TEXT;

-- Extend create_ride_idempotent to persist the authoritative snapshot.
-- Keeps the same idempotency semantics; extra params default to NULL.
CREATE OR REPLACE FUNCTION create_ride_idempotent(
  p_ride_id UUID,
  p_rider_id UUID,
  p_pickup_lat FLOAT,
  p_pickup_lng FLOAT,
  p_drop_lat FLOAT,
  p_drop_lng FLOAT,
  p_pickup_address TEXT,
  p_drop_address TEXT,
  p_fare NUMERIC,
  p_distance NUMERIC,
  p_duration NUMERIC,
  p_idempotency_key TEXT,
  p_fare_breakdown JSONB DEFAULT NULL,
  p_pricing_version TEXT DEFAULT NULL
) RETURNS rides AS $$
DECLARE
  existing rides;
  result rides;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO existing FROM public.rides
      WHERE rider_id = p_rider_id AND idempotency_key = p_idempotency_key
      LIMIT 1;
    IF FOUND THEN
      RETURN existing;
    END IF;
  END IF;

  INSERT INTO public.rides (
    id, rider_id, driver_id,
    pickup_location, drop_location,
    pickup_address, drop_address,
    fare, distance, duration,
    status, idempotency_key, version,
    fare_breakdown, pricing_version
  ) VALUES (
    p_ride_id,
    p_rider_id,
    NULL,
    ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(p_drop_lng, p_drop_lat), 4326)::geography,
    p_pickup_address,
    p_drop_address,
    p_fare,
    p_distance,
    p_duration,
    'SEARCHING_DRIVER',
    p_idempotency_key,
    1,
    p_fare_breakdown,
    p_pricing_version
  )
  ON CONFLICT (rider_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO result;

  IF result.id IS NOT NULL THEN
    RETURN result;
  END IF;

  SELECT * INTO existing FROM public.rides
    WHERE rider_id = p_rider_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
  RETURN existing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
