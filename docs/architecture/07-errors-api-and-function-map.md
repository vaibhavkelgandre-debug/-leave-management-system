# Error handling, API map & function map

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Error handling & API documentation map

### Part 14 — Error Handling

#### Where errors are generated, caught, and transformed

```text
Any layer (validator, controller, service, repository) throws or rejects
        ↓
Zod validation failure → validate.js catches it directly → sendError(res, 422, "Validation failed", [{field,message}])
        ↓ (everything else)
A service/controller throws an AppError (badRequest/unauthorized/forbidden/notFound/conflict)
        ↓
Express's error-handling path routes it to errorHandler middleware (server/src/middlewares/errorHandler.js)
        ↓
errorHandler inspects the error:
  - instanceof AppError → use its .status and .message directly
  - Multer LIMIT_FILE_SIZE → 400
  - Postgres error code 23505 (unique violation) → 409
  - Postgres error code 23503 (FK violation) → 422
  - anything else → console.error(err) + 500 "Something went wrong"
        ↓
sendError(res, status, message, errors) → { success:false, message, errors:[] }
        ↓
Frontend axios response interceptor (apiClient.js): if status===401 and the call didn't
    set skipAuthRedirect, invokes the global unauthorized handler (AuthProvider → setUser(null))
        ↓
toHttpError(error) / toErrorMessage(error, fallback) normalize into {status,message,errors,isNetworkError}
        ↓
Component-level catch block sets local error state → rendered inline (role="alert" paragraph, consistently)
```

#### `AppError` factory helpers (`server/src/utils/appError.js`)

| Helper | Status | Used for |
|---|---|---|
| `badRequest(message, errors?)` | 400 | Business-rule violations discovered mid-service (inactive leave type, balance would go negative, cancel attempted on a past-dated leave, wrong registration code shape) |
| `unauthorized(message)` | 401 | Not logged in, invalid/expired session, invalid credentials, invalid/unverified OAuth token |
| `forbidden(message)` | 403 | Authenticated but not permitted — wrong role, or "no matching account" in the OAuth existing-user rule, or acting on your own request |
| `notFound(message)` | 404 | Resource doesn't exist, **or** the caller has no legitimate reason to know it exists (NFR-5's deliberate 403-vs-404 policy, Part 9) |
| `conflict(message)` | 409 | Illegal state transition, overlapping date ranges (leave requests, holidays, delegations), duplicate unique value surfaced as a business rule rather than a raw DB error |

#### Frontend error handling pattern (consistent across every form/list)

Every mutating call site follows: `setBusy(true) / setError(null)` → `try { await action(); onChanged(); } catch (err) { setError(toErrorMessage(err, "fallback")) } finally { setBusy(false) }` — the `finally` is important: an earlier bug (documented in `.claude/rules.md`) left `busy` stuck `true` forever after a *successful* action, because `onChanged()` only re-renders the same row component with new props, it doesn't remount it, so state set only in `catch` never gets reset on the success path.

---

### Part 15 — API Documentation Map

The full endpoint-by-endpoint reference (request/response shapes, every error case) already lives in [`docs/2.api_documentation.md`](../2.api_documentation/README.md) — this is the condensed index.

| Method | Endpoint | Auth | Role | Controller | Service |
|---|---|---|---|---|---|
| GET | `/health` | none | — | — (inline in `app.js`) | — |
| POST | `/api/auth/register/hr` | none + secret code | — | `registerHrAdmin` | `authService.registerHrRoot` |
| POST | `/api/auth/login` | none | — | `login` | `authService.loginWithPassword` |
| POST | `/api/auth/google` | none | — | `googleLogin` | `authService.loginWithGoogle` |
| POST | `/api/auth/logout` | none | — | `logout` | — (`clearAuthCookie`) |
| GET | `/api/auth/me` | cookie | any | `getCurrentUser` | `userService.getUserById` |
| POST | `/api/auth/invitations/verify` | none | — | `verifyInvitation` | `invitationService.verifyInvitationToken` |
| POST | `/api/auth/invitations/accept` | none | — | `acceptInvitation` | `invitationService.acceptInvitation` |
| POST | `/api/auth/password-reset/request` | none | — | `requestPasswordReset` | `passwordResetService.requestPasswordReset` |
| POST | `/api/auth/password-reset/confirm` | none | — | `confirmPasswordReset` | `passwordResetService.confirmPasswordReset` |
| POST | `/api/users/invite` | cookie | HR_ADMIN | `inviteEmployee` | `invitationService.inviteEmployee` |
| GET | `/api/users` | cookie | any (role-scoped result) | `getUsers` | `userService.listUsersFor` |
| GET | `/api/users/me/team` | cookie | any | `getMyTeam` | `reportingService.getTeam` |
| GET | `/api/users/:id` | cookie | self/manager-of-subtree/HR | `getUserById` | `userService.getUserById` |
| PATCH | `/api/users/:id/manager` | cookie | HR_ADMIN + creator-only | `updateManager` | `userService.changeManager` |
| PATCH | `/api/users/:id/status` | cookie | HR_ADMIN + creator-only | `updateStatus` | `userService.changeStatus` |
| POST | `/api/leave-types` | cookie | HR_ADMIN | `createLeaveType` | `leaveTypeService.createLeaveType` |
| GET | `/api/leave-types` | cookie | any | `getLeaveTypes` | `leaveTypeService.listLeaveTypes` |
| GET | `/api/leave-types/:id` | cookie | any | `getLeaveTypeById` | `leaveTypeService.getLeaveTypeById` |
| PATCH | `/api/leave-types/:id` | cookie | HR_ADMIN | `updateLeaveType` | `leaveTypeService.updateLeaveType` |
| PATCH | `/api/leave-types/:id/status` | cookie | HR_ADMIN | `updateLeaveTypeStatus` | `leaveTypeService.setLeaveTypeStatus` |
| GET | `/api/leave-balances/me` | cookie | any | `getMyBalances` | `leaveBalanceService.getBalancesForUser` |
| GET | `/api/leave-balances/user/:id` | cookie | self/manager-of-subtree/HR | `getUserBalances` | `leaveBalanceService.getBalancesForUser` |
| POST | `/api/holidays` | cookie | HR_ADMIN | `createHoliday` | `holidayService.createHoliday` |
| GET | `/api/holidays` | cookie | any | `getHolidays` | `holidayService.listHolidays` |
| PATCH | `/api/holidays/:id` | cookie | HR_ADMIN | `updateHoliday` | `holidayService.updateHoliday` |
| DELETE | `/api/holidays/:id` | cookie | HR_ADMIN | `deleteHoliday` | `holidayService.deleteHoliday` |
| POST | `/api/leave-requests/preview` | cookie | any | `preview` | `leaveRequestService.previewWorkingDays` |
| POST | `/api/leave-requests` | cookie | any | `submit` | `leaveRequestService.submitLeaveRequest` |
| GET | `/api/leave-requests/mine` | cookie | any | `listMine` | `leaveRequestService.listMyLeaveRequests` |
| GET | `/api/leave-requests/team` | cookie | any (row-level scoped) | `listTeam` | `leaveRequestService.listTeamLeaveRequests` |
| GET | `/api/leave-requests/all` | cookie | HR_ADMIN | `listAll` | `leaveRequestService.listAllLeaveRequests` |
| GET | `/api/leave-requests` | cookie | HR_ADMIN (own subtree) | `listFiltered` | `leaveRequestService.listFilteredLeaveRequests` |
| GET | `/api/leave-requests/report` | cookie | HR_ADMIN (own subtree) | `getReport` | `leaveRequestService.generateLeaveTakenReport` |
| GET | `/api/leave-requests/report/csv` | cookie | HR_ADMIN (own subtree) | `downloadReportCsv` | same + `utils/csv.js` |
| GET | `/api/leave-requests/:id` | cookie | owner/manager/delegate/HR | `getOne` | `leaveRequestService.getLeaveRequestById` |
| GET | `/api/leave-requests/:id/audit` | cookie | same as above | `getAuditTrail` | `leaveRequestService.getAuditTrail` |
| GET | `/api/leave-requests/:id/document` | cookie | same as above | `getDocument` | `leaveRequestService.getLeaveRequestDocument` |
| GET | `/api/leave-requests/:id/document/download` | cookie | same as above | `downloadDocument` | `leaveRequestService.downloadLeaveRequestDocument` |
| POST | `/api/leave-requests/:id/approve` \| `/reject` | cookie | manager/delegate/HR (row-level) | `approve`/`reject` (`makeDecisionHandler`) | `leaveRequestService.decideLeaveRequest` |
| POST | `/api/leave-requests/:id/withdraw` \| `/cancel` | cookie | owner only | `withdraw`/`cancel` | same |
| POST | `/api/leave-requests/:id/override` | cookie | HR_ADMIN (own subtree) | `override` | same |
| POST | `/api/delegations` | cookie | MANAGER | `create` | `delegationService.createDelegation` |
| GET | `/api/delegations/mine` | cookie | MANAGER | `listMine` | `delegationService.listDelegationsForManager` |
| GET | `/api/delegations/as-delegate` | cookie | any | `listAsDelegate` | `delegationService.listDelegationsForDelegate` |

---

---

## Function map, by module

### Part 16 — Function Map (by module)

```text
Auth Module (server/src/services/authService.js)
├── loginWithPassword({email,password})
├── loginWithGoogle(idToken)
└── registerHrRoot({registrationCode,firstName,lastName,email,password})

Invitation Module (server/src/services/invitationService.js)
├── inviteEmployee({firstName,lastName,email,role,managerId}, invitedByUserId)
├── verifyInvitationToken(rawToken)
└── acceptInvitation({token,password})

User/Reporting Module
├── userService.listUsersFor(actor)
├── userService.getUserById(id)
├── userService.changeManager(id, managerId, actor)
├── userService.changeStatus(id, status, actor)
├── reportingService.getTeam(userId)
├── reportingService.assertManagerAllowed(targetRole, newManagerId)
└── reportingService.assertNoCycle(userId, newManagerId, targetRole)

Leave Type Module (server/src/services/leaveTypeService.js)
├── createLeaveType(fields)          — also triggers backfillBalancesForLeaveType
├── listLeaveTypes(includeInactive)
├── getLeaveTypeById(id)
├── updateLeaveType(id, fields)
└── setLeaveTypeStatus(id, isActive)

Leave Balance Module (server/src/services/leaveBalanceService.js)
├── getBalancesForUser(userId, year)  — self-heals missing rows, derives days_taken/pending/remaining from the ledger
├── seedBalancesForUser(userId)
└── backfillBalancesForLeaveType(leaveTypeId)

Holiday Module (server/src/services/holidayService.js)
├── createHoliday(fields)             — 409 on date-range overlap
├── listHolidays(year)
├── getHolidayById(id)
├── updateHoliday(id, fields)
└── deleteHoliday(id)

Leave Request Module (server/src/services/leaveRequestService.js) — the largest module
├── previewWorkingDays({startDate,endDate,startHalfDay,endHalfDay})
├── submitLeaveRequest(employeeId, fields, file)
├── resolveActingCapacity(actor, request, action)   — the authorization chokepoint (Part 9)
├── isManagerOrDelegateOf(actorId, employeeManagerId)
├── decideLeaveRequest(actor, requestId, action, comment)  — approve/reject/withdraw/cancel/override, all of them
├── ledgerDeltaForAction(action, workingDays)         — private helper
├── listMyLeaveRequests(employeeId)
├── listTeamLeaveRequests(actor)                      — merges delegated-for teams
├── listAllLeaveRequests()
├── listFilteredLeaveRequests(actor, filters)
├── generateLeaveTakenReport(actor, {startDate,endDate})
├── getLeaveRequestById(actor, requestId)
├── getAuditTrail(actor, requestId)
├── getLeaveRequestDocument(actor, requestId)
└── downloadLeaveRequestDocument(actor, requestId)

Working Day Calculation (server/src/services/workingDayService.js)
└── calculateWorkingDays({startDate,endDate,startHalfDay,endHalfDay,holidays})   — pure, no DB

State Machine (server/src/services/leaveRequestStateMachine.js)
└── assertLegalTransition(action, currentStatus)

Delegation Module (server/src/services/delegationService.js)
├── createDelegation(managerId, {delegateId,startDate,endDate})
├── listDelegationsForManager(managerId)
└── listDelegationsForDelegate(delegateId)
```

---
