---
name: IrrigBucket local-first client integration gotchas
description: Non-obvious traps wiring @workspace/sync + durable adapters into the web (Dexie) and mobile (expo-sqlite) clients — typecheck, Metro, and id-format.
---

# Web artifact typecheck: project-references trap — RESOLVED
- The `typecheck-web` TS6306/TS6305 trap and the `SideMenu` `user.isAdmin` error are now
  properly fixed (Phase 6), not worked around. See **[irrigbucket-build-typecheck.md]** for
  the real fix (make `lib/replit-auth-web` composite + built dist + `types:["vite/client"]`;
  augment `AuthUser` with `isAdmin?` at the auth boundary). `typecheck-web` is a green gate.
- Do NOT reintroduce the old `tsconfig.verify.json` references-free workaround — it is obsolete.

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

# Expo Go won't open on a phone: owner + non-interactive dev server
- `app.json` has `owner` (+ `extra.eas.projectId`). With an `owner` set, `expo start` wants to
  authenticate as that account to code-sign the dev manifest, so at startup it shows an
  interactive prompt "Log in / Proceed anonymously" (link: expo.fyi/unverified-app-expo-go).
- The Replit mobile `dev` workflow runs non-interactively (`< /dev/null`), so the prompt can
  never be answered → Expo Go treats the app as unverified and won't open it on a device.
- **Key tell:** Metro still serves manifest + bundles to raw `curl`, and the Expo **web**
  preview still renders fine — ONLY Expo Go (the phone) is blocked. So a green web preview does
  NOT prove Expo Go works.
- **Fix:** add `EXPO_OFFLINE=1` to the mobile `dev` script. Offline mode skips the account check
  + prompt and serves an UNSIGNED dev manifest (logs "unable to sign manifest"), which Expo Go
  opens as a normal anonymous dev project. Keeps `owner`/EAS intact for builds.
- For a fully *verified* experience (no unsigned notice), instead set an `EXPO_TOKEN` secret so
  the dev server logs in as the owner online and signs the manifest. Do NOT delete `owner` — it
  ties EAS build/update to the account.
