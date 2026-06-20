# Memory Index

- [IrrigBucket architecture](irrigbucket-architecture.md) — JSON-blob persistence (no DB migration for new SystemParams fields); derived metrics live in the report layer; mobile setup wiring has 4 touch-points.
- [IrrigBucket local-first clients](irrigbucket-localfirst-clients.md) — web typecheck refs-trap (verify refs-free); Metro needs .js→.ts shim + wasm assetExts; mobile ids → UUID before P5 sync.
- [IrrigBucket offline-first sync](irrigbucket-lww-sync.md) — server LWW upsert + Supabase Database-type `never` gotcha + PostgREST `.or()` injection rule; client lib/sync engine invariants (enqueueId guard, pre-read inFlight claim, StorageAdapter atomicity/CAS contract).
- [Supabase connectivity](supabase-connectivity.md) — direct host IPv6-only → use Session pooler (aws-1-us-east-2); SUPABASE_DB_URL secret can be frozen mid-session; verify schema via service-role REST (42703 = missing col).
