---
name: IrrigBucket architecture
description: Persistence model, where derived metrics belong, and the mobile setup-form wiring gotcha for the web+mobile irrigation bucket-test app.
---

# IrrigBucket (web + mobile) architecture notes

## Persistence is a JSON blob — no DB migration for new SystemParams fields
Saved reports store the whole `systemParams` object as JSON: web via `localStorage`
(`src/lib/savedReports.ts` + `src/lib/store.ts`), mobile via `AsyncStorage`
(`context/WizardContext.tsx`, `SavedReport`). The api-server/Postgres is NOT used to
persist report contents.
**Why:** adding a new *optional* field to the `SystemParams` interface flows through
automatically and is backward-compatible — old saved reports just lack the key.
**How to apply:** to add a per-test/system input, add an optional field to
`SystemParams` in BOTH `artifacts/irrigbucket/src/lib/calculations.ts` and
`artifacts/irrigbucket-mobile/lib/calculations.ts`; do not write a migration.

## Derived/conditional metrics belong in the REPORT layer, not calculateTestResults
`calculateTestResults` is shared by all 6 irrigator types and drives DU. Don't fold
type-specific math into it. Compute derived numbers in the report via small pure
helpers (existing pattern: pivot intensity from `revolutionTime`; K-Line
application depth via `calcKlineApplication`). Helpers return `null` when their
optional inputs are absent so the report falls back to default rendering.
**Why:** keeps the uniformity/DU logic stable across all types and keeps new
features additive + backward-compatible.

## Mobile setup form has FOUR places to wire each field — easy to miss persistence
`artifacts/irrigbucket-mobile/app/setup.tsx` needs a new field added in all four:
1) `values` state defaults, 2) `validate()`, 3) the `setSystemParams({...})` call in
`handleNext` (the persistence step — easy to forget), 4) the JSX `FormField`.
Forgetting #3 makes the field a silent no-op (user types it, it's discarded).
Web (`src/pages/SystemSetup.tsx`) uses react-hook-form + zod; for optional numeric
inputs use `z.preprocess(v => v===''||v==null ? undefined : v, z.coerce.number()....optional())`
to avoid `z.coerce.number()` turning `''` into `0`.

## K-Line application depth (NZ bucket-test method)
`rate(mm/hr) = caughtDepth / (testMinutes/60)`; `perSetDepth = rate * setHours`.
K-Line pods sit stationary up to ~24h per set, so a short timed bucket sample is
extrapolated. Sources: IrrigationNZ Bucket Test, DairyNZ bucket-test calculator,
RX Plastics K-Line. Caught depths are sub-millimetre, so display them to 2 dp in the
K-Line panels (1 dp made rate/caught look inconsistent).
