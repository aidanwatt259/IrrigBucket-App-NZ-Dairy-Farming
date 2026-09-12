---
name: IrrigBucket mobile auth + offline-sync gating
description: Non-obvious contracts and decisions for mobile email/password auth and how it gates the offline-first sync engine.
---

# Mobile auth + offline-sync gating (Phase 5)

## `/api/auth/user` invalid-session contract
- An invalid/expired `sid` resolves to `{ user: null }` with **HTTP 200** — it does NOT throw.
- **Why it matters:** the only way `getCurrentAuthUser()` throws is a genuine transport/connectivity failure. That distinction is what makes "optimistic offline sign-in" safe: a `null` body = confirmed-invalid (sign out, keep local data); a throw = offline (trust stored sid only when `NetInfo` says offline; on an online throw stay signed out WITHOUT clearing the sid so a later retry recovers).

## Anonymous ids must be UUIDs before first push
- Server `reports.id` is a Postgres `uuid`. The offline-first wizard mints report ids before any account exists, so locally-minted non-UUID ids must be rekeyed to UUIDs **before** the engine goes online, or the server rejects the upsert.
- **How to apply:** rekey runs while the engine is still gated offline (before `authed` flips), through the adapter's serial mutex, with a re-guard inside the txn (skip rows adopted/claimed/removed since the snapshot). Rekey patches the row PK, the embedded `report_data.id`, and the `sync_queue.report_id` together.

## Persist ONLY the sid
- Mobile persists only the server session id; never email/PII or Supabase tokens.
- **Why:** strict privacy constraint. Email is shown only from the live `getCurrentAuthUser()` (or the just-entered value), never persisted. Auth uses a direct Supabase Auth REST password grant instead of `@supabase/supabase-js` to avoid pulling in the `url`-polyfill dependency on React Native.

## Sign-out is a token-epoch fence, not engine cancellation
- The shared `SyncEngine` does not cancel an in-flight `drain()`/`reconcilePull()`. Sign-out alone (set offline + clear token) can't stop a request that already left.
- **Fix:** a monotonic `tokenEpoch` (bumped on persist/clear in the token store) is captured before each request in the **mobile** transport and re-checked after; a mismatch throws so a late completion can't mutate the outbox under a session the user already left. Re-push next sign-in is safe because upserts are idempotent on `id`.
- **Constraint:** this lives in the mobile transport, never in shared `lib/sync/src/*`.
