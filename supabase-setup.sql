-- IrrigBucket Supabase Setup
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query

-- Reports table
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  irrigator_type text,
  farm_name text,
  assessor_name text,
  test_date text,
  report_data jsonb not null,
  du_percent text,
  du_status text,
  created_at timestamptz not null default now()
);

-- Help requests table
create table if not exists help_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  description text not null,
  contact_info text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Feedback table
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  message text not null,
  contact_info text,
  created_at timestamptz not null default now()
);

-- Disable Row Level Security so the API server can read/write freely
-- (all access goes through the authenticated API server, not direct client access)
alter table reports disable row level security;
alter table help_requests disable row level security;
alter table feedback disable row level security;
