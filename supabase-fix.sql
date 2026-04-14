-- IrrigBucket Supabase Schema Fix
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- Fix reports table: add missing columns and restore id auto-generation
ALTER TABLE reports ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE reports ADD COLUMN IF NOT EXISTS du_percent text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS du_status text;

-- Ensure user_id columns are text (Replit user IDs are not UUIDs)
ALTER TABLE reports ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE help_requests ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE feedback ALTER COLUMN user_id TYPE text USING user_id::text;

-- Confirm Row Level Security is disabled on all tables
-- (all access goes through the authenticated API server)
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE help_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
