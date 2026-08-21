# Cross-cutting — notifications, SUPER_ADMIN, shared UI

> Part of [Test Cases](README.md). If this disagrees with the code, the code wins.

---

## Cross-Cutting: Notifications

### ✅ Covered

**Server — `notifications.test.js`**
- 401 on every route; scoped strictly to the caller's own notifications (404 marking someone else's read)
- Unread count tracking, `/read-all`, idempotent re-marking
- Correct recipient + wording for: leave submission (manager, or HR when no manager), decision (including "(HR override)" suffix), withdraw/cancel, profile submit/verify/send-back round trip, salary slip confirmed/voided, manager reassignment (both parties, correct wording each, no-op suppressed), account activate/deactivate, salary structure update (**confirmed to never leak figures**), delegation nomination, team-member assignment + invite-accepted + the new employee's own profile-created prompt (all three from one invite/accept round trip), and the scheduled delegation start/end sweep (with dedup against repeat sweeps)

**Client — `NotificationBell.test.jsx`, `NotificationsPage.test.jsx`, `notificationRouting.test.js`**
- Badge count (including 9+ cap), empty state, click-to-navigate + mark-read, "mark all read" gating
- Full notifications page pagination (20/page, Previous/Next boundary states)
- Every notification type's deep-link destination mapped and tested, including the types with no dedicated page (fallback destinations)

### 🔴🟡 Gaps

- 🟡 **No test that a failing `notify*` call doesn't break its parent action.** This is a stated architectural guarantee (try/catch, never rethrown) but nothing deliberately breaks a notify call and asserts the triggering action still succeeds — cheap to add, protects a real guarantee.
- 🟡 No test of the bell's 30-second polling actually re-fetching over time (likely mocked around in existing tests).

---

## Cross-Cutting: SUPER_ADMIN

### ✅ Covered

**Server — `superAdmin.test.js`**
- Own leave request auto-approves (never `SUBMITTED`), correct ledger state (taken, not pending), single `AUTO_APPROVE` audit entry
- A direct-report `HR_ADMIN`'s own request goes through normal `SUBMITTED`→approved-by-SUPER_ADMIN-as-manager
- No override power under any circumstance (403)
- Scoped to direct-report `HR_ADMIN`s only — can verify a direct report's profile, cannot reach two levels down (404)
- Notified when a direct report submits their profile
- `HR_ADMIN` reporting to `SUPER_ADMIN` shows correctly in the company-wide user list

### 🔴🟡 Gaps

- 🟡 **The direct-report-only scoping principle is only independently tested via profile verification.** The same `isInActorsHrScope` helper is applied to salary structures, salary slips, and employee documents per `.claude/rules.md`, but none of those three has its own `SUPER_ADMIN`-scoped test proving the two-levels-down block holds there too.
- 🟡 (Manual, not automatable) No documented manual test of promoting an **existing** `HR_ADMIN` to `SUPER_ADMIN` via the one-off `UPDATE` statement — worth a one-time manual pass confirming a promoted account behaves identically to a freshly-bootstrapped one.

---

## Cross-Cutting: Shared UI / Layout

### ✅ Covered

**Client — `NavBar.test.jsx`, `Sidebar.test.jsx`, `TopBar.test.jsx`, `Tooltip.test.jsx`, `SearchSelect.test.jsx`, `Avatar.test.jsx`, `ProgressBar.test.jsx`**
- Role-based link visibility, delegate-driven reveal of Approvals, pending-approvals badge accuracy
- Collapsed-only hover tooltip behavior, portal-mode rendering/positioning/cleanup, `document.body` attachment
- Sidebar collapse/mobile-close callbacks, logo centering
- Top bar search filtering, identity dropdown, logout
- Searchable select combobox: filtering, keyboard interaction (Enter/Escape), click-outside revert
- Avatar initials, progress bar clamping

### 🔴🟡 Gaps

- 🟡 No automated accessibility (a11y) audit anywhere (no `axe-core`/`jest-axe`) — manual a11y fixes exist (collapsed-nav `aria-label`, `sr-only` toggle labels) but nothing guards against future regressions.
- 🟡 No test that the sidebar's collapsed/expanded preference actually **persists via `localStorage`** across a reload (only the toggle callback firing is tested).
- 🟡 No automated responsive/viewport test for NFR-8 (phone-width usability) — verified manually per `4.non_functional_requirements.md`.

---
