---
name: IrrigBucket build & typecheck hygiene
description: Why typecheck-web can go red on referenced libs, how lib dists work (gitignored), the isAdmin/AuthUser gap, and the anonymous-reports security follow-up.
---

# Build & typecheck gotchas (web)

## Referenced workspace libs need a BUILT, gitignored `dist/` for `typecheck-web`
The web app typecheck is `tsc -p tsconfig.json --noEmit`. Its tsconfig `references`
the workspace libs, which are `composite` and consumed via `exports → ./src/index.ts`.
Project-reference resolution still redirects imports to each lib's declaration output
(`dist/index.d.ts`). `dist` is **gitignored** and there is **no build script** in any
`package.json` — lib dists exist only because they were built once (e.g. `api-client-react`
via orval codegen). A lib whose `dist` is missing breaks the web typecheck.
- Symptom `TS6306` = referenced lib lacks `"composite": true`.
- Symptom `TS6305` = lib is composite but its `dist/*.d.ts` was never built.
**How to apply:** the lib's tsconfig must mirror the working sibling `api-client-react`:
`composite + declarationMap + emitDeclarationOnly + outDir dist/ rootDir src/`, then
build it once with `pnpm --filter @workspace/irrigbucket exec tsc -b ../../lib/<name>`.
A browser lib using `import.meta.env` also needs `"types": ["vite/client"]` in its own
tsconfig to build standalone (base tsconfig sets `types: []`).
**Why durable:** none of this is visible from reading code — the dist is gitignored,
the build isn't scripted, and a fresh checkout will fail typecheck-web until libs are
built. This bit twice before resolving.

## `isAdmin` is not in the OpenAPI-generated `AuthUser`, but the server sends it
`/api/auth/user` returns an `isAdmin` flag the generated `AuthUser` type does not model,
so `user?.isAdmin` (SideMenu, Admin) is a type error. Generated code + `lib/sync` are
frozen, so do NOT regenerate. Augment at the auth boundary instead:
`lib/replit-auth-web/src/use-auth.ts` exports `AuthUser = ApiAuthUser & { isAdmin?: boolean }`.
**Proper long-term fix (when unfrozen):** add `isAdmin` to the OpenAPI spec and regenerate,
then drop the augmentation.

## Validation gates: 7 registered, all green
`typecheck-api`, `typecheck-mobile`, `typecheck-web`, `build-api`, `build-web`
(`BASE_PATH=/ PORT=5000 ...`), `test-sync`, `test-api`. The heavy mobile Expo static
export is intentionally NOT a gate (deploy-only, needs Metro :8081, flaky).

## Pre-existing security follow-up: anonymous reports readable/overwritable by ID
`api-server` `GET/POST /reports/:id` let anyone who knows an id read or overwrite an
anonymous report (`user_id null`). UUID entropy mitigates new rows, but legacy/non-UUID
ids are guessable. Not introduced by the offline-first work; out of scope for validation.
Flagged to the user as a follow-up before relying on anonymous sync in production.
