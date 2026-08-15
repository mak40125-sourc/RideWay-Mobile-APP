-- 005: Add missing ride measurement columns to public.rides
--
-- Root cause
-- ----------
-- The canonical rides table (backend/supabase_schema.sql) defines:
--     fare     NUMERIC,
--     distance NUMERIC,
--     duration NUMERIC
-- and the installed accept_ride function (migration 004) INSERTs into
-- rides (..., fare, distance, duration, ...). Both the API contract and the
-- installed function depend on these three columns.
--
-- The live database's rides table is missing exactly:
--     fare, distance, duration
-- (verified against the live instance: all other rides columns exist).
-- Consequently accept_ride raises:
--     PostgreSQL error 42703 — column "fare" of relation "rides" does not exist
-- which surfaces through the API as HTTP 400
--     {"error":"Failed to persist ride acceptance."}
--
-- This migration restores the rides table to the canonical schema by adding
-- the three missing columns. It is additive and idempotent. It does NOT alter
-- the accept_ride function, which already matches the canonical contract.
--
-- Rollback
-- --------
--     ALTER TABLE public.rides DROP COLUMN IF EXISTS fare,
--                            DROP COLUMN IF EXISTS distance,
--                            DROP COLUMN IF EXISTS duration;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS fare NUMERIC,
  ADD COLUMN IF NOT EXISTS distance NUMERIC,
  ADD COLUMN IF NOT EXISTS duration NUMERIC;
