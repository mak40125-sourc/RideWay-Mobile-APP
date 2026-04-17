-- 1. Enable PostGIS extension for location-based queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Define Custom Types for Data Integrity
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('rider', 'driver', 'admin');
    CREATE TYPE vehicle_type AS ENUM ('bike', 'mini', 'sedan', 'shuttle');
    CREATE TYPE ride_status AS ENUM ('IDLE', 'REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'RIDE_STARTED', 'RIDE_COMPLETED', 'CANCELLED');
    CREATE TYPE transaction_type AS ENUM ('credit', 'debit');
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
    CREATE TYPE kyc_status AS ENUM ('pending', 'in_review', 'verified', 'rejected');
    CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Utility Function for Updated At
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Profiles Table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE,
  role user_role DEFAULT 'rider',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  vehicle_type vehicle_type NOT NULL,
  vehicle_number TEXT NOT NULL,
  is_online BOOLEAN DEFAULT false,
  kyc_status kyc_status DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT false,
  wallet_balance NUMERIC DEFAULT 0,
  location GEOGRAPHY(POINT, 4326),
  last_pings_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a spatial index for fast "nearby" searches
CREATE INDEX IF NOT EXISTS idx_drivers_location ON public.drivers USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON public.drivers (is_online) WHERE is_online = true;

-- 5.1 Driver Documents Table
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'license', 'rc', 'id_proof', 'insurance'
  document_url TEXT NOT NULL,
  status document_status DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Rides Table
-- Note: We use geography for pickup/drop for precise distance calculations
-- and simple TEXT for human-readable addresses.
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES public.profiles(id),
  driver_id UUID REFERENCES public.drivers(id), -- Nullable until accepted
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  drop_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_address TEXT,
  drop_address TEXT,
  fare NUMERIC,
  distance NUMERIC, -- in km
  duration NUMERIC, -- in minutes
  status ride_status DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Wallet & Payments (The Financial Core)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  ride_id UUID REFERENCES public.rides(id),
  amount NUMERIC NOT NULL,
  type transaction_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID REFERENCES public.rides(id) UNIQUE,
  amount NUMERIC NOT NULL,
  status payment_status DEFAULT 'pending',
  method TEXT, -- 'wallet', 'card', 'cash'
  transaction_id TEXT, -- external provider ID (Stripe/Razorpay)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Ratings (The Feedback Loop)
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID REFERENCES public.rides(id) UNIQUE,
  rider_id UUID REFERENCES public.profiles(id),
  driver_id UUID REFERENCES public.drivers(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Automation: Auto-sync Supabase Auth to Public Profiles
-- This ensures that when a user signs up via Supabase Auth, a profile is ready.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'), 
    NEW.phone, 
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'rider')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 9. Automation: Updated At Triggers
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER update_drivers_modtime BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER update_driver_docs_modtime BEFORE UPDATE ON public.driver_documents FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER update_rides_modtime BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- 10. Helper Function: Industrial Grade Driver Discovery
-- Returns the driver details and the calculated distance in meters
CREATE OR REPLACE FUNCTION get_nearby_drivers(
  rider_lat FLOAT, 
  rider_lon FLOAT, 
  radius_meters FLOAT DEFAULT 5000,
  vehicle_type_filter vehicle_type DEFAULT NULL
)
RETURNS TABLE (
  driver_id UUID,
  user_id UUID,
  vehicle_type vehicle_type,
  vehicle_number TEXT,
  distance_meters FLOAT,
  current_location GEOGRAPHY
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id, 
    d.user_id, 
    d.vehicle_type, 
    d.vehicle_number,
    ST_Distance(
      d.location, 
      ST_SetSRID(ST_MakePoint(rider_lon, rider_lat), 4326)::geography
    ) as distance_meters,
    d.location
  FROM public.drivers d
  WHERE is_online = true
    AND (vehicle_type_filter IS NULL OR vehicle_type = vehicle_type_filter)
    AND ST_DWithin(
      location, 
      ST_SetSRID(ST_MakePoint(rider_lon, rider_lat), 4326)::geography, 
      radius_meters
    ) 
  ORDER BY distance_meters ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- 11. Security: Enable RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
-- Example Policy: Users can only see their own rides
CREATE POLICY "Riders can view own rides" ON public.rides FOR SELECT USING (auth.uid() = rider_id);
