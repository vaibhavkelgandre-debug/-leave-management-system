# Testing — covered, missing, and traced to code

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 17 — Test Cases Already Covered

### Backend (Vitest + Supertest, real `_test` Postgres DB, `server/src/tests/integration/`)

| File | What it tests | Result |
|---|---|---|
| `tests/unit/workingDayService.test.js` | `calculateWorkingDays` across weekends, single/multi-day holidays, holiday-on-weekend non-double-exclusion, half-day start/end, both-ends half-day, single-day half-day, half-day flag on a non-working boundary | ✅ 10 cases, no DB |
| `authGoogle.test.js` | login+link, no matching account, unverified email | ✅ 3 cases |
| `authLogin.test.js` | password login happy path + failure modes | ✅ 4 cases |
| `authMe.test.js` | current-session profile fetch | ✅ 3 cases |
| `authRegisterHr.test.js` | HR bootstrap registration | ✅ 3 cases |
| `invitationFlow.test.js` | FR-001 invite/verify/accept end to end | ✅ 6 cases |
| `inviteExpiry.test.js` | expired-invite sweep/deletion behavior | ✅ 5 cases |
| `passwordReset.test.js` | forgot-password flow | ✅ 4 cases |
| `reportingCycle.test.js` | manager reassignment + **cycle prevention** | ✅ 6 cases |
| `hrReportingHierarchy.test.js` | HR-admin-reports-to-HR-admin chain | ✅ 5 cases |
| `userRoutes.test.js` / `usersScope.test.js` / `userStatus.test.js` | role-scoped visibility, creator-only edit restriction | ✅ 9 cases combined |
| `leaveTypes.test.js` | leave-type CRUD + activation toggle | ✅ 6 cases |
| `leaveBalances.test.js` | balance retrieval + derivation | ✅ 4 cases |
| `holidays.test.js` | holiday CRUD + overlap rejection | ✅ 6 cases |
| `delegations.test.js` | nomination, overlap rejection, `as-delegate` discovery | ✅ 10 cases |
| `leaveRequestDocuments.test.js` | upload/type/size validation, signed-URL retrieval, download | ✅ 7 cases |
| `leaveRequestReporting.test.js` | FR-024 filtered browse + report + CSV | ✅ 15 cases |
| `leaveRequests.test.js` — the deliverables checklist, verbatim | preview (2), submission incl. **balance after approval/cancel/override** (5), approval workflow (6), HR override (2), **authorization — manager outside team / employee approves own / delegate window expired** (7), listing (6), all-requests HR view (2), audit trail (3) | ✅ 33 cases |

**Every item on the brief's explicit deliverable-#3 checklist is covered by name**: working-day calc across weekends/holidays/half-days ✅, balance after approve/cancel/override ✅, overlap detection ✅, illegal-transition rejection ✅, manager-outside-team ✅, employee-approves-own-request ✅, delegate-window-expired ✅.

### Frontend (Vitest + RTL, `client/src/**/*.test.jsx`, 37 files, ~285 `it` blocks)

Representative coverage: `App.test.jsx` (routing), `AuthProvider.test.jsx` (bootstrap/login/logout state), `RequireAuth.test.jsx`/`RequireRole.test.jsx`/`PublicOnlyRoute.test.jsx` (every guard), `LoginForm.test.jsx`, `RequestLeaveForm.test.jsx`, `RequestActions.test.jsx`, `RequestDetailModal.test.jsx` (including the balance-in-modal + in-modal-actions coverage added this session), `TeamRequestList.test.jsx`, `MyLeaveRequestList.test.jsx`, `InviteEmployeeForm.test.jsx`, `EmployeesPage.test.jsx` (reporting-line grouping, creator-only edit restrictions), `HrReportsPage.test.jsx`, `ApprovalsPage.test.jsx`, `LeaveTypesPage.test.jsx`, `HolidayForm.test.jsx`/`HolidayList.test.jsx`/`HolidayCalendar.test.jsx`, `DelegationForm.test.jsx`, dashboard tiles (`MyLeaveSummary`, `TeamOverviewSummary`, `DelegationStatus`, `DelegateStatus`), layout (`Sidebar`, `TopBar`, `NavBar` incl. pending-approvals badge), utils (`dates.test.js`, `validation.test.js`, `employeeGroups.test.js`).

Test runner: **Vitest** both sides. Backend: `npm test` / `npm run test:run` (both `NODE_ENV=test` via `cross-env`). Frontend: `npm test` (Vitest). Both single documented commands, satisfying the brief's "tests must run and pass from a single documented command."

---

## Part 18 — Missing Test Cases

Grouped by area, with why each matters:

### Authentication
- **No test for JWT expiry** (an 8-hour-old token) — would confirm `requireAuth` actually rejects an expired token distinctly from a malformed one. *Why it matters*: expiry is the main reason sessions end other than explicit logout; an untested expiry path risks silently accepting stale tokens if the check is ever refactored.
- **No test for a tampered/malformed cookie value** reaching `requireAuth` (as opposed to a missing cookie, which likely *is* covered). *Why*: distinguishes "no session" from "someone sent garbage" — both should 401, but only one path is likely exercised today.

### Authorization
- **No test for an HR_ADMIN attempting `GET /api/leave-requests` (FR-024 filtered browse) for an employee outside their subtree returning zero rows** specifically (vs. the already-tested "no filter" case) — this is the exact bug that shipped and was fixed post-launch per `.claude/rules.md`; a regression test locking in the fix wasn't confirmed to exist by name.
- **No test for `PATCH /users/:id/manager` reassignment forming a *multi-node* cycle** (A→B→C→A) as opposed to the direct A→B, B→A case — `assertNoCycle` uses a recursive CTE depth-capped at 20, so a multi-hop cycle is architecturally the more interesting case to prove.

### Employee / Reporting
- **No test for the depth-cap (20 levels) in `isUserInSubtree`/`findSubtreeUsers`** actually terminating instead of looping — unlikely to matter in practice at real org sizes, but it's an explicit magic number in the code with no test pinning its behavior.
- **No test for inviting an `HR_ADMIN` whose `managerId` points to a `MANAGER`** (should 400 per the hierarchy rule) — the mirror-image of the well-tested "EMPLOYEE reporting to another EMPLOYEE" rejection.

### Leave
- **No test for a leave request whose date range spans a calendar-year boundary** (e.g. Dec 30 – Jan 3) and confirming it's debited against the *start date's* year specifically, not the end date's — this is a named, deliberate simplification in the code comments but doesn't appear to have a dedicated test locking in *which* year wins.
- **No test for two concurrent approve requests on the same leave request** (a race: two managers, or a manager and a delegate, both click Approve near-simultaneously) — the state machine would make the second one 409 once the first commits, but nothing exercises the actual concurrent-request timing; low priority since Postgres's row-level locking on the `UPDATE` naturally serializes this, but it's untested.
- **No test for `MONTHLY` accrual actually behaving differently from `UPFRONT`** — because it doesn't; the flag is metadata-only today (no scheduler). A test here would need to *assert the current, limited behavior* (both accrual types grant full entitlement immediately) so a future implementer doesn't accidentally assume monthly accrual already works.

### Delegation
- **No test for a manager nominating themselves as their own delegate** (should 400, `delegateId === managerId`) — the code has this exact guard (`createDelegation`) but it's worth confirming a dedicated test exists by that name rather than just inferring from the service code.
- **No test for a delegate's authority when TWO overlapping delegations exist for different managers covering the same delegate** — `findActiveDelegatedManagerIds` would return both; unclear from the code alone whether the merge logic in `listTeamLeaveRequests` is exercised with more than one simultaneous delegation.

### Frontend
- **No test file found for `GoogleLoginButton.jsx`** directly (only exercised indirectly through `LoginForm.test.jsx`'s mock) — the `ResizeObserver`-based width-matching logic added this session has no direct unit test, only the mocked-through-LoginForm path.
- **No test for the CSV download link's actual `href`/filename construction** (`getLeaveTakenReportCsvUrl`) — `HrReportsPage.test.jsx` likely tests that the button/link renders, but the exact URL-building logic (query param serialization) doesn't appear to have its own assertion.

### Non-functional
- **No load/performance test** — explicitly acknowledged as not done in `docs/4.non_functional_requirements.md` (NFR-7 marked 🟡 partial: "No load testing has been performed either way").
- **No test asserting the *absence* of rate limiting** (i.e., no test currently documents this as a known, accepted gap) — worth a comment-only "known gap" marker near the login tests rather than a real test, so a future reader doesn't assume brute-force protection exists.

---

## Part 19 — Test Case → Code Trace (worked examples)

### "Employee cannot apply leave without sufficient balance"

```text
Test file: server/src/tests/integration/leaveRequests.test.js (submission block)
        ↓
POST /api/leave-requests  (employeeId's balance for this leave type is near/at zero,
                            leave type does NOT allow_negative_balance)
        ↓
leaveRequestRoutes.js → uploadLeaveRequestDocument → validateBody(submitLeaveRequestSchema)
        ↓
leaveRequestController.submit → leaveRequestService.submitLeaveRequest
        ↓
Steps 1-5 (leave type check, document check, file-type check, working-days calc, overlap
    check) all pass
        ↓
Step 6: seedBalancesForUser + getBalanceForUserAndType → days_remaining < workingDays
        ↓
!leaveType.allow_negative_balance → throw badRequest("This request would take your
    balance below zero")
        ↓
HTTP 400 { success:false, message:"...", errors:[] }
        ↓
Test asserts response.status === 400 and no row was inserted (leave_requests count unchanged)
```

### "A manager cannot act on a request outside their team"

```text
Test file: leaveRequests.test.js (authorization block)
        ↓
POST /api/leave-requests/:id/approve, where :id belongs to an employee who is NOT
    in the calling manager's direct reports and no active delegation exists
        ↓
leaveRequestController.approve → decideLeaveRequest(actor, id, "APPROVE", comment)
        ↓
findLeaveRequestById(id) → found (the request exists, just not this manager's)
        ↓
resolveActingCapacity: isOwner=false → not WITHDRAW/CANCEL → not HR_OVERRIDE →
    actor.role !== "HR_ADMIN" → isManagerOrDelegateOf(actor.id, request.employee_manager_id)
    → employee_manager_id !== actor.id AND no active delegation row found → false
        ↓
throw notFound("Leave request not found")   ← 404, NOT 403 — NFR-5's deliberate policy:
    an unrelated manager has no more legitimate reason to know this request exists
    than a total stranger
        ↓
Test asserts response.status === 404
```

### "A delegate's authority stops when their window ends"

```text
Test file: leaveRequests.test.js (authorization block)
        ↓
Setup: a delegation exists for manager M / delegate D, but its end_date is in the past
        ↓
POST /api/leave-requests/:id/approve as D, for a request whose employee_manager_id = M
        ↓
resolveActingCapacity → isManagerOrDelegateOf(D, M) → employee_manager_id(M) !== actor(D)
    → findActiveDelegation({managerId:M, delegateId:D, onDate: today}) →
      SQL: WHERE manager_id=M AND delegate_id=D AND start_date<=today AND end_date>=today
      → NO ROW (end_date < today fails the range check)
    → returns false
        ↓
throw notFound("Leave request not found")  ← 404
        ↓
Test asserts 404 outside the window, and (a separate case) 200 for the identical
    request/actor pair when today falls INSIDE the delegation's range
```

---
