# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase (reports, help_requests, feedback) + Replit PostgreSQL/Drizzle (sessions, users for auth)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Test data (keep out of production!)

E2E/smoke checks must never leave rows in the production Supabase database. Two mechanisms:

1. **Isolated test DB (preferred)**: run the API server with `NODE_ENV=test` and set `SUPABASE_TEST_URL` + `SUPABASE_TEST_SERVICE_ROLE_KEY` to a dedicated test Supabase project — `artifacts/api-server/src/lib/supabase.ts` picks them up automatically.
2. **Tag + auto-teardown (when no test DB is configured)**: any test-created row MUST be tagged:
   - reports: `farm_name` starts with `E2E-`, or `user_id` = reserved test UUID `00000000-0000-4000-8000-000000000e2e`
   - help_requests: `description` starts with `[E2E]`
   - feedback: `message` starts with `[E2E]`

   Then run `pnpm run cleanup:test-data` (or `node scripts/cleanup-test-data.mjs`, add `--dry-run` to preview) as the teardown step — it deletes all tagged rows via the service-role PostgREST API. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS (credentials: true), cookieParser, JSON/urlencoded parsing, authMiddleware, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`); `src/routes/auth.ts` exposes auth endpoints
- Auth: `src/lib/auth.ts` — OIDC config, session CRUD (PostgreSQL); `src/middlewares/authMiddleware.ts` — loads user from session on every request, patches `req.isAuthenticated()`
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)

Browser auth helper for Replit Auth (OpenID Connect with PKCE). Provides a `useAuth()` hook that returns `{ user, isLoading, isAuthenticated, login, logout }`. The `login()` function redirects to `/api/login?returnTo=<BASE_URL>` and `logout()` redirects to `/api/logout`. Do NOT use generated API client code for auth — always use this package.

### `artifacts/irrigbucket` (`@workspace/irrigbucket`)

Mobile-first React+Vite web app for NZ dairy farmers to conduct irrigation bucket tests.

**Technology**: React 18, Vite 7, TypeScript, Tailwind CSS, shadcn/ui, Zustand (state, persisted to localStorage), Zod + react-hook-form (forms), Recharts (bar chart), framer-motion (animations), Wouter (routing), vite-plugin-pwa (offline/installable PWA)

**Routes / Pages:**
- `/` — Home: irrigator type selector (6 types)
- `/setup` — SystemSetup: enter system specs
- `/plan` — TestPlan: view/edit bucket test plan
- `/operation` — Operation (Centre Pivot only, Step 4/6): record machine operational data
- `/data` — DataEntry: enter bucket volumes (grouped by section for pivot)
- `/results` — Results: DU calculation, section breakdown, charts, logged data. Auto-saves to localStorage and syncs to server DB if authenticated.
- `/reports/:id` — SavedReport: view a saved report with Download PDF button (browser print)
- `/admin` — Admin panel: view all user reports and help requests. Requires `ADMIN_USER_ID` env var in production; any authenticated user in development.

**Server-side report storage:**
- When user is logged in, reports are saved to the `reports` DB table (POST /api/reports) in addition to localStorage
- GET /api/reports returns the authenticated user's reports; cloud-only reports shown with a cloud icon in the SideMenu

**Help requests ("Can't find report"):**
- SideMenu has a "Can't find your report?" link that expands an inline form
- Submits to POST /api/help-requests (no auth required)
- Admin panel shows all open/resolved help requests with a "Resolve" button

**Admin access setup:**
- Set `ADMIN_USER_ID` environment variable to your Replit user ID (visible on the /admin page if access is denied)
- In development, all authenticated users have admin access

**Offline / PWA:**
- `vite-plugin-pwa` generates a service worker that pre-caches all app assets at first load (active in production builds only; dev mode uses in-memory). Once cached, the full app runs without any internet connection.
- Zustand store uses `persist` middleware (key `irrigbucket-draft`) so every field the farmer fills in is automatically saved to localStorage. Data survives browser refreshes and app restarts.
- `OfflineIndicator` shows an amber banner when offline ("your data is saved on this device") and a green banner for 3 s when reconnecting.
- PWA manifest + apple-touch-icon allow "Add to Home Screen" install on iOS and Android.

**Key files:**
- `src/lib/calculations.ts` — All calculation logic: `calculatePlan()`, `calculateTestResults()`, `sectionsFromPivot()`, DU formula (1−CV)
- `src/lib/store.ts` — Zustand store with persist middleware: irrigatorType, systemParams, plan, volumes, sections, pivotSections, operationData
- `src/components/layout/AppLayout.tsx` — Shared layout with progress bar (accepts step + totalSteps)
- `src/components/ui/OfflineIndicator.tsx` — Animated online/offline status banner

**Centre Pivot flow (6 steps, /setup → /plan → /operation → /data → /results):**
- Auto-calculates 3 sections from pivot length: Section A (inner ¼, excluded), Section B (mid ½, ~21m spacing), Section C (outer ¼, ~11m spacing), End Gun (3 buckets at 5m if present)
- Reference: 590m pivot → 15+14+3 = 32 buckets, DU≈0.63

**Other irrigator types (5 steps, no /operation):** Lateral Move, K-Line/Pods, Travelling Gun, Solid Set/Fixed, Boom Spray

**DU thresholds:** ≥80% Pass, 65–79% Attention, <65% Fail

## Uptime monitoring (cloud sync alerts)

A scheduled GitHub Actions workflow (`.github/workflows/health-check.yml`) pings the deployed API's deep health check `https://irrigbucket.co.nz/api/health` every 10 minutes:

- **Keeps Supabase awake**: the ping queries the database, so the free-tier Supabase project never auto-pauses from inactivity.
- **Alerts the owner**: the endpoint returns 503 when Supabase is paused/unreachable; the workflow retries 3× (30 s apart) and then fails, and GitHub emails the repo owner a workflow-failure notification (default GitHub notification settings).
- The workflow can also be triggered manually from the repo's Actions tab (`workflow_dispatch`).
- Note: GitHub disables scheduled workflows after ~60 days without repo activity — an occasional push keeps it alive.
- Note: the check will (correctly) fail while the app is unpublished or its latest build failed — the production URL must be serving for it to pass.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
