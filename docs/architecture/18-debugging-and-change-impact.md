# Debugging guide & code-change impact map

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 24 — Debugging Guide

### "Employee/leave-request creation is failing"

1. **Frontend component** — check `RequestLeaveForm.jsx`'s client-side pre-checks first (date order, half-day-on-single-day, missing required document) — these fail before any network call.
2. **Network tab** — is it even reaching `POST /api/leave-requests`? Check the request payload — multipart vs JSON depending on whether a file is attached.
3. **Route** — confirm `leaveRequestRoutes.js` still has `uploadLeaveRequestDocument` *before* `validateBody` (order matters — multer populates `req.body` from the multipart form before Zod can validate it).
4. **Middleware** — a 401 here means the cookie isn't being sent or is expired — check `withCredentials: true` on the client and CORS `credentials: true` on the server, and that the frontend/backend origins match `CLIENT_ORIGIN`.
5. **Validator** — a 422 lists the exact field; check `submitLeaveRequestSchema`'s `booleanish` preprocessor if half-day flags are misbehaving via multipart (they arrive as strings).
6. **Controller** — confirm `req.user.id` is being passed as `employeeId`, never anything from the body.
7. **Service** — `submitLeaveRequest`'s validation order (Part 12) tells you exactly which check fired for a given 400/409; add a temporary log right after each step if the error message alone isn't enough.
8. **Database** — check `leave_types.is_active`/`requires_document`, and whether a *_test* vs dev DB migration mismatch could be the real cause (missing column = a generic 500, not a clean validation error).
9. **Response** — confirm the envelope shape (`{success,message,data}`) — a raw non-enveloped response usually means a route/controller bypassed the standard `sendSuccess`/`sendError` helpers.

### "Approval/rejection isn't working / returns 404 unexpectedly"

1. Is the actor actually the request's **direct** manager (not a skip-level manager) — `listTeamLeaveRequests`/approval authorization only recognizes direct reports and active delegates, never the whole subtree, for a `MANAGER`.
2. If acting as a delegate, check `delegations.start_date`/`end_date` against **today's server date**, not the browser's — `findActiveDelegation` uses `todayDateKey()` computed server-side.
3. If acting as HR, confirm the target employee is actually inside *this* HR admin's own subtree (`isUserInSubtree`) — HR authorization is per-branch, not company-wide, for mutating actions.
4. A 409 instead of 404 means the authorization passed but the state machine rejected the transition — check the request's current `status` against `TRANSITIONS`.

### "Balance looks wrong"

1. Never look at `leave_balances.entitlement` alone — that's only the entitlement, not the live balance.
2. Query `leave_balance_ledger` directly for that `(user_id, leave_type_id, year)` and sum `pending_delta`/`taken_delta` by hand — that sum *is* the balance, so if the API disagrees with your manual sum, the bug is in the `BALANCE_SELECT` query's `GROUP BY`/join, not in "drift."
3. Check which **year** the request was actually filed under — a year-boundary-spanning request debits the *start date's* year, which can surprise you if you're looking at the wrong year's ledger rows.

### "Login succeeds but the very next request 401s" (production-specific)

This is the documented Render cross-site-cookie issue in `.claude/rules.md` — check whether the frontend's `VITE_API_URL` is same-origin (via a Static Site rewrite rule) rather than the backend's absolute cross-subdomain URL; a third-party cookie block (common in Incognito) silently drops the cookie even though the login response body looked successful.

---

## Part 25 — Code Change Impact Map

```text
leaveRequestStateMachine.js (TRANSITIONS map)
        ↓ consumed by
leaveRequestService.decideLeaveRequest — every approve/reject/withdraw/cancel/override
        ↓ consumed by
leaveRequestController.js (5 route handlers)
        ↓ consumed by
client/src/services/leaveRequestService.js (5 functions)
        ↓ consumed by
RequestActions.jsx, TeamRequestList.jsx, MyLeaveRequestList.jsx, RequestDetailModal.jsx
        ↓ rendered on
ApprovalsPage.jsx, MyBalancesPage.jsx, DashboardPage.jsx (TeamOverviewSummary)
```
**If you change the state machine**: every one of the five decision endpoints' legal-transition behavior changes simultaneously (that's the point — it's the single source of truth) — but also re-check `ledgerDeltaForAction`'s switch statement, since it's keyed by the same action strings and isn't derived from the state machine automatically; adding a new action to `TRANSITIONS` without adding a matching case there will silently produce `undefined` deltas.

```text
leaveBalanceRepository.js (BALANCE_SELECT)
        ↓ consumed by
leaveBalanceService.getBalancesForUser
        ↓ consumed by
leaveBalanceController (2 routes) AND leaveRequestService.submitLeaveRequest (balance check)
        ↓ consumed by
client/src/services/leaveBalanceService.js
        ↓ rendered on
MyBalancesPage.jsx, RequestDetailModal.jsx (the balance section added this session), MyLeaveSummary.jsx
```
**If you change `BALANCE_SELECT`'s columns/joins**: every page showing a balance number changes at once, but also `submitLeaveRequest`'s negative-balance guard reads through the *same* underlying query shape via `getBalanceForUserAndType` — a change here can silently affect whether new leave requests are accepted, not just what's displayed.

```text
resolveActingCapacity (leaveRequestService.js)
        ↓ the ONLY place authorization is decided for leave-request mutations
        ↓ consumed by
decideLeaveRequest — all 5 mutating endpoints
```
**If you change this function**: you are changing authorization for approve/reject/withdraw/cancel/override simultaneously across every role and every delegation scenario — this is the highest-blast-radius function in the codebase; any change here should be re-run against the full `leaveRequests.test.js` authorization block before anything else.

```text
userRepository.findUserById / PUBLIC_USER_COLUMNS
        ↓ consumed by
Nearly every service (authService, userService, invitationService, leaveRequestService's
    joined queries reference users indirectly via leaveRequestRepository's JOINs)
```
**If you change what columns `PUBLIC_USER_COLUMNS` exposes**: it ripples into every endpoint that returns a user object, including nested user data inside leave-request rows (`employee_first_name`, `manager_first_name`, etc.) — check `leaveRequestRepository.js`'s `JOINED_COLUMNS` for anywhere it duplicates a subset of these fields rather than truly reusing the constant.

---
