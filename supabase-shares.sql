-- IrrigBucket — Report share links (Phase 5 of Farmer vs Consultant interfaces)
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query
-- (or: node scripts/apply-supabase-migration.mjs supabase-shares.sql)
--
-- Lets a consultant hand a farmer a public, read-only link to one report
-- (https://<app>/r/<token>) without the farmer needing an account. Every
-- statement is additive and idempotent — safe to run more than once.

-- 1. Share tokens. One report can have many tokens over time; only rows with
--    revoked_at IS NULL are live. Deleting a report removes its tokens.
CREATE TABLE IF NOT EXISTS public.report_shares (
  token      text        PRIMARY KEY,
  report_id  uuid        NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  created_by text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS report_shares_report_id_idx ON public.report_shares (report_id);

-- The API uses the service-role key (which bypasses RLS). Enabling RLS with no
-- policies keeps the tokens unreadable through the public anon key.
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- 2. Quick flag on the report itself so lists can show "shared" without a join.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS shared_with_farmer boolean NOT NULL DEFAULT false;
