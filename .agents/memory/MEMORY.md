# Memory Index

- [IrrigBucket architecture](irrigbucket-architecture.md) — JSON-blob persistence (no DB migration for new SystemParams fields); derived metrics live in the report layer; mobile setup wiring has 4 touch-points.
- [IrrigBucket offline-first sync](irrigbucket-lww-sync.md) — server LWW report upsert; Supabase Database-type `never` gotcha; guarded non-atomic write + PostgREST `.or()` injection rule.
- [Supabase connectivity](supabase-connectivity.md) — direct host IPv6-only → use Session pooler (aws-1-us-east-2); SUPABASE_DB_URL secret can be frozen mid-session; verify schema via service-role REST (42703 = missing col).
