# 📋 Leave Management System — Project Development Rules

> Master rules for architecture, coding, database, testing and documentation.

---

## 🧭 General Rules

- Build one module **completely** before moving to the next.
- Never skip architecture layers.
- Follow the project brief before implementing features.
- Keep code simple, readable and maintainable.

---

## 🛡️ Non-Functional Requirements — Non-Negotiable, Applies to Every Module

> From the project brief, reproduced **verbatim, unedited**. These are cross-cutting — they apply to every module past, present and future, not a per-feature checklist. Full status tracking and analysis: [`docs/4.non_functional_requirements.md`](../docs/4.non_functional_requirements.md) — keep that file updated as each item moves toward being satisfied.

1. Authorization is checked on every request, against the specific record being touched. "Is this user logged in" is not enough; the question is always "is this user allowed to do this, to this row". Write it once in a place you can reason about rather than scattering checks through every handler.
2. A balance must never drift. The number an employee sees has to agree with the history that produced it, after any sequence of approvals, cancellations and overrides. Consider whether a balance is something you store and mutate, or something you derive from a ledger of entries.
3. State transitions are enforced server-side. The set of legal moves from each state should be visible in one place in the code, not implied by scattered conditionals.
4. Every write endpoint validates its input server-side. Never trust the client.
5. The API returns meaningful HTTP status codes and machine-readable error responses. A refused action returns a distinguishable error — "not allowed" and "not found" are different answers, and you should decide deliberately which one an outsider gets.
6. Code must be commented. Every file opens with a short comment saying what it is for, every exported function has a description of its inputs, output and failure modes, and every non-obvious piece of logic — the permission rules, the working-day calculation, the balance arithmetic, the delegation window — carries a comment explaining why it works that way. Comments that merely restate the code are noise; we will call those out too.
7. The app stays responsive with 200 employees and three years of requests.
8. Usable on a phone-width screen. It does not need to be beautiful; it needs to be clear.
9. No secrets, keys or passwords committed to the repository.

> ⚠️ **Rule #6 overrides the general "don't write comments unless the why is non-obvious" instinct — for this project specifically, write the file-header comment and the per-function input/output/failure-mode comment every time**, even when it feels repetitive. Applies to every new or changed file from now on. Retrofitting existing files that predate this rule is a tracked backlog item (see the doc above), not something to do silently inside an unrelated change.

---

## 📝 Module 3 — Requests and the Approval Workflow (Authoritative Spec)

> From the project brief, reproduced **verbatim, unedited**. This is the spec for Module 3 (FR-011 through FR-021 in [`docs/1.functional_requirements.md`](../docs/1.functional_requirements.md)) — read this section before writing any leave-request code instead of re-deriving the rules from scratch.

1. An employee submits a request with a leave type, a start and end date, half-day flags, and a reason.
2. Document upload is required where the leave type demands it — for example a medical certificate for sick leave. File type and size are validated on the server; never trust the file extension or the client-reported size. A document is visible only to the requester, their approver and HR.
3. Before submitting, the employee sees exactly how many working days the request will consume, with weekends and public holidays already excluded.
4. A request is refused if it would take the balance below zero, unless that leave type permits a negative balance.
5. A request is refused if it overlaps a request the same employee already has pending or approved.
6. A request moves through the states submitted, approved, rejected, withdrawn and cancelled. Illegal transitions are rejected by the server — an already-cancelled request cannot be approved.
7. A manager approves or rejects a request from their team, leaving a comment. HR can act on any request and can override a manager's decision, which is recorded as an override.
8. An employee can withdraw a request that is still pending, and can cancel an approved request whose dates are still in the future. Both return the days to the balance.
9. Delegation is required. A manager who is going away nominates a delegate for a date range. During that window the delegate can approve requests on the manager's behalf, and the record shows both who acted and who they acted for.
10. Every request carries a full audit trail: each state change with the actor, the timestamp, and any comment. The trail is append-only and never edited.

> 🧭 **Status: built** (migrations 013–017, including file upload — point 2, settled on Cloudinary as the storage backend). Implementation notes, for anyone touching this code next:
> - **Point 2 (document upload)**: `POST /api/leave-requests` accepts `multipart/form-data` with an optional `document` field, required only when `leave_types.requires_document` is true. Real file type is sniffed from content (`utils/fileType.js` — magic bytes, not extension/Content-Type) and restricted to PDF/JPG/PNG, 5MB max (`middlewares/uploadMiddleware.js`, multer memory storage — never touches disk). The file uploads to Cloudinary as a **private `type: authenticated` asset** — a plain Cloudinary URL can never reach it — and Postgres (`leave_request_documents`, migration 017) stores only `cloudinary_public_id`/`cloudinary_resource_type`, never a URL. `GET /api/leave-requests/:id/document` reuses `getLeaveRequestById`'s viewing rule, then mints a signed URL good for 5 minutes (`cloudinaryService.js`) — generated fresh per call, never cached, so there's no long-lived link to leak. Upload happens *after* every other validation (leave type, working days, overlap, balance) and *before* `insertLeaveRequest`, so a Cloudinary failure never leaves a half-created request behind — nothing has touched Postgres yet at that point. A document is immutable once attached (no replace/delete endpoint), matching this table's own `UNIQUE` on `leave_request_id`.
> - Point 3's live preview is `POST /api/leave-requests/preview` — pure, side-effect-free, used by both the frontend's `RequestLeaveForm.jsx` and the real `POST /api/leave-requests` internally, so the number an employee sees before submitting is always exactly what gets charged.
> - Point 6/7's state machine is `leaveRequestStateMachine.js` — `WITHDRAWN`/`CANCELLED` are dead ends (never appear as a `from`); `APPROVED ↔ REJECTED` stays legal only via the two `HR_OVERRIDE_*` actions, gated by `requireRole("HR_ADMIN")` at the route level.
> - Balances are ledger-derived (`leave_balance_ledger`, summed at read time) — see NFR-2 above. `leave_balances.days_taken`/`days_pending` were dropped as columns entirely (migration 014).
> - The two open decisions are settled as: requests spanning a year boundary debit the **start date's** year; only the employee themselves can withdraw/cancel (no HR/manager force-cancel).
> - **One simplification beyond what was originally discussed:** the 403-vs-404 policy (NFR-5) treats "a delegate whose window has expired" the same as "never was a delegate" — both return `404`, not a `403` for the expired case. Distinguishing them would need an extra "did a delegation ever exist for this pair" query for no real security benefit (the action is blocked either way) — don't add that distinction without a concrete reason to.
> - **React gotcha hit while building the live preview:** don't call `setState` synchronously inside a `useEffect` body to "reset" state when preconditions aren't met (e.g. clearing a preview when the date range becomes invalid) — `eslint-plugin-react-hooks`'s `set-state-in-effect` rule flags it, and it's right to: it causes an extra render on every keystroke. Instead, compute a derived boolean (e.g. `hasPreviewableRange`) and gate the *rendering* of the stale value on it, rather than nulling the state out imperatively. See `RequestLeaveForm.jsx`.
> - **Point 7's "HR can act on any request" turned out to mean "any request in their own branch," not company-wide** — this app supports more than one `HR_ADMIN` (each the root of a separate reporting branch; a `MANAGER`'s `manager_id` names one specific HR admin, not the role generically), and the original implementation let *every* HR admin act on *every* request regardless of branch — reported as a real gap once the org actually had more than one HR admin. Fixed in `resolveActingCapacity` (`leaveRequestService.js`): the `HR_ADMIN` branches for approve/reject and for override now call `isUserInSubtree(actor.id, request.employee_id)` (the same recursive-CTE helper `requireUserScope.js`/`reportingService.js` already used elsewhere) instead of returning `{ actedFor: null }` unconditionally; an HR admin outside their own branch gets the same `404` an unrelated manager would (NFR-5 — no more legitimate reason to know than a stranger), not a `403`. `listTeamLeaveRequests`'s `HR_ADMIN` branch changed the same way, from `findAllLeaveRequests()` to `findSubtreeUsers(actor.id)` minus the root itself. Company-wide visibility for HR wasn't removed, just split out: `GET /api/leave-requests/all` (new, `requireRole("HR_ADMIN")`, `listAllLeaveRequests()`) backs the "All Requests" tab on `ApprovalsPage.jsx`, and is deliberately **read-only from the UI's own perspective** — `TeamRequestList`'s new `readOnly` prop hides every approve/reject/override button on that tab (acting still 404s server-side regardless, this is purely so the UI doesn't offer a button that would just fail) — while "My Team" stays the actionable, subtree-scoped tab. Viewing a single request's details (`getLeaveRequestById`, and everything that reuses its rule — audit trail, document) was **not** changed and still lets any HR admin view any request; only the four mutating actions are subtree-scoped.
> - **FR-024 (HR reporting/CSV, Module 4) reuses the same "filter server-side, never in JS" principle as everywhere else** — `HrReportsPage.jsx`'s Browse tab hits `GET /api/leave-requests` with `employeeId`/`leaveTypeId`/`status`/`startDate`/`endDate` as query params, resolved by `findLeaveRequestsFiltered` building a dynamic (but still fully parameterized — every value is a placeholder, none are string-concatenated) `WHERE` clause. Deliberately **not** the same query as `GET /all`: that one excludes `WITHDRAWN` (fine for the action-oriented Approvals page, dead weight there), but this is a browse/report view where `WITHDRAWN` is exactly the kind of thing HR might filter *for* — so nothing is excluded by default here. The separate "leave taken per employee" report (`GET /report`, and `GET /report/csv` for the download) is a `GROUP BY` aggregation (`findLeaveTakenReport`) over `APPROVED` requests only ("taken" ≠ pending/rejected/withdrawn/cancelled) overlapping the given period — a request that only partially overlaps is counted in full rather than pro-rated, the same kind of simplification as the year-boundary debit rule for balances above. CSV formatting (`utils/csv.js`, RFC 4180 quoting) lives in the controller, not the service — the service only ever returns structured rows, same layering as the document-download endpoint's `stream`/`filename`/`mimeType` split.
> - **Bug found and fixed after FR-024 shipped: both endpoints above were unscoped by branch** — `listFilteredLeaveRequests`/`generateLeaveTakenReport` originally queried across the whole `leave_requests` table, so *any* HR admin could browse or report on *any* employee, including another HR admin's branch — the exact same "every HR admin, not just company-wide-context views, must stay scoped to their own subtree" rule already established for point 7's approve/reject/override (see the bullet above) and for `listTeamLeaveRequests`, just missed when FR-024 was first built. Fixed the same way: both service functions now take `actor` as their first argument, look up `findSubtreeUsers(actor.id)` minus the root itself, and pass that id list down as `employeeIds` — `findLeaveRequestsFiltered`/`findLeaveTakenReport` AND it into their `WHERE`/`GROUP BY` query (or return `[]` immediately for an HR admin with an empty subtree, without querying at all). An `employeeId` filter for someone outside the caller's subtree now just yields zero rows, same as filtering for an id that doesn't exist — no 403/404 needed since this is a browse view, not a single-record lookup. This does *not* touch `listAllLeaveRequests`/`GET /all`, which stays deliberately company-wide (read-only "All Requests" context, per the bullet above) — the fix is specific to the two FR-024 tools.
> - **Point 9 (delegation) originally had no way for the delegate to find out at all** — `createDelegation` never asked them, and `listTeamLeaveRequests`/`GET /leave-requests/team` was role-gated to `MANAGER`/`HR_ADMIN`, which blocked a plain-`EMPLOYEE` delegate from that endpoint entirely even though the row-level authorization (`isManagerOrDelegateOf`) already let them act on individual requests. Fixed without an accept/reject flow (deliberately — that would need handling rejection too, and nothing in FR-020 asks for one): `GET /api/delegations/as-delegate` (open to any role) is how a delegate discovers the nomination — surfaced via the `DelegateStatus.jsx` dashboard tile and, while a delegation is active, it also reveals the Approvals nav link for a non-manager (`useActiveDelegation.js`, used by both). `listTeamLeaveRequests` now merges in each currently-delegated-for manager's direct reports alongside the actor's own, and the route itself dropped its role gate — an ordinary employee with neither reports nor an active delegation just gets `[]` back, not a `403`. Rows from a delegated-for team are labeled in `TeamRequestList.jsx` ("Delegated for X") using the leave-request row's `manager_first_name`/`manager_last_name` (added to `JOINED_COLUMNS`), since `employee_manager_id` alone doesn't explain to the viewer why an unfamiliar employee's request is in their list.

---

## 🎯 Deliverables & Review Criteria (Most Important — read before every module)

> From the project brief, reproduced **verbatim, unedited**. This is what the project is actually judged on — re-read this section before considering any module "done."

### 7. Deliverables

1. Git repository with a readable commit history — small, meaningful commits, not one commit called "final".
2. A deployed, working URL. Frontend, backend, database and file storage all live. Seed it with a reporting structure at least three levels deep, two leave types, a holiday calendar, and one demo login per role — employee, manager and HR — so a reviewer can log in as each and see the difference immediately.
3. Unit tests. At minimum, cover the working-day calculation across weekends, public holidays and half days; the balance after an approval, a cancellation and an override; overlap detection; rejection of illegal state transitions; and authorization — that a manager cannot act on a request outside their team, that an employee cannot approve their own request, and that a delegate's authority stops when their window ends. Any runner is fine. Tests must run and pass from a single documented command.
4. README covering what the app does, how to run it locally, required environment variables, the architecture and data model, how you modelled permissions and where they are enforced, how balances are calculated, how to run the tests, the significant decisions you made and why, and the known limitations.
5. API documentation. Every endpoint with method, path, the roles allowed to call it, request body, response shape and error cases. A section of the README, a Swagger/OpenAPI page, or a published Postman collection all count.

### 10. How this will be reviewed

1. Correctness and consistency of authorization. Every endpoint, every record, enforced on the server. This matters most, and we will probe it directly.
2. Correctness of the balance and working-day arithmetic after long sequences of actions.
3. Quality of the unit tests — particularly whether you tested the permission rules, not only the happy path.
4. Whether the permission model and the state machine live somewhere a reader can find them, rather than being spread across handlers.
5. API design: clear resources, correct verbs and status codes.
6. Data model: does it handle the reporting tree, delegation and the audit trail without special-casing?
7. Code readability and comments: naming, structure, no dead code, and explanations where a reader would otherwise have to guess.
8. Documentation quality — a reviewer should get it running from your README alone.
9. Scope discipline: everything in section 4 done well beats extra features done loosely.

**Not assessed: visual flair, animation, or the use of any particular library.**

> 🧭 **What this means in practice, going forward:**
> - **Visual polish is now explicitly off the priority list.** All of this session's UI redesign work stands, but no further time should go into further "make it pretty" passes at the expense of Module 3 correctness/tests/docs — review criterion 9 (scope discipline) explicitly rewards *not* doing that.
> - Deliverable #5 (API docs) is already substantially satisfied by [`docs/2.api_documentation.md`](../docs/2.api_documentation.md) — keep it current (existing standing rule) rather than starting a separate Swagger/Postman effort.
> - Deliverable #3's test list is a **checklist to verify against literally**, not a vibe: working-day calc (weekends + holidays + half-days), balance after approve/cancel/override, overlap detection, illegal-transition rejection, and three specific authorization tests by name — manager acting outside their team, an employee approving their own request, and a delegate acting after their window has ended. Don't consider Module 3's test suite done until all of these exist explicitly, not just implied by broader tests.
> - Deliverable #2 (seed data: 3-level reporting tree, 2 leave types, holiday calendar, one demo login per role) needs a seed script — not yet built, add it as part of Module 3's own deliverables, not an afterthought at the very end.
> - Deliverable #4 wants one README that a reviewer can run the whole app from unaided — currently this project's setup/architecture/decisions are spread across `README.md`, `server/README.md`, `client/README.md`, and `docs/*.md`. That's fine as long as the root `README.md` clearly indexes all of it (which it currently does) — revisit before final submission to make sure nothing a reviewer needs is missing from that chain.
> - Review criterion 4 (permission model and state machine must "live somewhere a reader can find") directly validates the design from the Module 3 spec above: one `assertCanActOnLeaveRequest`-style function and one explicit state-transition map, not logic scattered across controllers.

---

## 🛠️ Technology Stack

| Layer    | Stack |
|----------|-------|
| Backend  | Node.js, Express.js, PostgreSQL, Raw SQL (`pg`), ES Modules |
| Frontend | React (Vite), Axios |
| Testing  | Vitest, Supertest, React Testing Library |

---

## 🏗️ Architecture

```
Client → Routes → Validator → Controller → Service → Repository → PostgreSQL
```

- Do **not** bypass layers.

### Layer Responsibilities

- **Routes** — endpoints only.
- **Validators** — validate requests only.
- **Controllers** — receive request, call service, return response.
- **Services** — business logic only.
- **Repositories** — database access only.

> ⚠️ **Current gap:** no `validators/` folder exists yet (`userRoutes.js` calls straight into `userController.js`).
> Any **new** endpoint must include a validator file. **Existing** endpoints should get one added before they're changed further.

---

## 🏷️ File Naming & Exports

| Layer      | Suffix           |
|------------|------------------|
| Routes     | `*Routes.js`     |
| Controllers| `*Controller.js` |
| Services   | `*Service.js`    |
| Repositories| `*Repository.js`|
| Validators | `*Validator.js`  |

- Use **named exports only** (`export async function ...`).
- **Never** use default exports in controllers, services, repositories, or validators.

---

## 🗄️ Database Rules

- Use PostgreSQL.
- Use raw SQL with **parameterized queries** (no string concatenation — prevents SQL injection).
- Use `UUID DEFAULT gen_random_uuid()` for primary keys.
- Use foreign keys where appropriate.
- Every table needs `created_at` and `updated_at`.
- Store SQL scripts in `src/sql`.
- Migrations are numbered sequentially and **never edited after being applied**.
  Current latest is `017_create_leave_request_documents.sql` → next migration must start at `018_...`.

> ℹ️ **Holidays store a date range, not a single date.** `holidays` has `start_date`/`end_date` (both `NOT NULL`, `end_date >= start_date`), not a single `holiday_date` — this supports multi-day holidays (e.g. a 5-day Diwali). The API accepts `endDate` as optional and defaults it to `startDate` for single-day holidays. There's no DB-level uniqueness on dates anymore (ranges make exact-duplicate uniqueness meaningless); overlap between holidays is instead checked at the service layer (`holidayService.js` → `findOverlappingHoliday`) and rejected with a `409`, same status code as the old DB-constraint-driven duplicate check.

> ⚠️ **Migrations must be applied manually to every environment.** The runner has no tracking table (see the known-limitation note in `server/README.md`), so adding a migration file does **not** update any database on its own. After writing one, apply it to the dev DB, the `_test` DB (or backend tests fail on the old schema), **and** the Render production DB — a deployed frontend hitting an unmigrated production DB shows up as a generic load failure like "Unable to load holidays", which is easy to misdiagnose as an API/CORS bug.

> ⚠️ **FullCalendar `display: "list-item"` does not put a dot on every day of a multi-day event.** A single event with `start`/`end` spanning several days renders as just **one** dot on the start day, so the remaining days look empty. `HolidayCalendar.jsx` therefore expands each holiday range into one single-day event per date (`eachDateKeyInRange` in `client/src/utils/dates.js`) — don't "simplify" it back to one event with an `end`.

---

## 🔐 Authentication

- No public employee registration.
- HR registration uses a **secret registration code**.
- Roles: `EMPLOYEE`, `MANAGER`, `HR_ADMIN`.
- Passwords must be hashed using **bcrypt**.
- Google OAuth is only an **alternative login method** for existing users (not a signup path).

---

## 🤫 Secrets

- `server/.env` holds `DB_PASSWORD`, `HR_REGISTRATION_CODE`, and other credentials.
- Never commit real `.env` values.
- Never log secrets, credentials, or password values (plain or hashed) to console or error responses.

---

## 📡 API Response Format

**Success:**
```json
{ "success": true, "message": "...", "data": {} }
```

**Error:**
```json
{ "success": false, "message": "...", "errors": {} }
```

> ⚠️ **Known gap:** existing `userController.js` returns plain `res.json(users)` without this envelope.
> New/changed endpoints must use the envelope; old endpoints should be migrated to it when touched.

---

## 🧪 Testing

- Every module requires backend **integration tests**.
- Frontend components require **component tests**.
- Test every API before moving on to the next feature.

---

## 🔄 Development Workflow

For each feature, work through these steps **in order**:

1. Requirement
2. Business Rules
3. Edge Cases
4. Database Design
5. API Design
6. Validation
7. Implementation
8. Testing
9. Documentation

### 🌿 Git

- Small commits.
- One feature per commit.
- Use meaningful commit messages.

---

## 📚 Documentation

Each feature's documentation should cover:

- Functional Requirements
- Business Rules
- Database Design
- API Design
- Validation Rules
- Edge Cases
- Test Cases

> 🚨 **Database schema doc:** [`docs/3.db.md`](../docs/3.db.md) documents every table (ER diagram + column-level breakdown) and a "Planned tables" section for what's designed but not built yet. **Whenever a migration is added or changed under `server/src/sql/`, update `docs/3.db.md` in the same change** — this is the same standing rule as keeping `docs/2.api_documentation.md` in sync with endpoint changes.

---

## 🧩 Reusable UI Components

Before writing new markup for a button, badge, card, modal, or page header, check this table — it's almost certainly already covered by one of these primitives in `client/src/components/ui/`.

| Component | Path | Purpose | Key props |
|---|---|---|---|
| `Button` | `ui/Button.jsx` | Every clickable action (submit, primary/secondary/success/danger/ghost actions). Supports rendering as a router `Link` via `as`. Prefer this over `IconButton` for row-level actions in a list (approve/reject/withdraw/etc.) — an icon-only button reads as clutter once a row can carry several actions; label them. | `variant` (`primary\|secondary\|success\|danger\|ghost`), `size` (`sm\|md`), `icon`, `iconPosition`, `loading`, `as` |
| `IconButton` | `ui/IconButton.jsx` | Icon-only actions, e.g. row-level delete/approve. Always requires an accessible `label`. | `icon`, `label`, `variant` (`default\|primary\|success\|danger\|ghost`), `size`, `loading` |
| `Badge`, `RoleBadge`, `StatusBadge` | `ui/Badge.jsx` | Pills for roles/status. `RoleBadge` renders the short label from `ROLE_LABELS` (`HR_ADMIN`→"HR" etc.) instead of the raw enum. | `RoleBadge({ role })`, `StatusBadge({ status })` |
| `Card` | `ui/Card.jsx` | White bordered container (table wrappers, form panels, tiles). No default padding — pass it via `className`. | `className` |
| `Modal` | `ui/Modal.jsx` | The only modal/dialog pattern in the app — portal + backdrop + Escape/click-outside close. Use for any "add/edit X" form instead of an inline toggled section. | `open`, `onClose`, `title`, `size` (`md` default, `lg` for content-heavy views like `RequestDetailModal`) |
| `PageHeader` | `ui/PageHeader.jsx` | The "H1 + description + top-right action button" header block used at the top of most `/dashboard/*` pages. | `title`, `description`, `action` |
| `Avatar` | `ui/Avatar.jsx` | Initials-circle avatar, extracted from the old `AppHeader.jsx` for reuse in the top bar. | `firstName`, `lastName`, `size` (`sm\|md\|lg`) |
| `ProgressBar` | `ui/ProgressBar.jsx` | Slim colored percent-fill bar, extracted from `MyBalancesPage.jsx`'s old inline `BalanceCard`. Clamps its input to 0–100. | `percent`, `barClassName` |
| `InviteEmployeeForm` | `team/InviteEmployeeForm.jsx` | The employee-invite form (fields + invite-link result with a copy-to-clipboard button). Feature-specific, not a generic primitive, but it's meant to be dropped into a `Modal` rather than given its own route — `EmployeesPage` is the only place that opens it. Takes an `onInvited` callback to refresh the caller's list. | `onInvited` |
| `EmployeePersonRow` | `team/EmployeePersonRow.jsx` | One person's row on `EmployeesPage` — avatar, name/email, role/status badges, inline "change manager" editing, activate/deactivate. Used for a leadership row, a team card's manager header, a team's report, and an "unassigned" (reports-straight-to-HR) row alike, so this logic lives in exactly one place regardless of which card a person is currently rendered inside. `showReportsTo` (off by default) prints who they report to. The "Change manager" icon (`canEditManager`) is hidden for **any** row (not just `HR_ADMIN`) unless the viewer is `user.invited_by` (whoever created this person) — server-enforced too, this just avoids offering a control that would 403. | `user`, `users` (full list, for manager-select options and name lookups), `onChanged`, `showReportsTo`, `className` |
| `EmployeeTeamCard` | `team/EmployeeTeamCard.jsx` | One manager's team as its own card — the manager's own `EmployeePersonRow` (tinted so it reads as a header) followed by their direct reports. `team` is one `{ manager, reports }` entry from `utils/employeeGroups.js`'s `groupEmployeesForOrgView`. | `team`, `users`, `onChanged` |
| `HolidayForm` | `calendar/HolidayForm.jsx` | Add **and** edit form for a holiday, designed to sit in a `Modal`. Pass `holiday` to edit (prefills, calls `PATCH`) or omit it to create (calls `POST`). Handles the start/end range, the day-count preview, and the overlap error from the server. Give it a `key` of the holiday id so switching rows remounts it with fresh state. | `holiday`, `onSaved(startDate)` |
| `LeaveTypeForm` | `leaveTypes/LeaveTypeForm.jsx` | Add **and** edit form for a leave type, same `HolidayForm` pattern — pass `leaveType` to edit (prefills, calls `PATCH /leave-types/:id`) or omit it to create (calls `POST`). Extracted from `LeaveTypesPage.jsx`'s old create-only inline form once an edit action was added; give it a `key` of the leave type's id (or a stable sentinel like `"new"` for create) so switching rows remounts it with fresh state, same reason as `HolidayForm`. | `leaveType`, `onSaved()` |
| `HolidayList` | `calendar/HolidayList.jsx` | The holiday list — calendar-tear date chips, day-count and "Passed" badges, and per-row edit/delete icon buttons (owns its own delete call and error state). | `holidays`, `canManage`, `onEdit`, `onChanged` |
| `RequestLeaveForm` | `leave/RequestLeaveForm.jsx` | Submit-a-leave-request form, meant for a `Modal`. Live-previews the working-day count via `POST /leave-requests/preview` as the date range/half-day flags change. | `onSubmitted(createdRequest)` |
| `MyLeaveRequestList` | `leave/MyLeaveRequestList.jsx` | An employee's own request history — card list with a withdraw action while `SUBMITTED` and a cancel action while `APPROVED` and still in the future. A single "Details" action opens `RequestDetailModal`. Actions are labeled `Button`s, not icon-only. `selectedRequestId` (set from `MyLeaveCalendar`) highlights and scrolls to the matching row, same pattern as `HolidayList`'s `selectedHolidayId`. | `requests`, `onChanged`, `selectedRequestId` |
| `MyLeaveCalendar` | `leave/MyLeaveCalendar.jsx` | FR-022's personal calendar — same compact FullCalendar setup as `calendar/HolidayCalendar.jsx`, showing the employee's own `SUBMITTED`/`APPROVED` requests (amber/green dots, matching `StatusBadge`'s colors) plus public holidays (indigo dots). Withdrawn/rejected/cancelled requests are deliberately excluded — they never happened, so they'd just be clutter here (the request list below still shows them). Clicking a request's dot calls `onSelectRequest`, which `MyBalancesPage.jsx` wires to `MyLeaveRequestList`'s `selectedRequestId` — a *bigger* dot (not a color change, since color already means status) marks the selected one. `onActiveYearChange` lets the page lazy-load holidays for whichever year the calendar is currently showing, independent of the page's own balance-year selector. | `requests`, `holidays`, `onActiveYearChange`, `focusDate`, `selectedRequestId`, `onSelectRequest` |
| `TeamLeaveCalendar` | `leave/TeamLeaveCalendar.jsx` | FR-023's team calendar, on `ApprovalsPage.jsx` — fed whichever `requests` that page already scoped for the active tab (My Team / All Requests), so it has no opinion of its own about who's allowed to see what and needs no new backend endpoint. Deliberately **not** the compact dots-only style `HolidayCalendar`/`MyLeaveCalendar` use: with multiple people's leave on one calendar, a dot alone can't say *who*, so each request is a small labeled bar ("Asha · Sick Leave", green/amber by status) instead — holidays stay as compact indigo dots alongside. Clicking a bar calls `onSelectRequest`, wired the same way as `MyLeaveCalendar`'s does, this time into `TeamRequestList`'s `selectedRequestId`. No `focusDate` (there's no "just submitted" moment to jump to here, unlike the employee's own calendar). | `requests`, `holidays`, `onActiveYearChange`, `selectedRequestId`, `onSelectRequest` |
| `TeamRequestList` | `leave/TeamRequestList.jsx` | The manager/HR approvals list — each row renders `RequestActions` (approve/reject/override) plus the same "Details" action as `MyLeaveRequestList`. Each row shows the employee's `RoleBadge` next to their name (HR's list spans every role, so it isn't otherwise obvious) and labeled `Button`s rather than icon-only actions — the row wraps (`flex-wrap`) rather than staying rigidly single-line once there are several labeled actions plus two badges. A row whose `employee_manager_id` differs from the viewer shows a "Delegated for X" badge. `readOnly` (used by `ApprovalsPage`'s "All Requests" tab) hides `RequestActions` and that delegated badge, leaving only "Details" — acting on an out-of-scope row would 404 server-side anyway, this just keeps the UI from offering a button that would fail; the same `readOnly` flag is threaded into `RequestDetailModal` so its in-modal actions stay hidden too. `selectedRequestId` (set from `TeamLeaveCalendar`) highlights and scrolls to the matching row, same pattern as `MyLeaveRequestList`'s. | `requests`, `canOverride`, `onChanged`, `readOnly`, `selectedRequestId` |
| `RequestActions` | `leave/RequestActions.jsx` | The approve/reject (reject expands an inline optional-comment box)/HR-override button cluster and its busy/error state — extracted out of `TeamRequestList` so `RequestDetailModal` can render the identical control instead of a second, potentially-drifting copy of the same status→button-set logic. Renders nothing if the request's status offers no legal action for the caller (e.g. already decided and `canOverride` is false). | `request`, `canOverride`, `onChanged` |
| `RequestDetailModal` | `leave/RequestDetailModal.jsx` | The single "Details" destination for both request lists above — everything about one request (employee, dates, reason, the employee's leave balance for the year the leave falls in, decision, full audit trail) plus its attached document, if any: filename and a "Download" link (`Button as="a"`) to the signed URL, deliberately **not** embedded inline (tried, asked to be removed — an approver only needs to open/save it, not read it inside the modal). Replaces the old separate `AuditTrail` modal (retired) and the old inline `DocumentPreview` component (retired). Fetches the audit trail, the balance (`getUserBalances(request.employee_id, { year })`, reusing the endpoint `MyBalancesPage` already calls for the caller's own balances), and, if `request.has_document`, the signed document URL, all lazily on open. The balance list marks the leave type actually being requested. Renders `RequestActions` inline (hidden when `readOnly`) so a decision can be made without leaving the modal; on success it calls `onChanged` then closes itself, since it holds a static snapshot of `request` with no way to refresh in place. | `request` (the full row, not just an id — the caller's list already has it), `open`, `onClose`, `canOverride`, `readOnly`, `onChanged` |
| `DelegationForm` | `leave/DelegationForm.jsx` | Nominate-a-delegate form for a `Modal`. Delegate options come from the existing role-scoped `getUsers()` call, filtered to exclude the current user. | `onCreated(delegation)` |
| `DelegationList` | `leave/DelegationList.jsx` | A manager's own nominated delegations — read-only card list (no revoke endpoint exists). | `delegations` |
| `LeaveBalanceCard` | `leave/LeaveBalanceCard.jsx` | The entitlement/taken/pending/remaining breakdown card used on `/dashboard/my-leave`, extracted out of `MyBalancesPage.jsx`'s old inline `BalanceCard` for its own test coverage. Accent color cycling lives in `constants/leaveBalanceAccents.js` (kept out of this file so it stays a components-only export, which `react-refresh`'s lint rule requires). | `balance`, `accent` |
| `MyLeaveSummary` | `dashboard/MyLeaveSummary.jsx` | Dashboard tile: the current user's own leave at a glance (balances, pending count, next upcoming leave, most recent decision). Shown to every role — self-contained, fetches its own data. | none |
| `TeamOverviewSummary` | `dashboard/TeamOverviewSummary.jsx` | Dashboard tile: pending-approvals count + review link, who's on approved leave today, team headcount. Shown to `MANAGER`/`HR_ADMIN` — relies on `getTeamLeaveRequests()` already being scoped server-side, so it doesn't need to know which of the two roles is viewing it. | none |
| `DelegationStatus` | `dashboard/DelegationStatus.jsx` | Dashboard tile, `MANAGER`-only: renders **nothing** unless the manager currently has an active delegate covering approvals today. | none |
| `DelegateStatus` | `dashboard/DelegateStatus.jsx` | Dashboard tile, the flip side of `DelegationStatus` — shown to **every** role (a delegate can be a plain `EMPLOYEE`), renders nothing unless the current user is *someone else's* active delegate today. Uses `useActiveDelegation.js`, shared with `NavBar` (which uses the same hook to reveal the Approvals link for a non-manager currently delegating). | none |
| `Sidebar` | `layout/Sidebar.jsx` | The app's primary nav shell — a persistent, `localStorage`-persisted collapsible column on `lg:` and up, an off-canvas drawer below that. Wraps `NavBar` rather than duplicating its link data. | `collapsed`, `onToggleCollapse`, `mobileOpen`, `onCloseMobile` |
| `TopBar` | `layout/TopBar.jsx` | Replaces the old `AppHeader.jsx`: mobile menu toggle, route-derived page title, a nav search (filters `NavBar`'s own item list — there's no real search endpoint), and the user's identity + logout. Deliberately has no notifications bell and no profile/settings dropdown — both were tried and asked to be removed as out of scope. | `onOpenMobileMenu`, `onNavigate` |

Icons come from `lucide-react` (added for this redesign) — reuse an existing import from a nearby file before picking a new icon name.

> ⚠️ **The dashboard home (`DashboardPage.jsx`) is deliberately minimal** — a "Welcome, {name}" greeting plus `DelegationStatus`/`TeamOverviewSummary`/`MyLeaveSummary` stacked underneath, per direct feedback after a richer version (summary cards, a detailed team-requests table, a compact calendar, quick actions) was tried and asked to be removed. Don't re-add those without being asked again — if you want a detailed team-requests table or a leave calendar, `ApprovalsPage`/`TeamRequestList` and `HolidaysPage`/`HolidayCalendar` already cover that elsewhere in the app.

> ⚠️ **`AppLayout`'s mobile-drawer-close-on-navigate is threaded through props, not an effect.** Closing the sidebar drawer after a route change looks like it wants a `useEffect(() => setMobileOpen(false), [location.pathname])` — don't write that, it trips the same `eslint-plugin-react-hooks` `set-state-in-effect` rule documented above (a plain synchronous `setState` in an effect body). Instead every place that can navigate away (`NavBar`'s links, the top bar's search results) takes an `onNavigate` callback and calls it itself at the moment of navigation.

`ROLE_LABELS` (short display labels for roles) lives in `client/src/constants/badges.js` alongside `ROLE_BADGE_CLASSES`/`STATUS_BADGE_CLASSES`/`BADGE_BASE_CLASSES`.

> ⚠️ **`EmployeesPage` renders three fixed sections (Leadership / Teams / "Reports directly to HR"), not a generic n-level tree** — asked for explicitly (the old flat `<table>` made "who reports to whom" illegible), tried once as a table with expand/collapse indentation and asked to be redone as cards instead, matching the Linear/Notion/Slack "team cards" pattern. This works because the reporting hierarchy below HR is only ever two real levels deep by construction (`ALLOWED_MANAGER_ROLES` in `EmployeePersonRow.jsx`: a MANAGER only ever reports to HR_ADMIN, an EMPLOYEE reports to a MANAGER or straight to HR_ADMIN) — `utils/employeeGroups.js` groups the flat list into those three fixed buckets rather than building/rendering a generic recursive tree, which would be solving a harder problem than this data actually has. Note: HR_ADMIN *can* have a manager now (see the note directly below), but `groupEmployeesForOrgView` still puts every HR_ADMIN into the flat `leadership` bucket regardless of their own `manager_id` — the resulting chain is only surfaced via each row's own "Reports to X" line (`showReportsTo` on the Leadership section), not by nesting the Leadership card itself.

> ⚠️ **HR_ADMIN can now have a manager — specifically whichever HR admin created them, forming a chain** (A invites B, B reports to A; B invites C, C reports to B or A, whichever the inviting HR picks) — added on direct request; originally HR_ADMIN could never have a manager at all, which meant *nobody* could approve an HR_ADMIN's own leave request once there was more than one HR admin in the org (a real gap, found via the seeded/test data actually having 4 HR admins with no manager between them). `reportingService.ALLOWED_MANAGER_ROLES` now has `HR_ADMIN: ["HR_ADMIN"]`; `inviteEmployeeSchema` requires `managerId` for `role: "HR_ADMIN"` the same way it already did for `EMPLOYEE`. Tracking "who created this HR admin" reuses `invitations.invited_by` (already recorded for every invite, any role) rather than adding a new column — `userRepository.js`'s `PUBLIC_USER_COLUMNS` exposes it as `invited_by` via a **scalar subquery, not a `LEFT JOIN`** (`(SELECT ... ORDER BY created_at ASC LIMIT 1)`), deliberately, so a future resend/re-invite feature adding a second `invitations` row for the same user can never multiply that user into duplicate rows in every user-listing endpoint the way a `LEFT JOIN` would have. **Editing** who a given HR_ADMIN reports to is restricted to that same creator — see the bullet directly below, which generalized this from "HR_ADMIN targets only" to every role. `InviteEmployeeForm.jsx`'s reporting-line picker now always renders (previously skipped for `HR_ADMIN`) and defaults to the inviter themself, labeled "You" (`ManagerSelect.jsx`'s new `currentUserId` prop) — changeable to any other HR admin before submitting.
>
> ⚠️ **Bug found and fixed: `changeManager` only enforced the creator-only restriction for an `HR_ADMIN` target — a `MANAGER`/`EMPLOYEE` target's manager could be reassigned by *any* `HR_ADMIN`, not just whoever created them.** Reported directly: an HR admin with no team of their own could still open another manager's team card on `EmployeesPage` and re-parent their reports. This app's authorization is strict per-team throughout (the same principle behind `resolveActingCapacity`'s subtree scoping and the FR-024 browse/report fix above) — "any HR admin can act on any employee" was never actually the rule, it just hadn't been enforced yet for this one action. Fixed by dropping the `target.role === "HR_ADMIN" &&` condition in `userService.changeManager` — the `actor.id !== target.invited_by` check now applies to every role, exactly like `changeStatus` already did. Mirrored client-side: `EmployeePersonRow.jsx`'s `canEditManager` is no longer conditional on `user.role === "HR_ADMIN"`, so the "Change manager" icon is hidden for anyone the viewer didn't create, not just other HR admins. `listUsersFor`'s company-wide *viewing* for `HR_ADMIN` (`findAllUsers()`) is untouched — same read-vs-write split as the FR-024 fix: seeing everyone on `EmployeesPage` stays deliberate (an HR admin needs the whole org visible to know who reports to whom before inviting into it), only the write actions are creator-scoped.

> ⚠️ **Activate/deactivate (`PATCH /users/:id/status`) is restricted to the creating HR admin too, for every role** — asked for explicitly right after the manager-edit restriction above, on the same reasoning ("only the HR who created this employee should act on them"), and using the *exact same mechanism* (`actor.id === target.invited_by`) rather than the subtree-based scoping already used for leave requests — a deliberate choice discussed and confirmed: it's less resilient (if the creating HR is later deactivated themself, nobody can ever change that employee's status again — no "senior HR" fallback), but consistency with `changeManager`'s rule won out over that robustness concern. `userService.changeStatus` now takes the full `actor` (not just an id) to check this before `updateStatus`; mirrored client-side as `canEditStatus` in `EmployeePersonRow.jsx`. One wrinkle `changeManager` didn't have: the *viewer's own row* must still show its (disabled) activate/deactivate button regardless of `canEditStatus` — you didn't "create yourself," but hiding your own control entirely would read as broken rather than intentional, so that row is `isSelf || canEditStatus`, not `canEditStatus` alone.

> ⚠️ **jsdom has no `scrollIntoView` at all** — `HolidayList.jsx` and now `MyLeaveRequestList.jsx` call `element.scrollIntoView(...)` to bring a calendar-selected row into view, which throws `scrollIntoView is not a function` the instant a test actually exercises that selection state (this went unnoticed for `HolidayList` since nothing had tested it). Fixed once, globally, in `client/src/tests/setup.js` with a no-op stub (`Element.prototype.scrollIntoView ??= () => {}`) — don't re-add a per-test mock for this, the global stub already covers it.

> ⚠️ **Modal gotcha (already fixed, don't reintroduce):** `Modal`'s focus-on-open effect must depend on `open` only, **not** `onClose`. The caller's `onClose` is typically a plain function defined in the page body (not `useCallback`), so it gets a new identity on every render — including every keystroke in a form inside the modal. If the focus effect depends on it, focus gets yanked back to the modal panel after every character, forcing the user to re-click the input for each letter. Keep the Escape-key listener effect (which can safely depend on `onClose`) separate from the focus-on-mount effect (which must not).

> ⚠️ **Another `set-state-in-effect` shape (already fixed, don't reintroduce):** when an effect kicks off an async fetch keyed by a prop (e.g. `RequestDetailModal`'s `request.id`), don't reset state to `null` synchronously at the top of the effect before calling the fetch — that's still a synchronous `setState` inside the effect body and trips the same `eslint-plugin-react-hooks` rule as the `RequestLeaveForm` case above. Instead, store the fetched result *keyed by the id it was fetched for* (e.g. `{ requestId, entries, error }`) and derive "is this stale/loading" by comparing the stored key to the current prop — the reset happens implicitly because a mismatched key means "not current," with no imperative nulling needed. See `RequestDetailModal.jsx` (this pattern is used twice there — once for the audit trail, once for the document).

> ⚠️ **`setBusy(false)` must run on the success path too, not only in `catch` (already fixed in `TeamRequestList.jsx`, `MyLeaveRequestList.jsx`, `HolidayList.jsx` — don't reintroduce elsewhere):** the pattern `setBusy(true); try { await action(); onChanged(); } catch (err) { setError(...); setBusy(false); }` leaves `busy` stuck at `true` forever after a *successful* action, because `onChanged()` only refetches and re-renders the same row component with new props — it doesn't remount it, so `busy`'s state persists. Symptom: after a successful approve/reject/override/withdraw/cancel, the row's icon buttons show a permanent loading spinner (and, for reject, the inline comment box never closes), which reads as "the request is hanging" when it actually already succeeded instantly. Fix: always reset the loading flag in a `finally` block, and for the reject box specifically, explicitly close it (`setShowRejectComment(false)`) on success since nothing else does.

---

## 🚀 Deployment (Render)

- Frontend (Static Site) and backend (Web Service) are deployed as **separate Render services** on different `*.onrender.com` subdomains. Since `onrender.com` is a public suffix, this makes them **cross-site** to the browser, not just cross-origin.
- The auth cookie is `httpOnly` + `SameSite=None; Secure` (`server/src/utils/cookies.js`) so it can travel cross-site at all — but browsers (especially Incognito) block cross-site/"third-party" cookies by default regardless of `SameSite=None`. Symptom: login succeeds (frontend trusts the response body's user object), but the cookie never actually gets stored, so the very next API call 401s and the user gets bounced back to sign-in.
- **Fix — make requests same-origin from the browser's point of view** so the cookie is never third-party:
  1. Frontend Static Site → **Settings → Redirects/Rewrites**: add rule `/api/*` → `https://<backend>.onrender.com/api/*`, Action **Rewrite**. It must be listed **above** the catch-all `/*` → `/index.html` SPA fallback rule — Render matches top-to-bottom and stops at the first match, so the fallback would otherwise swallow every `/api/*` request first.
  2. Frontend Static Site → **Environment**: set `VITE_API_URL=/api` (relative, not the backend's absolute URL). Vite bakes this in at build time, so changing it requires **Clear build cache & deploy**, not just a rule save.
- No backend code changes are needed for this — `CLIENT_ORIGIN`/CORS and the cookie's existing `SameSite=None; Secure` settings already work fine once requests are same-origin.
- To verify: `fetch('/api/auth/me')` from the deployed frontend's own devtools console should return the backend's JSON (`x-powered-by: Express`), not the SPA's `index.html`. If it returns HTML, the rewrite rule is missing, misordered, or the build wasn't refreshed.

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
