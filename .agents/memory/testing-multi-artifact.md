---
name: Testing the Expo mobile artifact (multi-artifact repo)
description: How to point e2e/screenshot tools at the Expo mobile app instead of the default web app in this multi-artifact monorepo.
---

# Targeting the mobile Expo app in e2e tests

In this repo, path-based routing maps `/` on the default dev host to the **web** artifact (`artifacts/irrigbucket`), NOT the Expo mobile app. A `runTest`/screenshot plan that just says "navigate to path `/`" will silently test the wrong app (e.g. the web `SystemSetup` page, which lacks the mobile-only fields).

**Rule:** To test the Expo mobile artifact, navigate the browser to the **absolute** Expo dev URL: `https://${REPLIT_EXPO_DEV_DOMAIN}/` (get it via `echo $REPLIT_EXPO_DEV_DOMAIN`). Expo bypasses the shared proxy, so a bare path won't reach it.

**Why:** Discovered after an e2e run reported a fixed mobile field "missing" — the tester had loaded the web app instead. Retargeting to the Expo URL made the same test pass.

**How to apply:** In any `runTest` testPlan for the mobile app, hardcode the full `https://<...>.expo.picard.replit.dev/` URL in the navigate step and add a guard ("if you see the web-only Farm Name field on load, you're on the wrong app — re-navigate"). First load may show an expo-sqlite dev overlay on web (frozen offline-sync layer) — dismiss and continue; it's dev-only noise.
