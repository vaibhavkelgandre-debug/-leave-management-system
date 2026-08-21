# Who sees what

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 🚪 Who Sees What (access changes, direct requests)

> Three access decisions taken together, all on direct request. The per-endpoint matrix is [`docs/7.role_permissions_matrix.md`](../../docs/7.role_permissions_matrix.md) — **that file is the source of truth and must be updated with any further change**; this section records *why*, so none of it gets "fixed" back.

### Company-wide views belong to SUPER_ADMIN, not HR

- **All Employees** (`/dashboard/employees`) is `SUPER_ADMIN`-only, and **All Requests** (`GET /leave-requests/all`) now 403s for `HR_ADMIN`. An HR admin's view of both people and leave is their own branch: My Team, and the team-scoped approvals list.
- **`GET /leave-requests/all` was narrowed, not scoped, and that was deliberate.** Scoping it to the caller's subtree would have returned byte-identical rows to `GET /team`'s HR branch — a second name for the same list, and a tab in the UI that did nothing. Removing HR's access instead leaves exactly one way for HR to see leave.
- **`GET /leave-requests/:id` had to move with it.** An HR admin who can't see another branch's requests in a list shouldn't be able to fetch one by id — so that check is now subtree-scoped for `HR_ADMIN` while staying company-wide for `SUPER_ADMIN`, which is what keeps every row of SUPER_ADMIN's own list openable. `/:id/audit`, `/:id/document` and `/:id/document/download` all piggyback on it and moved for free.
- **`GET /users` was deliberately *not* narrowed.** HR still needs a company-wide user list for the invite form's manager picker and the payroll/slip filters, so the restriction is on the page, not the endpoint. Don't "finish the job" by scoping `listUsersFor` — it breaks both of those.
- **Two client details exist only because of this**, and both are the kind of thing that silently 403s a user if forgotten: `AddEmployeePage`'s back link points at My Team for HR (All Employees would bounce them to `/403`), and `notificationRouting`'s `INVITE_ACCEPTED` target moved from All Employees to My Team for the same reason. **Any new link to `/dashboard/employees` needs the same thought.**
- **`ApprovalsPage`'s two role flags are now opposite roles and must stay separate:** `canOverride` is `HR_ADMIN` (SUPER_ADMIN can never override), `canSeeAllRequests` is `SUPER_ADMIN`. They used to be one flag; merging them again gives HR a dead tab or SUPER_ADMIN buttons the server refuses.

### Dashboard, and SUPER_ADMIN's two different scopes

- **"On leave today" is a table (`OnLeaveTodayTable.jsx`), rendered identically for every role that sees it** — a super admin reading the whole company and an HR admin reading their own branch get the same columns, on direct request. It was a `<ul>` of wrapped chips, which stopped lining up once more than a couple of people were out.
- **`TeamOverviewSummary` has exactly one role branch: which endpoint feeds it.** `SUPER_ADMIN` reads `GET /leave-requests/all` (the company-wide list it alone may fetch); everyone else reads `/team`. Without that branch the super admin saw an almost-empty "on leave today" next to a whole-company headcount — because `getMyTeam()` is already company-wide for the root (a transitive subtree walk) while its *leave* scope is direct-report HR admins only. If you touch either, keep the two agreeing.
- **`SUPER_ADMIN`'s reporting scope is deliberately wider than its HR-write scope** (`reportableEmployeeIds` in `leaveRequestService.js`): `undefined`, i.e. no employee restriction, for `GET /leave-requests`, `/report` and `/report/csv`. Reusing `getHrScopedEmployeeIds` there would limit the one role that can already read every request to a report on its direct-report HR admins. Both repository functions treat `undefined` as "no filter" and `[]` as "nobody" — **never return `[]` from that helper for the super admin**, or every report silently comes back empty.

### One colour per leave type

- `utils/leaveTypeAccents.js` maps `leave_type_id` → an accent from `LEAVE_BALANCE_ACCENTS`, **cycled by position in the caller's balance list, not hashed from the name**: six accents against typically five types means a hash would eventually give two types the same colour, which reads as a bug. Keyed on the id because a type's *name* is editable — renaming one would otherwise recolour its whole history.
- Both the dashboard's My leave tile and the My Leave page's balance cards go through it, so a type is the same colour in both. The page previously indexed `LEAVE_BALANCE_ACCENTS` directly; that produced the same colours, but only by coincidence of iterating the same array.
- **The My leave tile is a leave-type `<select>` plus that type's own history**, not a row of one chip per type: at five types the chip row wrapped onto three lines and still only said "days left". "All leave types" is the default and keeps the chip row (now clickable, each chip selecting its own type). A row shows the dates, days, status and — the point of it — the decision comment, since a rejection without its reason is the least useful row on the page.

### Managing a person: creator **or** in-my-scope (server), HR-tier (client)

- `changeManager`/`changeStatus` accept the actor if **either** they are the target's `invited_by` **or** `isInActorsHrScope(actor, id)` is true. Creator-alone was the original rule; widened because it left an HR admin with **no controls at all** for anyone they'd inherited rather than invited (a colleague's joiner, or any account predating the invitation records) — which is what "add the icons for HR in My Team" turned out to be about. The icons were always there; the gate was never satisfied.
- **The boundary that matters is unchanged:** a subtree walk never goes sideways or upward, so another branch's people stay unreachable, and `SUPER_ADMIN` still can't be re-parented or deactivated from below (nobody's subtree contains the root). That protection used to be a side effect of the "no `invited_by`" rule and is now explicit.
- **`EmployeePersonRow`'s client gate is the simpler `HR-tier` check, not a mirror of the service rule** — deliberately, and settled on direct request. The routes are HR-tier gated, so a `MANAGER` is offered neither control on any row (a client that offered one would just produce a 403); and since actions only render on My Team — the viewer's own subtree by construction — scope is already satisfied for every row an HR-tier viewer sees there, so re-checking `invited_by` would only re-hide the inherited-account case the widening existed to fix. **Don't "tighten" the client back to `creator`, and don't loosen the routes to admit managers** unless that's a fresh decision: re-parenting moves someone out of your team and deactivating ends their session, both HR-desk actions.

### Applying for leave is a page under My Leave, never a modal

- The sidebar's **Apply Leave** entry is gone; the only way in is My Leave's own "Request Leave" button, and the route moved to `/dashboard/my-leave/apply-leave`.
- **The modal on My Leave was deleted, not hidden.** `MyBalancesPage` no longer imports `Modal`/`RequestLeaveForm` and has no submit handler at all: `ApplyLeavePage` navigates back with the new request's start date in router state, which the page's own `initialFocusDate` picks up on its fresh mount. That's also why `focusDate` is now a read-only `useState` with no setter.
- **Don't reintroduce a modal or a query-param version of this.** The original `/dashboard/my-leave?apply=1` did nothing when clicked from My Leave itself — a search-only navigation doesn't remount the component, so the lazy state that read the flag never re-ran. A nested route always mounts fresh.

---
