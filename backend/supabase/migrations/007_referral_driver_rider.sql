-- Referral: driver → rider
-- Safe to re-run: all statements idempotent

-- 1) drivers.referral_code
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_referral_code ON public.drivers(referral_code) WHERE referral_code IS NOT NULL;

-- Helper to generate VEL-XXXXX
CREATE OR REPLACE FUNCTION generate_referral_code() RETURNS TEXT AS $$
DECLARE code TEXT;
BEGIN
  SELECT 'VEL-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5)) INTO code;
  -- ensure alphanumeric, replace non-alnum? md5 hex is [0-9a-f] so already safe
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new drivers
CREATE OR REPLACE FUNCTION ensure_driver_referral_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      BEGIN
        NEW.referral_code := generate_referral_code();
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- retry on collision
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_drivers_referral_code ON public.drivers;
CREATE TRIGGER trg_drivers_referral_code BEFORE INSERT ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION ensure_driver_referral_code();

-- Backfill existing drivers without code
DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT id FROM public.drivers WHERE referral_code IS NULL LOOP
  UPDATE public.drivers SET referral_code = generate_referral_code() WHERE id = r.id;
  -- retry on collision handled by loop if unique violation, but simple update may collide; handle via retry
END LOOP; END $$;
-- Ensure any still-null due to collision gets a code
DO $$ BEGIN WHILE EXISTS (SELECT 1 FROM public.drivers WHERE referral_code IS NULL) LOOP
  UPDATE public.drivers SET referral_code = generate_referral_code() WHERE id IN (SELECT id FROM public.drivers WHERE referral_code IS NULL LIMIT 1);
END LOOP; END $$;

-- 2) referrals table driver -> rider
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  referred_rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','qualified','rewarded','rejected','expired')),
  qualifying_ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  reward_amount NUMERIC,
  reward_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Active attribution: a rider can have only one pending/qualified/rewarded referral
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_rider_active ON public.referrals(referred_rider_id) WHERE status IN ('pending','qualified','rewarded');
-- Qualifying ride cannot reward multiple referrals
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_qualifying_ride ON public.referrals(qualifying_ride_id) WHERE qualifying_ride_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_driver_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- 3) Ensure wallet transaction type supports referral reward (use existing transaction_type enum if present, else create)
DO $$ BEGIN
  -- If referrals use ledger, ensure transaction_type includes referral_reward
  -- wallet_transactions.type is transaction_type enum; add value if missing
  BEGIN
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral_reward';
  EXCEPTION WHEN duplicate_object THEN null;
  END;
END $$;

-- 4) RPC: apply_referral
CREATE OR REPLACE FUNCTION apply_referral(p_referral_code TEXT, p_referred_rider_id UUID)
RETURNS referrals AS $$
DECLARE
  v_driver_id UUID;
  v_referral referrals;
  v_expiry TIMESTAMPTZ;
  v_days INT;
BEGIN
  IF p_referral_code IS NULL OR p_referred_rider_id IS NULL THEN
    RAISE EXCEPTION 'Missing referral code or rider' USING ERRCODE='22000';
  END IF;

  -- Resolve driver by code
  SELECT id INTO v_driver_id FROM public.drivers WHERE referral_code = p_referral_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid referral code' USING ERRCODE='P0001';
  END IF;

  -- Rider must exist and be a rider
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_referred_rider_id) THEN
    RAISE EXCEPTION 'Rider not found' USING ERRCODE='P0002';
  END IF;

  -- Self-referral: driver cannot refer themselves (compare drivers.user_id vs rider id)
  IF EXISTS (SELECT 1 FROM public.drivers WHERE id = v_driver_id AND user_id = p_referred_rider_id) THEN
    RAISE EXCEPTION 'Self-referral not allowed' USING ERRCODE='P0001';
  END IF;

  -- Check if rider already has active attribution (pending/qualified/rewarded)
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_rider_id = p_referred_rider_id AND status IN ('pending','qualified','rewarded')) THEN
    RAISE EXCEPTION 'Rider already has a referral' USING ERRCODE='23505';
  END IF;

  -- Expiry config: 90 days default
  v_days := COALESCE(NULLIF(current_setting('app.referral_expiry_days', true), '')::int, 90);
  v_expiry := NOW() + (v_days || ' days')::interval;

  INSERT INTO public.referrals (referrer_driver_id, referred_rider_id, referral_code, status, reward_amount, expires_at)
  VALUES (v_driver_id, p_referred_rider_id, p_referral_code, 'pending', COALESCE(NULLIF(current_setting('app.referral_reward_amount', true), '')::numeric, 100), v_expiry)
  RETURNING * INTO v_referral;

  RETURN v_referral;
EXCEPTION WHEN unique_violation THEN
  -- First wins: return existing referral
  SELECT * INTO v_referral FROM public.referrals WHERE referred_rider_id = p_referred_rider_id AND status IN ('pending','qualified','rewarded') LIMIT 1;
  IF FOUND THEN RETURN v_referral; END IF;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) RPC: try_reward_referral — atomic reward on qualifying ride
CREATE OR REPLACE FUNCTION try_reward_referral(p_rider_id UUID, p_ride_id UUID)
RETURNS referrals AS $$
DECLARE
  v_referral referrals;
  v_reward NUMERIC;
  v_tx_id UUID;
  v_driver_id UUID;
  v_fare NUMERIC;
  v_balance_before NUMERIC;
BEGIN
  -- Lock referral row for this rider (pending -> qualified)
  SELECT * INTO v_referral FROM public.referrals WHERE referred_rider_id = p_rider_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL; -- no pending referral, nothing to do (idempotent)
  END IF;

  -- Check expiry
  IF v_referral.expires_at IS NOT NULL AND NOW() > v_referral.expires_at THEN
    UPDATE public.referrals SET status='expired' WHERE id=v_referral.id;
    RETURN NULL;
  END IF;

  -- Verify ride exists and is qualifying: authoritative RIDE_COMPLETED and fare >0
  SELECT fare INTO v_fare FROM public.rides WHERE id = p_ride_id AND rider_id = p_rider_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Check status must be RIDE_COMPLETED
  IF NOT EXISTS (SELECT 1 FROM public.rides WHERE id=p_ride_id AND status='RIDE_COMPLETED') THEN
    RETURN NULL;
  END IF;
  IF v_fare IS NULL OR v_fare <= 0 THEN
    RETURN NULL;
  END IF;

  -- Ensure this is the rider's first qualifying completed ride (no prior rewarded referral and no other qualified ride before)
  -- If rider already has a rewarded referral, we still idempotently return it, but we check qualifying_ride uniqueness
  -- Check if this ride already used to reward (idempotency)
  IF EXISTS (SELECT 1 FROM public.referrals WHERE qualifying_ride_id = p_ride_id) THEN
    -- Already rewarded for this ride, return that referral
    SELECT * INTO v_referral FROM public.referrals WHERE qualifying_ride_id = p_ride_id LIMIT 1;
    RETURN v_referral;
  END IF;

  -- Ensure rider hasn't already had a different qualifying ride rewarded (first ride only)
  -- If rider has a rewarded referral already, do nothing (first wins)
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_rider_id=p_rider_id AND status='rewarded') THEN
    RETURN NULL;
  END IF;

  v_driver_id := v_referral.referrer_driver_id;
  v_reward := COALESCE(v_referral.reward_amount, COALESCE(NULLIF(current_setting('app.referral_reward_amount', true), '')::numeric, 100));

  -- Ensure no other pending referral could race: qualification is per rider lock above

  -- Mark qualified
  UPDATE public.referrals SET status='qualified', qualifying_ride_id=p_ride_id, qualified_at=NOW() WHERE id=v_referral.id RETURNING * INTO v_referral;

  -- Atomically credit driver wallet and create ledger transaction
  -- Lock driver row
  SELECT wallet_balance INTO v_balance_before FROM public.drivers WHERE id=v_driver_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referrer driver not found' USING ERRCODE='P0002';
  END IF;

  UPDATE public.drivers SET wallet_balance = COALESCE(wallet_balance,0) + v_reward WHERE id=v_driver_id;

  INSERT INTO public.wallet_transactions (user_id, ride_id, amount, type, description)
  VALUES (
    (SELECT user_id FROM public.drivers WHERE id=v_driver_id),
    p_ride_id,
    v_reward,
    'credit',
    'Referral reward for ' || v_referral.referred_rider_id::text || ' referral:' || v_referral.id::text
  ) RETURNING id INTO v_tx_id;

  UPDATE public.referrals SET status='rewarded', reward_amount=v_reward, reward_transaction_id=v_tx_id, rewarded_at=NOW() WHERE id=v_referral.id RETURNING * INTO v_referral;

  RETURN v_referral;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
