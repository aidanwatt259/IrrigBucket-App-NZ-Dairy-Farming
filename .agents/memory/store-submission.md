---
name: IrrigBucket store submission (App Store / Google Play)
description: Privacy/security posture, resolved blockers, and the account-deletion design rules for shipping the mobile app to the app stores.
---

# IrrigBucket mobile — store submission readiness

## Security posture (already sound)
- App requests ZERO runtime permissions (`app.json` android.permissions: []; no iOS usage strings). No trackers/analytics/ads/crash-reporting SDKs → simplifies Apple ATT and Google Data Safety to "no tracking".
- Transport is HTTPS-forced; Supabase url + anon key are NOT hardcoded — fetched at runtime from api-server `/api/config`.
- Session id (`sid`): mobile stores it in expo-secure-store (AsyncStorage fallback on web) and sends it as `Authorization: Bearer`. Web clients use an httpOnly cookie.
- Server redacts auth/cookie headers from logs (pino redact list).

## CORS is NOT an exploitable hole — do not "panic-fix" it
- api-server uses `cors({ credentials: true, origin: true })` (reflects any origin).
- **Why it's safe:** the session cookie is set `httpOnly + secure + sameSite:"lax"`, so browsers won't attach it to cross-site fetch/XHR — Lax blocks the CSRF path. Mobile uses a Bearer token (no cookie, no browser). Rate it low/defense-in-depth, not critical.
- **How to apply:** if you tighten CORS to an allowlist, you must know every deployed web origin or you'll break the web app; only do it with the deploy domains in hand.

## Store blockers — NOW RESOLVED (built this round)
1. **Privacy policy** — a public web page now exists on the web artifact at `/privacy` (no auth). Both stores can point at its hosted URL. Content matches actual data practices (farm/assessor/irrigator names + account email/first/last name via Supabase Auth).
2. **In-app account deletion** — implemented end to end: auth-guarded server DELETE endpoint (hard-deletes reports/help_requests/feedback + user row + all sessions + best-effort Supabase auth user), plus a reachable two-step confirm UI on the mobile account screen. Required by Apple Guideline 5.1.1(v) and Google Play.

### Account-deletion must be reachable in the UI (not just an endpoint)
Caught late once: endpoint + context method + local purge all existed but the
account screen never wired a button, so the feature was invisible and would have
failed review. When "done," confirm the *UI path*, not just the backend.

### Delete-account failure handling: never resurrect data
Rule: if the server delete succeeds but the subsequent local wipe fails, force the
local session closed and do NOT re-enable sync.
**Why:** the sid is invalid the instant the account is deleted; re-enabling sync
drains the outbox against a null caller and the server recreates the reports as
anonymous rows — silently undoing "delete everything."
**How to apply:** track a `serverDeleted` flag across the flow so the catch branch
diverges (offline/never-reached-server → restore sync; already deleted → close
session, keep local reports, tell user to reinstall).

### Known narrow race (accepted, non-blocking)
A sync push already in flight at the moment of deletion can reach the server after
the sessions are gone; anonymous report inserts are permitted (caller null), so a
stray anonymous orphan row can be created. Requires an active upload at the exact
delete instant. Left open intentionally; only close it (e.g. wait for drain
quiescence before the delete call) if it actually recurs.

## Remaining before submission (needs user input)
- **Contact/privacy email is a PLACEHOLDER** — the web privacy page and both stores
  need a working, monitored inbox. Confirm the real address with the user.
- **`expo-location`** is in mobile package.json (~19.0.8) but UNUSED (no
  `Location.*` calls). An unused location permission draws review scrutiny. Removal
  was offered but NOT confirmed — confirm with the user before submitting.

## Minor (informational)
- Dependency audit: advisories are ALL in build/dev tooling (babel, vite, esbuild, xmldom, ws, undici, tar, postcss, uuid, form-data). None ship in the RN app bundle; none block submission.
