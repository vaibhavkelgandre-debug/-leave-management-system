# Module 4 — dashboards & reporting

> Part of [Functional Requirements](README.md). If this disagrees with the code, the code wins.

---

## Module 4: Dashboards & Reporting

### ✅ FR-022: Employee Dashboard

Employee can view:
- Leave balance
- Request history
- Personal calendar

*Leave balance and request history are both covered — the full detail lives on `MyBalancesPage.jsx` (balance cards + "My requests" history), and a condensed at-a-glance version lives on `DashboardPage.jsx` via `MyLeaveSummary.jsx`. The personal calendar is `MyLeaveCalendar.jsx` — a month-grid (same compact FullCalendar setup as `calendar/HolidayCalendar.jsx`) showing the employee's own SUBMITTED/APPROVED requests (amber/green dots) alongside public holidays (indigo dots), sitting next to the request list on `MyBalancesPage.jsx`. Clicking a request's dot highlights and scrolls to its row in the list below, the same click-to-select interaction `HolidaysPage.jsx` already used for holidays. Withdrawn/rejected/cancelled requests are deliberately left off the calendar (they never happened) but stay visible in the list, which shows full history regardless of status. Tested in `MyLeaveRequestList.test.jsx` (the selection/highlight behavior) and `MyBalancesPage.test.jsx` (the calendar actually mounts, and the click-to-highlight wiring).*

---

### ✅ FR-023: Manager Dashboard

Manager can view:
- Pending approvals
- Team calendar

*Pending approvals is done — the full list lives on `ApprovalsPage.jsx` (`/dashboard/approvals`, manager's direct reports; HR sees everyone with an override option), and `DashboardPage.jsx` surfaces a summary via `TeamOverviewSummary.jsx`. The team calendar is `TeamLeaveCalendar.jsx`, added directly to `ApprovalsPage.jsx` (sticky left column, same layout as the personal calendar on `MyBalancesPage.jsx`) rather than a separate page — it's fed whichever `requests` the page already fetched for the active tab (My Team / All Requests), so it's automatically scoped the same way for MANAGER, HR_ADMIN, and a delegate-employee alike, with zero new backend endpoints. Unlike the compact dot-only `HolidayCalendar.jsx`/`MyLeaveCalendar.jsx` style, each request renders as a small labeled bar ("Asha · Sick Leave", green/amber by status) since a team view needs to say *who* at a glance, not just *whether*; public holidays still render as compact indigo dots alongside. Clicking a bar highlights and scrolls to the matching row in `TeamRequestList.jsx` beside it, same click-to-select pattern used twice already (`HolidayCalendar`↔`HolidayList`, `MyLeaveCalendar`↔`MyLeaveRequestList`). Tested in `ApprovalsPage.test.jsx`.*

---

### ✅ FR-024: HR Dashboard

HR can:
- View all requests
- Filter by: Employee, Leave type, Status, Date range

Generate:
- Leave report

Download:
- CSV

*`HrReportsPage.jsx` (`/dashboard/reports`, HR-only), two tabs:*
- *Browse Requests: `GET /api/leave-requests` filters by `employeeId`/`leaveTypeId`/`status`/`startDate`/`endDate`, every combination resolved by a dynamic (still fully parameterized) SQL `WHERE` clause in `findLeaveRequestsFiltered` — never a client-side array filter over an already-fetched list, since that wouldn't hold up at the "200 employees, three years of history" scale NFR-7 asks for. Unlike `GET /leave-requests/all` (the Approvals page's read-only company-wide view), nothing is excluded by default — a `WITHDRAWN` request is exactly the kind of thing HR might filter *for* when browsing history, not dead weight to hide. Rendered with the existing `TeamRequestList` in `readOnly` mode.*
- *Leave Report: `GET /api/leave-requests/report?startDate&endDate` aggregates each employee's `APPROVED` requests overlapping the given period into one row (`findLeaveTakenReport` — total days taken, request count), shown as an on-screen table. `GET /api/leave-requests/report/csv` (same params, same underlying aggregation) streams the same data back as a downloadable CSV instead of the JSON envelope. A request that only partially overlaps the period is counted in full rather than pro-rated — the same kind of simplification as the year-boundary debit rule for balances, documented in `findLeaveTakenReport`'s own comment.*
- *Tested in `leaveRequestReporting.test.js` (backend: role gate, every filter individually and combined, the WITHDRAWN-inclusion difference from `/all`, the aggregation math, the CSV headers/filename/rows) and `HrReportsPage.test.jsx` (frontend).*

---
