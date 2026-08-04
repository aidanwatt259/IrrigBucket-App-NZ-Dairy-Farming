# Memory Index

- [IrrigBucket architecture](irrigbucket-architecture.md) — JSON-blob persistence (no DB migration for new SystemParams fields); derived metrics live in the report layer; mobile setup wiring has 4 touch-points.
- [IrrigBucket store submission](store-submission.md) — CORS is safe (SameSite=Lax cookie), no runtime perms/trackers; privacy page + in-app account delete now built; after a successful server delete never re-enable sync (resurrects data as anon rows); contact email is a placeholder, expo-location unused.
- [Testing the Expo mobile artifact](testing-multi-artifact.md) — path `/` routes to the WEB app; e2e/screenshots must navigate to the absolute `$REPLIT_EXPO_DEV_DOMAIN` URL to hit the mobile app.
- [IrrigBucket build & typecheck hygiene](irrigbucket-build-typecheck.md) — referenced libs need a built gitignored dist (TS6306/TS6305); isAdmin augmented at auth boundary not generated code; 7 green gates; anon-reports security follow-up.
- [IrrigBucket mobile auth + sync gating](irrigbucket-mobile-auth-sync.md) — /api/auth/user returns {user:null} 200 (not throw) for bad sid; rekey anon ids to UUID before push; persist ONLY sid; sign-out uses a token-epoch fence in the mobile transport.
- [IrrigBucket local-first clients](irrigbucket-localfirst-clients.md) — web typecheck refs-trap (RESOLVED); Metro needs .js→.ts shim + wasm assetExts; mobile ids → UUID before P5 sync; Expo Go blocked by owner+non-interactive dev → EXPO_OFFLINE=1.
- [IrrigBucket offline-first sync](irrigbucket-lww-sync.md) — server LWW upsert + Supabase Database-type `never` gotcha + PostgREST `.or()` injection rule; client lib/sync engine invariants (enqueueId guard, pre-read inFlight claim, StorageAdapter atomicity/CAS contract).
- [Test-data hygiene](test-data-hygiene.md) — tag all smoke/E2E rows (farm_name `E2E-`, text `[E2E]`, reserved user UUID …0e2e) and run `pnpm run cleanup:test-data` on teardown; NODE_ENV=test can point at SUPABASE_TEST_URL.
- [Supabase connectivity](supabase-connectivity.md) — direct host IPv6-only → use Session pooler (aws-1-us-east-2); SUPABASE_DB_URL secret can be frozen mid-session; verify schema via service-role REST (42703 = missing col).
