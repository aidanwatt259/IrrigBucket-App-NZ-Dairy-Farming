---
name: IrrigBucket offline-first sync (server LWW + client engine)
description: Server-side LWW report upsert, the Supabase Database-type gotcha, PostgREST race/injection decisions, AND the shared client sync-engine (lib/sync) correctness invariants the Dexie/expo-sqlite adapters must honor.
---

# Server-side LWW upsert for offline-first reports

## Reports live in Supabase, reached only via supabase-js service-role key
Report/feedback/help_requests rows are in Supabase (RLS disabled), reached ONLY
through the api-server with the service-role key — clients never talk to Supabase
directly; both web and mobile sync via the api-server REST API. `@workspace/db`
(Drizzle/Postgres) holds only sessions + users; its reports/help_requests tables
are vestigial.

## Supabase `Database` type must satisfy GenericSchema or `.from()` is typed `never`
If supabase-js `.from(...)` builders come back typed `never` (and you get a flood of
tsc errors across every route that touches Supabase), the hand-written `Database`
type is missing GenericSchema members. Each table needs `Row`, `Insert`, `Update`,
**and `Relationships: []`**; the schema needs **`Views`/`Functions`/`Enums`/
`CompositeTypes`** (use `{ [_ in never]: never }`). This is the canonical
`supabase gen types` shape.
**Why:** without these, `Database["public"]` doesn't structurally extend
`GenericSchema`, so postgrest-js falls back to `never`-typed builders. supabase-js
ships via esbuild which ignores types, so this hides until you run `tsc`.

## LWW compares client_updated_at on BOTH sides (single client clock)
The decision (`lib/reportUpsert.ts`) compares incoming `clientUpdatedAt` vs the
stored row's `client_updated_at` (fallback updated_at → created_at), NOT the server
`updated_at`. Strictly-newer incoming wins (`accept`); equal/older loses
(`server_wins`, which makes redundant re-sends idempotent).
**Why:** lets one client's local clock drive LWW even when the server clock differs.
**Trade-off (accepted):** a device with a far-future clock can dominate future writes
until surpassed — revisit if true multi-device conflict correctness is needed.

## lookup-then-write is not atomic — guard the write, don't trust the decision alone
The route does lookup → decide → write, which is racy. To keep LWW correct under
concurrent syncs:
- **accept path:** the UPDATE is guarded with `.lt("client_updated_at", incomingIso)`
  so a concurrent newer write committed in between is never clobbered; on 0 rows
  updated, refetch and return the authoritative winner.
- **insert path:** a duplicate primary key (`error.code === "23505"`) is treated as
  idempotent — refetch and return the existing winner instead of 500.
- `accept` deliberately does NOT touch `deleted_at` (no auto-resurrect of a
  soft-deleted row). DELETE tombstone LWW is intentionally deferred to a later phase.

## PostgREST filter injection: prefer `.lt()`/`.eq()` over raw `.or()` strings
`clientUpdatedAt` and `id` are unconstrained `type: string` in the OpenAPI spec
(generated zod = `z.string()`), so they are attacker-controllable. supabase-js
URL-encodes values passed to `.eq()`/`.lt()`/etc., but `.or("col.op.value,...")`
takes a RAW PostgREST filter string it does NOT escape — never interpolate
user input there. The guarded update uses `.lt()` (value encoded) and sanitizes the
timestamp to canonical ISO. `client_updated_at` is non-null in practice (Phase 0
backfilled existing rows to `created_at`; every write sets it), so a plain `.lt`
guard with no null branch is complete.

# Client sync engine (lib/sync) — correctness invariants

The shared `@workspace/sync` package is platform-agnostic: it defines a
`StorageAdapter` (local persistence) + `Transport` (api-server REST client) and a
`SyncEngine` that drives them. NO Dexie/sqlite/fetch imports live here. The outbox
is keyed by reportId (at most ONE pending op per report; a later enqueue coalesces /
supersedes the prior). The invariants below took THREE architect rounds to settle —
the Dexie (web) and expo-sqlite (mobile) adapters must preserve every one.

## Outbox completion guards on a unique `enqueueId`, never on a timestamp
`completeSync`/`failQueueItem` CAS-match on the queue item's `enqueueId`, NOT its
`opClientUpdatedAt`. **Why:** a delete that supersedes an upsert can be stamped in
the SAME millisecond, so a timestamp guard can false-match and let a stale in-flight
completion clobber the newer op. `enqueueId` must be globally unique INCLUDING across
engine restarts (it is persisted), so the default generator adds random entropy
(`${nowIso}#${seq}#${random}`); it is injectable (`genId`) — inject a platform
UUID in web/mobile. `opClientUpdatedAt` is kept only as an informational invariant.

## Claim `inFlight` BEFORE the (async) outbox read, not after
`enqueueDelete` takes a "never-synced ⇒ purge locally, no round-trip" shortcut ONLY
when `syncedAt===null && !inFlight.has(id)`. `processReport` therefore must
`inFlight.add(reportId)` as its FIRST line, before `await getSyncTarget`, inside a
try/finally that always clears it. **Why:** with a real async adapter a delete can
land during the read window; if the claim came after the read, the delete would
purge the row locally while the create is about to be sent → an orphaned/resurrected
server row. Claiming first forces that delete down the tombstone+enqueue-delete path.

## No awaits between the outbox snapshot resolving and the transport call
`getSyncTarget(reportId)` returns `{item, report}` as ONE atomic snapshot. Between
that read resolving and `transport.push/deleteReport`, `processReport` does only
synchronous work (the nextAttemptAt due-check). **Why:** any interleaved local
mutation there could make the engine transmit a stale op.

## StorageAdapter atomicity / CAS contract (adapters MUST honor exactly)
- `saveAndEnqueue`: ONE txn — persist report + upsert its single outbox item.
- `getSyncTarget`: ONE read snapshot of (current queue item + current report);
  `null` iff no pending item.
- `completeSync(report, enqueueId)`: ONE txn — iff current item's `enqueueId`
  matches, store authoritative report + delete the item; else no-op (return false).
- `failQueueItem(item)`: ONE txn — iff `enqueueId` matches, update retry bookkeeping;
  else no-op.
- `purgeReport`: ONE txn — delete report + its pending item together.
- `applyRemoteBatch`: per adoption, CAS-apply ONLY IF no pending outbox item AND
  local `clientUpdatedAt` still equals the expected value (`null` = no local row).
  **Why:** closes the window between reconcilePull's read and the write so a racing
  local edit is never clobbered.

## A single `drain()` only re-loops when autoSync re-requests it
With `autoSync:false`, an op enqueued mid-drain (e.g. the tombstone+delete created
while a create is in flight) is NOT flushed by the same `drain()` call — its
`requestDrain` is a no-op, so the do-while exits after one pass. Production uses
`autoSync:true` (each enqueue triggers a background drain, so the loop continues).
**How to apply:** in tests with `autoSync:false`, drain in a loop until the outbox
empties to model production; don't assume one `drain()` flushes a mid-drain enqueue.

## Supabase-unreachable handling (auto-pause)
- API routes classify unreachable-Supabase errors (fetch failed / 5xx codes / paused project) via `isSupabaseUnavailable` in the api-server supabase lib and answer **503 `{code:"SYNC_UNAVAILABLE"}`** instead of 500; `GET /api/health` pings Supabase (5s timeout) for monitoring.
- Clients don't parse the 503 specially: any transport throw puts the sync engine in `state:'error'` with items pending, and both banners (web OfflineIndicator, mobile OfflineBanner) show "Sync unavailable — data saved locally" on `state==='error' && pending>0`.
