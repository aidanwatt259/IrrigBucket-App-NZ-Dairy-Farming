---
name: IrrigBucket local-first client integration gotchas
description: Non-obvious traps wiring @workspace/sync + durable adapters into the web (Dexie) and mobile (expo-sqlite) clients — typecheck, Metro, and id-format.
---

# Web artifact typecheck: project-references trap
- `pnpm --filter @workspace/irrigbucket run typecheck` (which is `tsc -p tsconfig.json --noEmit`)
  fails with **TS6306** because the web tsconfig `references` `lib/replit-auth-web`, which is
  NOT `composite`. Making it composite then cascades into a SECOND error: replit-auth-web uses
  `import.meta.env` (Vite) and only typechecks inside the Vite bundler context, not a standalone
  `tsc -b` composite build.
- **Why:** the web artifact was historically only built via Vite/esbuild + editor, never via
  `tsc -p` with references resolved, so these latent errors never surfaced until Phase 3.
- **How to apply:** to typecheck ONLY the web app's own source, run a references-free check
  (resolve `@workspace/*` via node_modules, exactly like the mobile tsconfig does):
  create a temp `artifacts/irrigbucket/tsconfig.verify.json` = `{ "extends": "./tsconfig.json", "references": [] }`
  and `tsc -p` it. Mobile has no `references` array so it typechecks clean directly.
- Known PRE-EXISTING latent web error (not from local-first work): `SideMenu.tsx` reads
  `user.isAdmin` but `AuthUser` has no `isAdmin`. Decide in Phase 6 whether to fix the repo's
  typecheck wiring; do NOT silently absorb it into a feature change.

# Mobile Metro: two required resolver tweaks
- `@workspace/*` TS libs use NodeNext `.js` import specifiers that point at `.ts/.tsx` source.
  Metro's default resolver does NOT rewrite `.js`→`.ts`. Fix in `metro.config.js` with a
  `resolver.resolveRequest` shim that retries a failing `*.js` request against `*.ts`/`*.tsx`.
- expo-sqlite's WEB build (wa-sqlite) statically imports `wa-sqlite.wasm`; Metro doesn't treat
  `.wasm` as an asset by default, so the web bundle fails with `Unable to resolve .../wa-sqlite.wasm`.
  Fix: `config.resolver.assetExts.push("wasm")`. Native bundles never hit this import.
- **Do NOT add COOP/COEP headers** for SharedArrayBuffer in the Replit Expo preview: the app is a
  proxied iframe, so cross-origin isolation can't be achieved and the headers risk breaking the
  preview. wa-sqlite's async VFS degrades gracefully without SAB; web persistence may be limited,
  but the bundle builds and the app loads. Native is the primary persistence target.

# Phase 5 carry-forward: mobile report ids must become UUIDs
- The server `reports.id` is a UUID column and is the upsert key. The WEB store already mints
  `crypto.randomUUID()`. The MOBILE `WizardContext.saveCurrentReport` still uses the legacy
  `Date.now()+Math.random()` id generator. This is fine in Phase 4 (sync gated OFF), but BEFORE
  Phase 5 enables sync, mobile ids MUST switch to UUIDs or every upsert will be rejected by the
  server's UUID column. Legacy migrated rows with non-UUID ids will also fail to upsert.
