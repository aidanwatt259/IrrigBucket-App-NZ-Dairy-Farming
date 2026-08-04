---
name: Schema ownership & startup DDL
description: Why the API server runs no DDL at boot, and how to verify prod schema when the prod DB is frozen
---

Rule: the API server must run no DDL at startup — only a `SELECT 1` readiness probe (background, retrying) gates `isDbReady()`. Schema lives in the drizzle schema package; dev gets it via `drizzle-kit push` (post-merge), production via Replit's publish-time diff.

**Why:** Replit's publish flow diffs dev↔prod schema and applies the difference; startup DDL is redundant, adds cold-start latency, and is an unsupported pattern per platform guidance.

**How to apply:** any new table/column goes into `lib/db/src/schema`, then push to dev and re-publish. Never add `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` to server boot.

Gotcha: the production DB read-replica can be **frozen** (`executeSql({environment:"production"})` fails with "frozen. Unfreeze it first") — direct prod verification is then impossible. Rely on the publish diff for convergence: anything absent from the dev schema (e.g. the old unique constraint on users.email) gets dropped from prod on the next publish.
