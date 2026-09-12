---
name: Git history and authorization
description: Constraints for reconciling Cursor and Replit histories and diagnosing GitHub write authorization.
---

Preserve the reconciled application tree and both original histories when establishing shared Cursor/Replit ancestry. Use a canonical commit descended from the existing GitHub branch; verify its remote tree before aligning the local branch. Do not omit the uptime-monitor workflow to bypass authorization.

**Why:** The two environments had unrelated histories. The user chose to reconnect GitHub rather than drop the workflow.

**How to apply:** Back up both sides, verify current remote refs before any update, avoid force pushes, and compare tree hashes before changing local history. Normal subsequent work should pull shared history before editing, not recreate the repository from a ZIP.

Treat OAuth API authorization and Git-provider transport authorization separately.

**Why:** During the September 2026 investigation, OAuth API blob writes and ordinary tree creation succeeded, while a tree containing a GitHub Actions workflow returned 404. The available OAuth scopes omitted workflow permission. Git CLI pushes independently returned invalid-credential errors despite a healthy reported Git-provider connection. Reconnecting Git Providers and reloading the workspace did not resolve that error; a stale session was only a hypothesis, not a confirmed cause.

**How to apply:** Check current permissions and runtime errors instead of trusting connection status alone. Do not repeat reconnect/reload loops without new evidence. Consider transferring the canonical commit to an already-authenticated local Git client rather than weakening the target tree. Throttle connector requests below the observed 10 requests/second limit.