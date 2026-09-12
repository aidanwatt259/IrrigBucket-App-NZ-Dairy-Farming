-- ============================================================
-- IrrigBucket — New Supabase Tables
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. public.users ─────────────────────────────────────────
-- Extends auth.users with app-level fields.
-- Automatically populated by trigger on auth.users insert/update.
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  status        TEXT        NOT NULL DEFAULT 'active',   -- 'active' | 'suspended' | 'banned'
  is_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: create public.users row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email, is_verified)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Trigger: keep public.users in sync when auth.users is updated
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users
  SET
    email       = NEW.email,
    is_verified = NEW.email_confirmed_at IS NOT NULL,
    updated_at  = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();


-- ── 2. user_profiles ────────────────────────────────────────
-- Public-facing profile data — no sensitive info.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  bio          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ── 3. user_preferences ─────────────────────────────────────
-- Per-user settings stored as a flexible JSONB blob.
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  preferences JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ── 4. user_tokens ──────────────────────────────────────────
-- Admin-triggered force-logout records.
-- When a row is inserted for a user, the API server can call
-- supabase.auth.admin.signOut(userId, 'global') to revoke all sessions.
CREATE TABLE IF NOT EXISTS public.user_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason          TEXT,                           -- e.g. 'security_concern', 'admin_action'
  invalidated_by  TEXT,                           -- admin identifier
  invalidated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 5. subscriptions ────────────────────────────────────────
-- One subscription record per user; expand plan/status as needed.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan       TEXT        NOT NULL DEFAULT 'free',    -- 'free' | 'pro' | 'enterprise'
  status     TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'cancelled' | 'past_due' | 'trialing'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ── 6. activity_logs ────────────────────────────────────────
-- Audit trail for security-relevant events per user.
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action     TEXT        NOT NULL,  -- 'signup' | 'login' | 'logout' | 'password_changed' | 'email_changed'
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 7. Update existing tables ────────────────────────────────
-- Add a typed UUID FK column alongside the legacy text user_id.
-- Both columns are populated going forward; legacy user_id stays for
-- backward compatibility with existing rows.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS supabase_user_id UUID REFERENCES public.users(id);

ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS supabase_user_id UUID REFERENCES public.users(id);

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS supabase_user_id UUID REFERENCES public.users(id);


-- ── 8. Disable RLS on all tables ─────────────────────────────
-- All data access goes through the authenticated API server using the
-- service role key, so client-side RLS is not needed.
ALTER TABLE public.users             DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tokens       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs     DISABLE ROW LEVEL SECURITY;
