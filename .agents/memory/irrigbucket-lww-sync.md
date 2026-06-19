---
name: IrrigBucket offline-first sync (server LWW)
description: How the server-side Last-Write-Wins report upsert works, the Supabase Database-type gotcha, and the PostgREST race/injection decisions.
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
