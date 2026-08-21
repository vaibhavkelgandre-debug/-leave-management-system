# Module 4 — dashboards & reporting

> Part of [Test Cases](README.md). If this disagrees with the code, the code wins.

---

## Module 4: Dashboards & Reporting

### ✅ Covered

**Server**: No dedicated integration test file — Module 4 introduces no new authorization logic of its own; it composes already-tested Module 1/3 endpoints (user list, team leave requests, reports). Coverage is indirect via those modules' own tests.

**Client — `DashboardPage.test.jsx`, `MyLeaveSummary.test.jsx`, `TeamOverviewSummary.test.jsx`, `HrReportsPage.test.jsx`**
- Dashboard: manager/HR display without duplication when the manager is also HR; nothing extra for a manager-less root HR admin
- My-leave summary tile: balance chips with distinct accents, pending count, next upcoming leave, most recent decision
- Team overview tile: headcount, pending-approvals review link (and its absence), who's out today (including half-day formatting)
- HR Reports page: Browse Requests tab (filtering, employee search, read-only), Leave Report tab (generate/empty-state/CSV link/disable-until-both-dates/Clear/one-click presets)

### 🔴🟡 Gaps

- 🔴 **No test of dashboard behavior specifically for `SUPER_ADMIN`.** `superAdmin.test.js` proves the service-layer scoping (direct reports only), but no client test confirms `TeamOverviewSummary`/`DashboardPage` correctly reflect that narrower scope when rendered for a `SUPER_ADMIN` viewer, as opposed to a full-subtree `HR_ADMIN`.
- 🟡 No test confirming the HR Reports CSV **download link's actual file content** is correct — reasonable, since that's a real browser navigation outside RTL's reach, but worth a manual QA checklist item.

---
