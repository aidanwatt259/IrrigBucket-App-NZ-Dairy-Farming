# Memory Index

- [IrrigBucket architecture](irrigbucket-architecture.md) — JSON-blob persistence (no DB migration for new SystemParams fields); derived metrics live in the report layer; mobile setup wiring has 4 touch-points.
- [IrrigBucket build & typecheck hygiene](irrigbucket-build-typecheck.md) — referenced libs need a built gitignored dist (TS6306/TS6305); isAdmin augmented at auth boundary not generated code; 7 green gates; anon-reports security follow-up.
- [IrrigBucket mobile auth + sync gating](irrigbucket-mobile-auth-sync.md) — /api/auth/user returns {user:null} 200 (not throw) for bad sid; rekey anon ids to UUID before push; persist ONLY sid; sign-out uses a token-epoch fence in the mobile transport.
- [IrrigBucket local-first clients](irrigbucket-localfirst-clients.md) — web typecheck refs-trap (verify refs-free); Metro needs .js→.ts shim + wasm assetExts; mobile ids → UUID before P5 sync.
- [IrrigBucket offline-first sync](irrigbucket-lww-sync.md) — server LWW upsert + Supabase Database-type `never` gotcha + PostgREST `.or()` injection rule; client lib/sync engine invariants (enqueueId guard, pre-read inFlight claim, StorageAdapter atomicity/CAS contract).
- [Supabase connectivity](supabase-connectivity.md) — direct host IPv6-only → use Session pooler (aws-1-us-east-2); SUPABASE_DB_URL secret can be frozen mid-session; verify schema via service-role REST (42703 = missing col).
