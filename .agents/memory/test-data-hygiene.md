---
name: Test-data hygiene
description: Convention keeping E2E/smoke rows out of production Supabase data, and the automatic teardown.
---

**Rule:** Any test/smoke row written to Supabase MUST be tagged: reports `farm_name` starts `E2E-` (or `user_id` = `00000000-0000-4000-8000-000000000e2e`), help_requests `description` starts `[E2E]`, feedback `message` starts `[E2E]`. Teardown = `pnpm run cleanup:test-data` (script: `scripts/cleanup-test-data.mjs`, supports `--dry-run`). Preferred alternative: run API server with `NODE_ENV=test` + `SUPABASE_TEST_URL`/`SUPABASE_TEST_SERVICE_ROLE_KEY` for a fully isolated test project.

**Why:** Untagged smoke rows previously landed in production (legacy "Farm zx7k9q") and had to be deleted by hand.

**How to apply:** Whenever an agent or test hits POST /api/reports (or feedback/help endpoints) against the live DB, use tagged values and finish with the cleanup script. Full convention documented in replit.md "Test data".

## Automated smoke + cleanup
`pnpm run smoke:reports` (scripts/smoke-test-reports.mjs, validation step `smoke-reports`) boots the API server on private port 3811, tests POST/GET /api/reports incl. LWW, and ALWAYS runs cleanup-test-data.mjs in `finally` — a cleanup failure fails the run. The api-server `dev` script forces NODE_ENV=development, so smoke rows go to SUPABASE_URL, the same DB cleanup deletes from; keep aligned if the dev script changes.
