-- IrrigBucket — Farms & Irrigators (Phase 1 of Farmer vs Consultant interfaces)
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query
-- (or: node scripts/apply-supabase-migration.mjs supabase-farms.sql)
--
-- Adds first-class farms, farm membership and saved irrigators, links reports
-- to them, and backfills farms/irrigators from the free-text farm and
-- irrigator names on existing reports. Every statement is additive and
-- idempotent — safe to run more than once against live data.

-- 1. Shared updated_at trigger function for the new tables.
CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Farms. `id` is client-generated (offline-first), so there is no default.
CREATE TABLE IF NOT EXISTS public.farms (
  id                uuid        PRIMARY KEY,
  name              text        NOT NULL,
  region            text,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  notes             text,
  created_by        text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  client_updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

DROP TRIGGER IF EXISTS farms_set_updated_at ON public.farms;
CREATE TRIGGER farms_set_updated_at
  BEFORE UPDATE ON public.farms
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- 3. Who can access a farm. The creator is 'owner' (a consultant who creates a
--    client farm owns it); a farmer who later joins gets 'farmer'.
CREATE TABLE IF NOT EXISTS public.farm_members (
  farm_id    uuid        NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id    text        NOT NULL,
  role       text        NOT NULL CHECK (role IN ('owner', 'consultant', 'farmer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (farm_id, user_id)
);

CREATE INDEX IF NOT EXISTS farm_members_user_id_idx ON public.farm_members (user_id);

-- One consultant per farm for now; drop this index to allow several.
CREATE UNIQUE INDEX IF NOT EXISTS farm_members_one_consultant
  ON public.farm_members (farm_id) WHERE role = 'consultant';

-- 4. Saved irrigators per farm. `details` holds the irrigator's last-used
--    system settings so a re-test can prefill setup.
CREATE TABLE IF NOT EXISTS public.irrigators (
  id                   uuid        PRIMARY KEY,
  farm_id              uuid        NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  type                 text        NOT NULL,
  details              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  test_interval_months integer     NOT NULL DEFAULT 12,
  created_by           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  client_updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX IF NOT EXISTS irrigators_farm_id_idx ON public.irrigators (farm_id);

DROP TRIGGER IF EXISTS irrigators_set_updated_at ON public.irrigators;
CREATE TRIGGER irrigators_set_updated_at
  BEFORE UPDATE ON public.irrigators
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- The API uses the service-role key (which bypasses RLS). Enabling RLS with no
-- policies keeps these tables unreadable through the public anon key.
ALTER TABLE public.farms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrigators   ENABLE ROW LEVEL SECURITY;

-- 5. Link reports to a farm and irrigator. No foreign keys: an offline client
--    can sync a report before the farm it belongs to.
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS farm_id uuid;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS irrigator_id uuid;
CREATE INDEX IF NOT EXISTS reports_farm_id_idx ON public.reports (farm_id);

-- 6. Backfill farms: one per (account, farm name ignoring case/whitespace),
--    reusing a farm the account already has with that name.
WITH named AS (
  SELECT user_id, lower(btrim(farm_name)) AS norm, btrim(farm_name) AS name, created_at
  FROM public.reports
  WHERE user_id IS NOT NULL
    AND deleted_at IS NULL
    AND farm_id IS NULL
    AND btrim(coalesce(farm_name, '')) <> ''
), latest AS (
  SELECT DISTINCT ON (user_id, norm) user_id, norm, name
  FROM named
  ORDER BY user_id, norm, created_at DESC
), missing AS (
  SELECT l.*
  FROM latest l
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.farms f
    JOIN public.farm_members m ON m.farm_id = f.id
    WHERE m.user_id = l.user_id
      AND f.deleted_at IS NULL
      AND lower(btrim(f.name)) = l.norm
  )
), inserted AS (
  INSERT INTO public.farms (id, name, created_by)
  SELECT gen_random_uuid(), name, user_id FROM missing
  RETURNING id, created_by
)
INSERT INTO public.farm_members (farm_id, user_id, role)
SELECT id, created_by, 'owner' FROM inserted;

UPDATE public.reports r
SET farm_id = f.id
FROM public.farms f
JOIN public.farm_members m ON m.farm_id = f.id AND m.role IN ('owner', 'consultant')
WHERE r.farm_id IS NULL
  AND r.user_id = m.user_id
  AND f.deleted_at IS NULL
  AND btrim(coalesce(r.farm_name, '')) <> ''
  AND lower(btrim(r.farm_name)) = lower(btrim(f.name));

-- 7. Backfill irrigators: one per (farm, irrigator type, irrigator name), with
--    the most recent report's system settings as its saved details.
WITH named AS (
  SELECT
    r.farm_id,
    r.irrigator_type AS type,
    lower(btrim(r.report_data->'operationData'->>'irrigatorName')) AS norm,
    btrim(r.report_data->'operationData'->>'irrigatorName') AS name,
    CASE WHEN jsonb_typeof(r.report_data->'systemParams') = 'object'
         THEN r.report_data->'systemParams' ELSE '{}'::jsonb END AS details,
    r.user_id,
    r.created_at
  FROM public.reports r
  WHERE r.farm_id IS NOT NULL
    AND r.irrigator_id IS NULL
    AND r.deleted_at IS NULL
    AND r.irrigator_type IS NOT NULL
    AND btrim(coalesce(r.report_data->'operationData'->>'irrigatorName', '')) <> ''
), latest AS (
  SELECT DISTINCT ON (farm_id, type, norm) *
  FROM named
  ORDER BY farm_id, type, norm, created_at DESC
)
INSERT INTO public.irrigators (id, farm_id, name, type, details, created_by)
SELECT gen_random_uuid(), l.farm_id, l.name, l.type, l.details, l.user_id
FROM latest l
WHERE NOT EXISTS (
  SELECT 1 FROM public.irrigators i
  WHERE i.farm_id = l.farm_id
    AND i.type = l.type
    AND i.deleted_at IS NULL
    AND lower(btrim(i.name)) = l.norm
);

UPDATE public.reports r
SET irrigator_id = i.id
FROM public.irrigators i
WHERE r.irrigator_id IS NULL
  AND r.farm_id = i.farm_id
  AND r.irrigator_type = i.type
  AND i.deleted_at IS NULL
  AND btrim(coalesce(r.report_data->'operationData'->>'irrigatorName', '')) <> ''
  AND lower(btrim(r.report_data->'operationData'->>'irrigatorName')) = lower(btrim(i.name));

-- 8. Mirror the links into the report payload so devices that download these
--    reports know which farm and irrigator they belong to. client_updated_at is
--    left untouched so this never wins Last-Write-Wins over a device's edits.
UPDATE public.reports
SET report_data = report_data || jsonb_build_object(
  'operationData',
  CASE WHEN jsonb_typeof(report_data->'operationData') = 'object'
       THEN report_data->'operationData' ELSE '{}'::jsonb END
    || jsonb_strip_nulls(jsonb_build_object('farmId', farm_id, 'irrigatorId', irrigator_id))
)
WHERE farm_id IS NOT NULL
  AND (
    (report_data->'operationData'->>'farmId') IS DISTINCT FROM farm_id::text
    OR (irrigator_id IS NOT NULL
        AND (report_data->'operationData'->>'irrigatorId') IS DISTINCT FROM irrigator_id::text)
  );
