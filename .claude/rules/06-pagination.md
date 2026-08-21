# Pagination & count endpoints

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 📄 Pagination & Count Endpoints

> The app was audited for unpaginated list endpoints against NFR-7 ("responsive with 200 employees and three years of requests"). At that scale a leave-request row is ~0.7KB of JSON, so a company-wide request history is **thousands of rows and several megabytes**. Two classes of problem came out of it; this section records the rules that came with fixing them.

### Never fetch a list to derive a number from it

- **A count belongs in its own endpoint.** `GET /notifications/unread-count` was the existing example; `GET /leave-requests/pending-count` and `GET /users/me/team/count` were added for the same reason. Before them, the sidebar's Approvals badge downloaded the caller's entire team request history **on every page load** to display one integer, and the dashboard tile did the same plus a full 200-row subtree of users for a headcount.
- **The rule the client used to apply after downloading must move server-side unchanged.** `countPendingDecisions` is deliberately the same rule as `canDecideDirectly` was on the client: the employee's assigned manager is the caller, or a manager the caller is an active delegate for. A count that's fast and wrong is worse than the slow list it replaced, so the integration tests pin the *scoping*, not the performance.
- **Scope helpers get extracted, not copied.** `teamScopedEmployeeIds` in `leaveRequestService.js` is shared by `listTeamLeaveRequests` and `listOnLeaveToday` precisely so a dashboard tile and an approvals list can't drift into disagreeing about who's on the team.
- **These endpoints take no role gate.** They're scoped server-side exactly like `/team`, so an employee with nothing in scope gets `0`/`[]` rather than a `403` — same reasoning as `/team` itself.
- **`TeamOverviewSummary` has a regression test for this** ("never fetches a request list or the full team roster"). If a tile ever needs one more number, add another count endpoint; don't reach for the list.

### One pagination idiom, copied from notifications

- **Contract:** `limit`/`offset` query params, validated with `z.coerce.number()` (query strings are always strings), **defaulted** so a caller that asks for no page still gets a bounded one, and **capped** (`max(100)`) so nobody can request the whole table with `limit=100000`. Response is an envelope — `{ requests, total }` for leave requests, `{ notifications, total }` for notifications — never a bare array.
- **`total` is counted with the same WHERE as the page.** `buildFilteredWhere` in `leaveRequestRepository.js` exists so the list query and the count query cannot disagree about what they're counting. Don't inline the conditions into one of them.
- **Paginating without a supporting index is theatre.** A `LIMIT 25` over `WHERE employee_id = ANY(...) ORDER BY start_date DESC` still sorts the entire matching set unless an index provides that order — hence migration 037's `(employee_id, start_date DESC)`. Any new paginated list needs the same check, plus its `docs/3.db.md` entry.
- **Client side:** page size lives next to the fetch (`PAGE_SIZE`, currently 25 on both paginated screens), the pager renders only when `total > PAGE_SIZE` (a lone disabled prev/next pair is noise), and **applying or clearing a filter resets `offset` to 0** — a narrower filter can have fewer rows than the current offset, which renders an empty table that reads as "no matches".
- **`limit`/`offset` are optional at the repository layer, on purpose.** `findLeaveRequestsFiltered` omits them for callers that want the whole (already narrow) result set — `listOnLeaveToday`'s "approved, overlapping today". Applying a silent default cap there would truncate a caller that wasn't expecting pages.

### The window-or-page rule (team/approvals lists)

- **`GET /leave-requests/team` and `/all` take either a page or a window, never neither.** A page (`limit`/`offset`) for the list; a window (`startDate`+`endDate`) for the calendar, which needs a whole month at once — page 1 of a busy team is not "this month", and paginating the single fetch these screens used to share would have silently hidden calendar events.
- **A window is bounded by its own span, so it takes no `limit`** — but only because both dates are required together and the span is capped at 62 days (`MAX_WINDOW_DAYS`). Drop that cap and the window becomes the unbounded query the pagination existed to remove.
- **`ApprovalsPage` therefore makes two calls**, and `TeamLeaveCalendar` reports its visible grid (`activeStart`/`activeEnd`, guarded against re-notifying the same range) rather than just its year. Paging the list never refetches the calendar.
- **`findTeamLeaveRequests` replaced both `findLeaveRequestsForEmployees` and `findAllLeaveRequests`** — they only ever differed in whether an employee filter was applied, and `undefined` employeeIds already meant "no restriction" elsewhere in the file.

### Slim projections beat pagination for bounded-but-wide lists

- **`GET /users/options` exists because four dropdowns were fetching ~40 columns × 200 users** to render a name. The list is bounded by headcount, so pagination was the wrong tool — a five-column projection cuts ~90% with no UI change. `GET /users` stays for the All Employees roster, which genuinely displays those fields.
- **Reach for a projection first** when a list is bounded by headcount and wide; reach for pagination when it's unbounded by time.

### Still unpaginated, and known

Everything from the original audit is now done: the count endpoints, HR's browse view, the Approvals list + calendar split, `GET /salary-slips`, and the slim `GET /users/options`. What remains is bounded by headcount or by leave-type count and is fine as-is: `/leave-types`, `/holidays` (year-scoped), `/leave-balances/me`, `/employees/:id/documents`, `/delegations/*`, `/leave-requests/:id/audit`, every `/mine` endpoint, and `/report` + `/report/csv` (aggregated to one row per employee — and a CSV export *should* cover everything).

---
