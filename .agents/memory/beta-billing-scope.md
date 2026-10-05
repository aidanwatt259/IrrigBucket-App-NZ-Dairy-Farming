---
name: Beta billing and Apple sign-in scope
description: User constraints on publishing subscriptions and exposing Apple sign-in during beta.
---
Do not publish subscription changes or enable payment prompts for beta testers without the user's approval.

**Why:** The user does not want beta testers to receive a subscription prompt yet.

**How to apply:** Keep billing UI work in preview; do not treat a successful test or Git push as permission to publish or enable the paywall.

Keep the Apple sign-in option hidden for now.

**Why:** The user has not connected Apple login yet.

**How to apply:** Restore the option only when Apple login is configured and the user wants it available.
