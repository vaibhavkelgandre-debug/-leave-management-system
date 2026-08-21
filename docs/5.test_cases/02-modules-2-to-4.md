# Modules 2–4 — leave setup, requests & dashboards

> Part of [Test Cases](README.md). If this disagrees with the code, the code wins.

---

## Module 2 — leave types, entitlements & calendar

### Module 2: Leave Types, Entitlements & Calendar

#### ✅ Covered

**Server — `leaveTypes.test.js`**
- 401 unauthenticated; HR creates an active leave type; non-HR rejected (403)
- Rejects a duplicate name, case-insensitively (409); rejects a non-0.5-multiple entitlement (422)
- Hides inactive types from non-HR; HR sees them with `includeInactive=true`

**Server — `leaveBalances.test.js`**
- 401 unauthenticated
- Self-heals a missing balance row for a leave type created after the employee existed
- Backfills balance rows for every active employee when HR creates a new leave type
- Seeds balances for a newly invited employee
- Manager can view a subordinate's balances; 403 for an unrelated employee

**Server — `holidays.test.js`**
- 401 unauthenticated; HR can create/update/delete; non-HR rejected (403)
- Multi-day range creation; rejects exact-duplicate or overlapping ranges (409)
- Year-filtering, including a holiday whose range spans a year boundary counting for both years

**Server — `workingDayService.test.js` (unit)**
- Plain Mon–Fri week = 5 days; weekend exclusion; all-weekend range = 0
- Single-day and multi-day holiday exclusion, without double-subtracting a holiday that's already a weekend day
- Half-day at start, half-day at end, half-day at both ends of a multi-day request
- Single-day half-day request = 0.5; a half-day flag on a non-working boundary day is ignored

**Client — `HolidayCalendar.test.jsx`, `HolidayForm.test.jsx`, `HolidayList.test.jsx`, `LeaveTypesPage.test.jsx`, `MyBalancesPage.test.jsx`, `LeaveBalanceCard.test.jsx`, `dates.test.js`**
- Multi-day holidays render one dot per day (FullCalendar quirk workaround); tooltip content; empty state
- Create/edit form: single vs. multi-day, day-count preview, native + server-side backwards-range rejection, overlap error surfaced
- List: day-count badge only for multi-day, "Passed" badge, edit/delete wiring, HR-only controls
- Leave types page: list/create/edit/toggle-active
- Balances page: calendar + request list integration, dot-click highlighting, year-scoped holiday fetch, "show all/less" balance cards
- Balance card rendering; date utilities (`toDateKey` timezone-safety, range formatting, `eachDateKeyInRange` including month-boundary spans)

#### 🔴🟡 Gaps

- 🔴 **No test for a request spanning a year boundary actually debiting the start date's year** — this is an explicitly documented settled business rule (`.claude/rules.md`) but doesn't appear as its own assertion anywhere in `leaveRequests.test.js`. Given it's a rule a reviewer could specifically probe, worth a dedicated test.
- 🔴 **No test for deactivating a leave type's downstream effects** — what happens to existing pending/approved requests of that type, and does deactivation block new balance seeding for future hires? Currently only "hidden from non-HR listing" is tested.
- 🟡 No test for editing a leave type's entitlement value and its effect (or lack of effect) on already-existing balance rows for the current year.
- 🟡 No dedicated test that `counts_as_lop` is itself settable/validated at the leave-type API level (only its downstream payroll effect is tested).
- 🟡 No test for a holiday added *after* an already-approved leave request's dates — does the request's working-day count silently go stale?
- 🟡 No client test confirming `RequestLeaveForm` actually shows/hides the document upload field based on the selected leave type's `requires_document` flag.

---

---

## Module 3 — leave requests & approval

### Module 3: Leave Requests & Approval Workflow

#### ✅ Covered

This is the most thoroughly tested module in the app — and it explicitly satisfies the deliverable checklist from `.claude/rules.md` (working-day calc, balance after approve/cancel/override, overlap detection, illegal-transition rejection, manager-outside-team, self-approval, delegate-after-window-ends — **all present**, see below).

**Server — `leaveRequests.test.js`**
- 401 on `/mine`
- Preview: computes days without persisting; excludes holidays
- Submit: valid submission moves days to pending; rejects zero-working-day ranges (400), overlapping requests (409), negative-balance-inducing requests (400) unless the type allows it
- Lifecycle: approve moves pending→taken; reject releases the pending hold; withdraw (self, pending only) releases the hold; cancel (self, future approved only) zeroes both; rejects cancelling an already-past approved request (400); rejects an illegal transition — approving an already-withdrawn request (409)
- Override: HR overrides rejected→approved correctly moving days; rejects override from non-HR (403)
- **Authorization matrix**: manager outside the team → 404; self-approval → 403; delegate after window ends → 404; delegate within an active window → 200; HR attempting direct approval when the employee has their own manager → 403 (not 404); HR who genuinely is the assigned manager can still approve directly; HR outside their own subtree → 404 (both approve and override); override with no comment → 422
- Listing: `/mine` scoped to self; `/team` scoped to direct reports (manager) or subtree (HR), excluding another HR branch; empty array (not 403) for an employee with no reports/delegation; delegated-for team merged into `/team`
- `/all`: company-wide for HR including other branches; rejected for non-HR (403)
- Audit trail: every transition recorded with actor + comment; records both actor and acted-for identity on a delegate action; names resolved, not raw ids

**Server — `dashboardCounts.test.js`**
- `pending-count` counts a manager's own direct reports' `SUBMITTED` requests and nobody else's, stops counting once a request is decided, and is `0` (not an error) for an employee with no reports
- For HR it counts only what HR is the assigned manager for, not their whole branch
- An active delegation adds that manager's requests to the delegate's count; without one it's `0`
- `on-leave-today` returns only approved leave overlapping today within the caller's team (a pending request dated today and an approved one dated later are both excluded), is company-wide for `SUPER_ADMIN` and branch-scoped for HR, and `[]` for an employee with no team
- `/users/me/team/count` matches `GET /users/me/team`'s own length exactly, and is `0` for someone with no reports

**Server — `leaveRequests.test.js`** (team list pagination and windowing)
- Defaults to one page and reports the total; `offset` honoured with no overlap between pages
- A window returns every request overlapping it, unpaged, and excludes anything outside it
- Rejects a half-open window, a backwards one, one longer than the 62-day cap, and a `limit` above 100

**Server — `salarySlips.test.js`** (pagination)
- The HR list pages with `{ slips, total }`, `total` follows the filters, `/mine` stays a bare unpaginated array, and an over-cap `limit` is 422

**Server — `usersScope.test.js`** (picker projection)
- `GET /users/options` returns only id/name/role/status — the sensitive columns aren't merely masked, they're absent
- Scopes identically to `GET /users` (company-wide for HR, subtree for a manager, self for an employee), and 401s unauthenticated

**Server — `leaveRequestReporting.test.js`** (pagination)
- One page plus the total for the same filters, `offset` honoured, no overlap between pages, newest first
- `total` counts the *filtered* set, not the whole scope
- A `limit` above the cap and a negative `offset` are both `422`

**Server — `leaveRequestReporting.test.js`** (SUPER_ADMIN reporting scope)
- `GET /leave-requests` covers every branch for `SUPER_ADMIN`, including employees it has no HR-write scope over, and an `employeeId` filter for one of them resolves
- `GET /leave-requests/report` includes a deep employee's approved days for `SUPER_ADMIN`, while an `HR_ADMIN`'s report still excludes another branch entirely

**Server — `leaveRequests.test.js`** (company-wide scoping)
- `GET /all` returns every branch's requests for `SUPER_ADMIN`, and **403s an `HR_ADMIN`**
- `GET /:id` is subtree-scoped for `HR_ADMIN` (404 for another branch's request, 200 for their own) while staying company-wide for `SUPER_ADMIN`, so every row of that list stays openable

**Server — `leaveRequestDocuments.test.js`**
- Rejects missing document when required (400); rejects content that isn't really PDF/JPG/PNG regardless of filename (400)
- Accepts a valid PDF; visible only to requester/manager/HR (404 for an outsider)
- Streamed download with correct headers, never the raw signed URL; 404 for no-document metadata lookups

**Server — `leaveRequestReporting.test.js`**
- Browse (`GET /leave-requests`): rejects non-HR (403); filters by employee/type/status (including `WITHDRAWN`, unlike `/all`)/date-range overlap; rejects `endDate < startDate` (422); scoped to caller's own subtree
- Report: rejects non-HR (403); requires both dates (422); sums approved days/count correctly, excludes non-approved statuses, counts partial-overlap requests in full, scoped to subtree
- CSV: rejects non-HR (403); correct content-type/filename/headers/rows

**Server — `delegations.test.js`**
- 401 unauthenticated; rejects non-manager (403); nominate + list via `/mine`; rejects self-delegation (400); rejects overlapping delegation dates (409); `/mine` scoped to the caller only
- `/as-delegate`: 401 unauthenticated; open to a plain employee; empty for nobody-delegated-to; excludes rows where the caller is the nominating manager, not the delegate

**Client — `ApplyLeavePage.test.jsx`, `RequestLeaveForm.test.jsx`, `MyLeaveRequestList.test.jsx`, `RequestActions.test.jsx`, `RequestDetailModal.test.jsx`, `TeamRequestList.test.jsx`, `LeaveRequestTable.test.jsx`, `ApprovalsPage.test.jsx`, `DelegationForm.test.jsx`, `DelegateStatus.test.jsx`, `DelegationStatus.test.jsx`, `validation.test.js`**
- Dedicated apply-leave route (not a modal); router-state hand-off of the new request's date back to the balances calendar
- Form: type list, live working-day preview, backwards-range guard, submission wiring, server-error surfacing without clearing the form
- Own request list: withdraw/cancel action visibility rules by status and date, decision comment display, calendar-selection highlighting, notification-driven auto-open of the detail modal
- Actions: status-appropriate approve/reject/override buttons, `iconOnly` variant parity, HR-vs-assigned-manager visibility rules **including the `SUPER_ADMIN`-specific case** (hidden unless SUPER_ADMIN is genuinely the assigned manager)
- Detail modal: full data + audit history + balance-in-context + document view/download + inline actions, `readOnly` suppression
- Team list: approve/reject/override wiring, delegated-team badge logic, `readOnly` mode for the All Requests tab
- Read-only browse table; Approvals page tab switching (My Team vs. All Requests) and per-role tab visibility
- Delegation form/status widgets, including multiple simultaneous active delegations

#### 🔴🟡 Gaps

- 🔴 **No test for balance correctness across a long, mixed sequence of actions.** NFR-2 is explicitly the top review criterion ("a balance must never drift... after ANY sequence of approvals, cancellations and overrides") — existing tests each check one or two-step sequences in isolation, not a longer randomized/chained sequence (e.g., submit → approve → HR override to rejected → re-override to approved → cancel).
- 🔴 **No test for a genuine race condition on the overlap check** — two near-simultaneous submissions for the same employee/overlapping dates. All current tests are sequential Supertest calls; nothing proves the overlap check is safe under real concurrent requests (a DB-level exclusion constraint would close this regardless of test coverage — worth checking if one exists).
- 🟡 No test that a `REJECTED` request cannot later be `CANCELLED` (only the `WITHDRAWN`→`APPROVED` illegal transition is explicitly tested).
- 🟡 No test of what happens to an attached document after its parent request is withdrawn/cancelled (does it remain viewable?).
- 🟡 No test of CSV escaping for a comma or a double-quote inside a free-text field (reason/comment) in the exported report.
- 🟡 No test for a holiday being added between a `/preview` call and the actual `POST /leave-requests` submission — could the previewed day-count and the charged day-count disagree?

---

---

## Module 4 — dashboards & reporting

### Module 4: Dashboards & Reporting

#### ✅ Covered

**Server**: No dedicated integration test file — Module 4 introduces no new authorization logic of its own; it composes already-tested Module 1/3 endpoints (user list, team leave requests, reports). Coverage is indirect via those modules' own tests.

**Client — `DashboardPage.test.jsx`, `MyLeaveSummary.test.jsx`, `TeamOverviewSummary.test.jsx`, `HrReportsPage.test.jsx`**
- Dashboard: manager/HR display without duplication when the manager is also HR; nothing extra for a manager-less root HR admin
- My-leave summary tile: balance chips with distinct accents, pending count, next upcoming leave, most recent decision
- Team overview tile: headcount, pending-approvals review link (and its absence), who's out today (including half-day formatting)
- HR Reports page: Browse Requests tab (filtering, employee search, read-only), Leave Report tab (generate/empty-state/CSV link/disable-until-both-dates/Clear/one-click presets)

#### 🔴🟡 Gaps

- 🔴 **No test of dashboard behavior specifically for `SUPER_ADMIN`.** `superAdmin.test.js` proves the service-layer scoping (direct reports only), but no client test confirms `TeamOverviewSummary`/`DashboardPage` correctly reflect that narrower scope when rendered for a `SUPER_ADMIN` viewer, as opposed to a full-subtree `HR_ADMIN`.
- 🟡 No test confirming the HR Reports CSV **download link's actual file content** is correct — reasonable, since that's a real browser navigation outside RTL's reach, but worth a manual QA checklist item.

---
