-- SECURITY DEFINER function to upsert profiles, bypassing RLS
-- This is called from the app via supabase.rpc('upsert_profile', ...)

CREATE OR REPLACE FUNCTION upsert_profile(
  user_id UUID,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'rider',
  avatar_url TEXT DEFAULT NULL
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result profiles;
BEGIN
  -- Security check: only allow users to modify their own profile
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO profiles (id, full_name, phone, role, avatar_url)
  VALUES (user_id, full_name, phone, role, avatar_url)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url)
  RETURNING * INTO result;

  RETURN result;
END;
$$;
