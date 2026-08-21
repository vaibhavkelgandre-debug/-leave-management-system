# Function map, by module

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 16 — Function Map (by module)

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
