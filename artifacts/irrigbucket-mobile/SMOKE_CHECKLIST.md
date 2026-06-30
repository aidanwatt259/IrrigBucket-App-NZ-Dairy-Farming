# IrrigBucket Mobile — Offline-First Smoke Checklist

Manual, on-device verification of the mobile-specific behaviors the web Playwright
e2e **cannot** cover: AsyncStorage→SQLite migration, NetInfo offline/online,
expo-sqlite durability, and mobile auth gating (UUID rekey + token-epoch fence).

The shared sync engine is already covered by `test-sync` (23) and server
last-write-wins by `test-api` (11). This checklist validates the native wiring on top.

## Prerequisites
- Run on a **real device or simulator** (iOS Simulator / Android emulator) via Expo
  Go or a dev build. Avoid Expo **web**: wa-sqlite persistence is degraded under the
  proxied iframe (no SharedArrayBuffer), so it is not a faithful offline-first test.
- A throwaway **email/password** account for the auth steps.
- A way to confirm server state: the saved-reports list under the signed-in account,
  or a direct query of the `reports` table.

Legend: `[ ]` = to verify.

## 1. Launch & baseline
- [ ] App boots with no redbox / crash.
- [ ] Saved-reports list renders (empty or with existing reports).

## 2. Legacy migration (AsyncStorage → SQLite) — only when upgrading over an old install
- [ ] With legacy AsyncStorage reports present, first launch runs the one-time migration.
- [ ] Every pre-existing report appears in the list (count matches) — **no data loss**.
- [ ] Migrated reports show as **not yet synced** (queued) while anonymous.
- [ ] Legacy non-UUID ids are rekeyed (reports still open; later push succeeds, not rejected).
- [ ] Relaunch does **not** duplicate migrated reports (migration is idempotent).

## 3. Offline create + queue (airplane mode)
- [ ] Enable Airplane mode (or turn off Wi-Fi + cellular).
- [ ] Complete a bucket test and save a new report.
- [ ] Report appears **immediately** in the list (local write succeeds offline).
- [ ] Sync/offline indicator reflects offline + a pending item.

## 4. Online drain
- [ ] Disable Airplane mode (restore network).
- [ ] The queue drains **automatically** within a few seconds (no manual action).
- [ ] Indicator returns to synced/idle; pending count → 0.
- [ ] Confirm the report now exists **server-side** (under the account / in `reports`).

## 5. Auth gating + UUID rekey
- [ ] While anonymous, create a report → it stays local/queued (NOT on the server).
- [ ] Sign in (email/password) → anonymous reports rekey to UUID and push under your user id.
- [ ] The previously-anonymous report now appears server-side, owned by the account.

## 6. Sign-out fence + privacy
- [ ] Sign out → local reports remain visible (not wiped).
- [ ] Only the session id is persisted — no email/PII stored. Relaunch shows signed-out state.
- [ ] (If testable) Start a sync right as you sign out → no late completion corrupts the
      outbox (token-epoch fence); signing back in re-pushes cleanly with **no duplicates**.

## 7. Optimistic offline sign-in
- [ ] Signed in, then go offline and relaunch → app trusts the stored session, shows
      signed-in, data available.
- [ ] Go online with an invalidated session → app signs out but **keeps local data**.

## 8. Durability across relaunch
- [ ] Force-quit and relaunch (both online and offline) → all reports persist
      (expo-sqlite); sync state is consistent.

## 9. Connectivity churn (stress)
- [ ] Toggle offline/online several times while reports are pending → no crash; the queue
      eventually drains; **no duplicate server rows** (upserts are idempotent on `id`).

## 10. Conflict / last-write-wins (optional)
- [ ] Edit the same report from two sources (device + server, or two devices) → the newer
      `clientUpdatedAt` wins after sync; no corruption.

## Pass criteria
Every box behaves as described; no data loss across migration, offline→online, sign-out,
or relaunch; and no duplicate server rows.
