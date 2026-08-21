# Module 2 — leave types, entitlements & calendar

> Part of [Test Cases](README.md). If this disagrees with the code, the code wins.

---

## Module 2: Leave Types, Entitlements & Calendar

### ✅ Covered

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

### 🔴🟡 Gaps

- 🔴 **No test for a request spanning a year boundary actually debiting the start date's year** — this is an explicitly documented settled business rule (`.claude/rules.md`) but doesn't appear as its own assertion anywhere in `leaveRequests.test.js`. Given it's a rule a reviewer could specifically probe, worth a dedicated test.
- 🔴 **No test for deactivating a leave type's downstream effects** — what happens to existing pending/approved requests of that type, and does deactivation block new balance seeding for future hires? Currently only "hidden from non-HR listing" is tested.
- 🟡 No test for editing a leave type's entitlement value and its effect (or lack of effect) on already-existing balance rows for the current year.
- 🟡 No dedicated test that `counts_as_lop` is itself settable/validated at the leave-type API level (only its downstream payroll effect is tested).
- 🟡 No test for a holiday added *after* an already-approved leave request's dates — does the request's working-day count silently go stale?
- 🟡 No client test confirming `RequestLeaveForm` actually shows/hides the document upload field based on the selected leave type's `requires_document` flag.

---
