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

# Expo Go verification and managed sign-in
Do not treat a working Expo web preview or native export as proof that a physical iOS Expo Go client can open the app. The former SDK 54 anonymous/offline workaround is not a substitute for SDK 57's managed sign-in.

**Why:** Expo Go 57 on physical iOS requires a signed-in dev server. Web and Android do not establish coverage of that requirement. Preserve the existing app owner and native build identity rather than deleting them to work around preview authentication.

**How to apply:** Use Replit's managed session and Preview on your phone flow, not manual Expo/EAS credentials. Record physical-device acceptance separately from bundles and browser screenshots.

# SDK upgrade dependency checks in the workspace
Use Expo CLI's recommended versions, then inspect actual installed React versions as well as the mobile manifest.

**Why:** pnpm can replace explicit React additions with catalog references, retaining an incompatible shared pin. The project also delays new package releases by one day, whereas Expo's online recommendations can point at patches published that same day. This can cause an online dependency fix to fail even when the prior SDK patch is compatible.

**How to apply:** Align shared catalog versions deliberately and check the web app when React changes. Do not leave the release-age safeguard disabled or mask mismatches using Expo exclusions. Preserve Metro's workspace resolution behavior, but reassess old Babel internal imports against the target SDK instead of carrying them forward blindly.
