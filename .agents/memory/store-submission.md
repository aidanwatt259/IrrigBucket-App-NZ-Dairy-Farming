---
name: IrrigBucket store submission (App Store / Google Play)
description: Privacy/security posture and outstanding blockers for shipping the mobile app to the app stores.
---

# IrrigBucket mobile — store submission readiness

## Security posture (already sound)
- App requests ZERO runtime permissions (`app.json` android.permissions: []; no iOS usage strings). No trackers/analytics/ads/crash-repoting SDKs → simplifies Apple ATT and Google Data Safety to "no tracking".
- Transport is HTTPS-forced; Supabase url + anon key are NOT hardcoded — fetched at runtime from api-server `/api/config`.
- Session id (`sid`): mobile stores it in expo-secure-store (AsyncStorage fallback on web) and sends it as `Authorization: Bearer`. Web clients use an httpOnly cookie.
- Server redacts auth/cookie headers from logs (pino redact list).

## CORS is NOT an exploitable hole — do not "panic-fix" it
- api-server uses `cors({ credentials: true, origin: true })` (reflects any origin).
- **Why it's safe:** the session cookie is set `httpOnly + secure + sameSite:"lax"`, so browsers won't attach it to cross-site fetch/XHR — Lax blocks the CSRF path. Mobile uses a Bearer token (no cookie, no browser). Rate it low/defense-in-depth, not critical.
- **How to apply:** if you tighten CORS to an allowlist, you must know every deployed web origin or you'll break the web app; only do it with the deploy domains in hand.

## Outstanding store BLOCKERS (need user input before building)
1. **No privacy policy** — both stores require a hosted URL. App collects farm/assessor/irrigator names + account email/first/last name (Supabase Auth) synced to Supabase. Content + hosting is a product decision.
2. **No in-app account deletion** — app creates real accounts (Supabase Auth, email/password) but only offers Sign out. Apple Guideline 5.1.1(v) requires account-based apps to let users initiate deletion in-app; needs a server delete endpoint + UI.

## Minor
- `expo-location` is in mobile package.json (~19.0.8) but UNUSED (no getCurrentPositionAsync / Location.* calls). Safe to remove to keep the bundle clean and avoid review questions.
- Dependency audit: 38 advisories (0 critical / 19 high / 14 mod / 5 low) — ALL in build/dev tooling (babel, vite, esbuild, xmldom, ws, undici, tar, postcss, uuid, form-data). None ship in the RN app bundle; none block submission.
