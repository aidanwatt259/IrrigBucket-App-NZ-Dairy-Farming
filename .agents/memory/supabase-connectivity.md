---
name: Supabase connectivity from Replit
description: How to reach the IrrigBucket Supabase DB for DDL/verification from the Replit (IPv4) environment, plus a secret-propagation gotcha.
---

# Supabase connectivity (IrrigBucket)

## Direct host is IPv6-only
- The Supabase "Direct connection" host `db.<ref>.supabase.co` publishes ONLY AAAA (IPv6) records. The Replit dev environment is IPv4-only, so connecting fails with ENOTFOUND/ENODATA.
- Use the **Session pooler** (IPv4) instead. For this project the working endpoint is `aws-1-us-east-2.pooler.supabase.com:5432`, username `postgres.<ref>`, db `postgres` (region us-east-2, "aws-1" prefix — found by probing; "aws-0-*" and other regions return Supavisor "Tenant or user not found").
- When building the pooler connection, pass DISCRETE pg fields (host/user/password/database) with a `decodeURIComponent`'d password rather than rebuilding a URL string, to avoid percent-encoding corruption. `ssl: { rejectUnauthorized: false }`.

## Secret-propagation gotcha (env can be frozen mid-session)
- An added/updated `SUPABASE_DB_URL` secret may NOT reach the running container's `process.env` during the same session — even freshly (re)started workflows inherited a stale snapshot (identical value across multiple user updates, incl. after a password reset that must have changed it).
- `viewEnvVars({type:"secret"})` and `process.env` can disagree (a key present in `process.env` was absent from the secret-store listing).
- **Why:** process.env appears to be a boot-time snapshot disconnected from later secret-store edits.
- **How to apply:** Don't assume a just-updated secret is visible to bash/workflows this session. If a credential keeps failing despite user updates, fingerprint it (sha256 of the decoded value, first 8 chars — never print the value) to detect staleness before blaming the user. A new session may be required to pick up the new value.

## Running DDL vs. verifying schema
- DDL (ALTER TABLE, triggers, etc.) CANNOT be done via PostgREST/service-role. Options: Supabase SQL Editor (dashboard), or a working Session-pooler pg connection.
- **Verify schema/data WITHOUT the Postgres password** via the service-role REST key: `GET {SUPABASE_URL}/rest/v1/reports?select=<col>&limit=1` with `apikey` + `Authorization: Bearer`. A missing column returns 400 code `42703` ("column ... does not exist"); total row count via `Prefer: count=exact` + `Range: 0-0` → read `Content-Range: a-b/total`. Works over IPv4.
- Reusable runners live in `scripts/`: `apply-supabase-migration.mjs` + `supabase-conn.mjs` (pooler pg path, for when a valid pooler URL is in env), and `verify-reports-rest.mjs` (service-role REST path, always works).

## 2026-08-04
- REST host szlukdnwkmnwlkfritpl.supabase.co no longer resolves (general internet fine) — project likely paused/deleted. All Supabase-backed features silently blocked until user restores it; junk-test-row cleanup deferred (follow-up task proposed).
