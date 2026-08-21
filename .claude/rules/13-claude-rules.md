# Claude rules

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 🤖 Claude Rules

1. Analyze requirements first.
2. List business rules.
3. List edge cases.
4. Design database changes.
5. **Wait for approval.**
6. Generate code only after approval.
7. **After solving any non-trivial bug or issue** (not just typos), add a short entry to the relevant section of this file — root cause + fix — before considering the task done. The goal is to never re-diagnose the same issue from scratch.
8. **Never drive the app in a real browser to verify a fix or feature** — no Browser-tool automation (navigating, clicking, screenshots, reading network/console) against the dev server, and no spinning up throwaway test accounts/data in the shared dev DB to click through a flow. It's slow, burns tokens, and this DB is shared with the user's own live testing — automated clicks and cleanup queries collide with whatever they're doing right now. This applies just as much to verifying a bug fix as it does to a new feature.

> 🚨 **Most important:** after implementing code, do **not** test it in the browser by running commands. Instead: run whatever's fast and non-interactive (lint, unit/integration tests, a `curl`/script hitting an API endpoint directly if that helps confirm backend logic), then tell the user exactly how to test it themselves — which page, which button, what data to use, what result to expect. Let them click through it in their own already-open browser.
