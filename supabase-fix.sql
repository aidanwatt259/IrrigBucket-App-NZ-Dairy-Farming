-- IrrigBucket Supabase Schema Fix (Final)
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- Drop RLS policies that block server-side writes
DROP POLICY IF EXISTS "Users can view their own reports." ON reports;
DROP POLICY IF EXISTS "Users can insert their own reports." ON reports;
DROP POLICY IF EXISTS "Users can update their own reports." ON reports;
DROP POLICY IF EXISTS "Users can delete their own reports." ON reports;
DROP POLICY IF EXISTS "Users can view their own help_requests." ON help_requests;
DROP POLICY IF EXISTS "Users can insert their own help_requests." ON help_requests;
DROP POLICY IF EXISTS "Users can view their own feedback." ON feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback." ON feedback;

-- Drop any foreign key constraints linking user_id to auth.users
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_user_id_fkey;
ALTER TABLE help_requests DROP CONSTRAINT IF EXISTS help_requests_user_id_fkey;
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;

-- Make user_id nullable and change type to text (Replit user IDs are plain strings)
ALTER TABLE reports ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE reports ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE help_requests ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE help_requests ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE feedback ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE feedback ALTER COLUMN user_id TYPE text USING user_id::text;

-- Fix reports table: add missing columns and restore id auto-generation
ALTER TABLE reports ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE reports ADD COLUMN IF NOT EXISTS du_percent text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS du_status text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS test_date text;

-- Disable Row Level Security on all tables
-- (all access is controlled by the authenticated API server, not by Supabase RLS)
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE help_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
