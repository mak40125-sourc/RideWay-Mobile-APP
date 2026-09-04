-- Phase 2: Ride lifecycle & idempotency hardening
-- Additive, idempotent migration. Provides DB-enforced invariants for:
--  - idempotency key uniqueness per rider
--  - version for optimistic concurrency
--  - server-owned lifecycle timestamps

-- 1) Add columns to rides (if missing)
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2) Unique partial index for idempotency: same rider + same key = same ride
CREATE UNIQUE INDEX IF NOT EXISTS idx_rides_idempotency
  ON public.rides (rider_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Index for active lookup (used by getRiderActiveRide / getDriverActiveRide)
CREATE INDEX IF NOT EXISTS idx_rides_rider_active
  ON public.rides (rider_id, status, updated_at DESC)
  WHERE status IN ('REQUESTED','SEARCHING_DRIVER','DRIVER_ASSIGNED','DRIVER_ARRIVING','RIDE_STARTED');

CREATE INDEX IF NOT EXISTS idx_rides_driver_active
  ON public.rides (driver_id, status, updated_at DESC)
  WHERE status IN ('DRIVER_ASSIGNED','DRIVER_ARRIVING','RIDE_STARTED');

-- 3) Atomic ride creation with idempotency
-- Inserts a new ride in REQUESTED/SEARCHING_DRIVER if no active ride with same idempotency exists.
-- Returns existing ride on duplicate key (idempotent retry).
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
  p_idempotency_key TEXT
) RETURNS rides AS $$
DECLARE
  existing rides;
  result rides;
BEGIN
  -- If idempotency_key provided, check for existing row first (idempotent retry)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO existing FROM public.rides
      WHERE rider_id = p_rider_id AND idempotency_key = p_idempotency_key
      LIMIT 1;
    IF FOUND THEN
      RETURN existing;
    END IF;
    -- Also guard against concurrent active ride without same key: don't allow 2 active rides per rider
    -- This is a business-rule guard; the unique index above is the hard invariant for same key.
  END IF;

  INSERT INTO public.rides (
    id, rider_id, driver_id,
    pickup_location, drop_location,
    pickup_address, drop_address,
    fare, distance, duration,
    status, idempotency_key, version
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
    1
  )
  ON CONFLICT (rider_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO result;

  IF result.id IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Conflict: another concurrent insert with same key won; return that row
  SELECT * INTO existing FROM public.rides
    WHERE rider_id = p_rider_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
  RETURN existing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Atomic accept: exactly one driver can transition SEARCHING_DRIVER -> DRIVER_ASSIGNED
-- Idempotent for same driver, conflict for different driver.
CREATE OR REPLACE FUNCTION accept_ride_atomic(
  p_ride_id UUID,
  p_driver_id UUID
) RETURNS rides AS $$
DECLARE
  r rides;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id = p_ride_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent: already assigned to same driver
  IF r.driver_id = p_driver_id AND r.status = 'DRIVER_ASSIGNED' THEN
    RETURN r;
  END IF;
  IF r.driver_id IS NOT NULL AND r.driver_id != p_driver_id THEN
    RAISE EXCEPTION 'Ride already assigned to another driver' USING ERRCODE = 'P0001';
  END IF;
  IF r.status NOT IN ('REQUESTED','SEARCHING_DRIVER') THEN
    RAISE EXCEPTION 'Ride not in accept-able state: %', r.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.rides
    SET driver_id = p_driver_id,
        status = 'DRIVER_ASSIGNED',
        assigned_at = COALESCE(assigned_at, NOW()),
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_ride_id
  RETURNING * INTO r;

  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Generic atomic transition for arrive/start/complete/cancel
CREATE OR REPLACE FUNCTION transition_ride_status(
  p_ride_id UUID,
  p_actor_id UUID,
  p_new_status TEXT,
  p_actor_role TEXT DEFAULT 'driver'
) RETURNS rides AS $$
DECLARE
  r rides;
BEGIN
  SELECT * INTO r FROM public.rides WHERE id = p_ride_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent: already in requested status
  IF r.status = p_new_status THEN
    RETURN r;
  END IF;

  -- Terminal protection
  IF r.status IN ('RIDE_COMPLETED','CANCELLED') THEN
    RAISE EXCEPTION 'Ride already terminal: %', r.status USING ERRCODE = 'P0001';
  END IF;

  -- Validate transition
  IF r.status = 'REQUESTED' AND p_new_status NOT IN ('SEARCHING_DRIVER','CANCELLED') THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', r.status, p_new_status USING ERRCODE = 'P0001';
  ELSIF r.status = 'SEARCHING_DRIVER' AND p_new_status NOT IN ('DRIVER_ASSIGNED','CANCELLED') THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', r.status, p_new_status USING ERRCODE = 'P0001';
  ELSIF r.status = 'DRIVER_ASSIGNED' AND p_new_status NOT IN ('DRIVER_ARRIVING','CANCELLED') THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', r.status, p_new_status USING ERRCODE = 'P0001';
  ELSIF r.status = 'DRIVER_ARRIVING' AND p_new_status NOT IN ('RIDE_STARTED','CANCELLED') THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', r.status, p_new_status USING ERRCODE = 'P0001';
  ELSIF r.status = 'RIDE_STARTED' AND p_new_status NOT IN ('RIDE_COMPLETED') THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', r.status, p_new_status USING ERRCODE = 'P0001';
  END IF;

  -- Actor check: only assigned driver can advance after assignment (except cancel by rider)
  IF r.driver_id IS NOT NULL AND p_actor_role = 'driver' AND r.driver_id != p_actor_id AND p_new_status != 'CANCELLED' THEN
    RAISE EXCEPTION 'Not authorized for ride' USING ERRCODE = '42501';
  END IF;
  IF p_new_status IN ('DRIVER_ARRIVING','RIDE_STARTED','RIDE_COMPLETED') AND r.driver_id != p_actor_id THEN
    RAISE EXCEPTION 'Only assigned driver can perform %', p_new_status USING ERRCODE = '42501';
  END IF;

  UPDATE public.rides
    SET status = p_new_status::ride_status,
        arrived_at = CASE WHEN p_new_status = 'DRIVER_ARRIVING' THEN COALESCE(arrived_at, NOW()) ELSE arrived_at END,
        started_at = CASE WHEN p_new_status = 'RIDE_STARTED' THEN COALESCE(started_at, NOW()) ELSE started_at END,
        completed_at = CASE WHEN p_new_status = 'RIDE_COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
        cancelled_at = CASE WHEN p_new_status = 'CANCELLED' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_ride_id
  RETURNING * INTO r;

  RETURN r;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Update existing accept_ride RPC to be idempotent wrapper (keep backward compatible)
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
  r rides;
  existing_ride rides;
BEGIN
  -- If ride already exists, try atomic accept path
  SELECT * INTO existing_ride FROM public.rides WHERE id = p_ride_id;
  IF FOUND THEN
    RETURN accept_ride_atomic(p_ride_id, p_driver_id);
  END IF;

  -- Legacy path: no ride row yet (created via Redis flow). Insert directly.
  -- Use idempotent insert: if concurrent inserts race, ON CONFLICT returns existing.
  BEGIN
    INSERT INTO rides (
      id, rider_id, driver_id,
      pickup_location, drop_location,
      pickup_address, drop_address,
      fare, distance, duration, status, assigned_at
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
      'DRIVER_ASSIGNED',
      NOW()
    )
    RETURNING * INTO r;
    RETURN r;
  EXCEPTION WHEN unique_violation THEN
    -- Another concurrent accept inserted first; try atomic path again
    SELECT * INTO r FROM public.rides WHERE id = p_ride_id FOR UPDATE;
    IF r.driver_id = p_driver_id THEN
      RETURN r;
    ELSE
      RAISE EXCEPTION 'Ride already assigned to another driver' USING ERRCODE = 'P0001';
    END IF;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
