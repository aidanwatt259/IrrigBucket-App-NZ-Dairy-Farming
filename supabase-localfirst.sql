-- IrrigBucket — Local-First / Offline-First migration (Phase 0)
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query
--
-- Adds Last-Write-Wins (LWW) timestamp columns to the reports table plus an
-- auto-maintained updated_at trigger. Every statement is additive, idempotent,
-- and backward-compatible — safe to run multiple times and safe against the
-- live production data.

-- 1. Soft-delete tombstone column (used by the API's DELETE/restore routes and
--    surfaced to sync clients so deletions propagate). Added defensively.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. client_updated_at: ISO timestamp of the client's last LOCAL modification.
--    This is the logical version used for Last-Write-Wins conflict resolution.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS client_updated_at timestamptz;

-- 3. updated_at: server-side last-write timestamp, auto-maintained by a trigger.
--    Add as nullable, backfill existing rows to created_at, then enforce
--    DEFAULT now() + NOT NULL so ordering stays sane for historical rows.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.reports
  SET updated_at = created_at
  WHERE updated_at IS NULL;

ALTER TABLE public.reports
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.reports
  ALTER COLUMN updated_at SET NOT NULL;

-- 4. Backfill client_updated_at for existing rows so they have a sane LWW
--    baseline (treat their last-known modification as their creation time).
UPDATE public.reports
  SET client_updated_at = created_at
  WHERE client_updated_at IS NULL;

-- 5. Trigger to bump updated_at on every UPDATE (server authoritative clock).
CREATE OR REPLACE FUNCTION public.set_reports_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_set_updated_at ON public.reports;
CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reports_updated_at();
