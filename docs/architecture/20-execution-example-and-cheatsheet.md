# Complete execution example & cheat sheet

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 29 — Complete Execution Example

```text
Manager clicks "Approve" on a pending request in TeamRequestList
↓
RequestActions.jsx: runAction(() => approveLeaveRequest(request.id))
↓
client/src/services/leaveRequestService.js: approveLeaveRequest(id, comment)
↓
POST /api/leave-requests/:id/approve  { comment }
↓
server/src/routes/leaveRequestRoutes.js — requireAuth (router-wide), no extra role gate for this action
↓
validateParams(leaveRequestIdParamSchema) + validateBody(decisionSchema)
↓
leaveRequestController.js: approve = makeDecisionHandler("APPROVE")
↓
leaveRequestService.js: decideLeaveRequest(req.user, id, "APPROVE", comment)
↓
findLeaveRequestById(id)  →  the joined request row, current status SUBMITTED
↓
resolveActingCapacity(actor, request, "APPROVE")
    → not the owner → not WITHDRAW/CANCEL → not an override action
    → actor.role === "MANAGER" → isManagerOrDelegateOf(actor.id, request.employee_manager_id)
    → employee_manager_id === actor.id → true, direct manager
    → return { actedFor: null }
↓
assertLegalTransition("APPROVE", "SUBMITTED")  →  "APPROVED" (legal move)
↓
ledgerDeltaForAction("APPROVE", workingDays)  →  { pendingDelta: -workingDays, takenDelta: workingDays }
↓
updateLeaveRequestStatus(id, { status:"APPROVED", decidedBy:actor.id, decisionComment:comment })
    → UPDATE leave_requests SET status=$2, decided_by=$3, decided_at=NOW(), decision_comment=$4 ...
↓
insertLedgerEntry({ userId, leaveTypeId, year, leaveRequestId, pendingDelta:-workingDays,
    takenDelta:workingDays, reason:"APPROVE" })
    → INSERT INTO leave_balance_ledger (...) VALUES (...)
↓
insertAuditLog({ leaveRequestId, actorId:actor.id, actedFor:null, action:"APPROVE",
    oldStatus:"SUBMITTED", newStatus:"APPROVED", comment })
    → INSERT INTO audit_logs (...) VALUES (...)
↓
findLeaveRequestById(id)  →  fresh joined row, now status APPROVED
↓
Controller: sendSuccess(res, 200, "Leave request updated", request)
↓
HTTP 200 { success:true, message:"Leave request updated", data:{...status:"APPROVED"...} }
↓
Frontend: RequestActions.runAction — onChanged() called on success
↓
ApprovalsPage.jsx: reload() — bumps reloadToken
↓
useEffect re-fires: getTeamLeaveRequests() (or getAllLeaveRequests() on the All Requests tab)
    + the holidays effect
↓
TeamRequestList re-renders with the updated status; the employee's balance (visible on
    MyBalancesPage/RequestDetailModal) now reflects the ledger's new taken/pending split
    the next time it's fetched — no explicit "push" to the employee's own open tab, since
    there's no websocket/real-time layer in this app (confirmed absent)
```

---

## Part 30 — Final Architecture Cheat Sheet

```text
Frontend:        React 18 (Vite), react-router-dom, Axios, Tailwind CSS, @react-oauth/google, @fullcalendar/*
Backend:         Node.js (ESM) + Express.js
Database:        PostgreSQL, raw parameterized SQL via `pg` — no ORM
Authentication:  Stateless JWT in an httpOnly cookie; 2 paths — password (bcrypt) and Google
                 OAuth (ID token) — both login-only, never signup
Authorization:   resolveActingCapacity() for leave requests; requireUserScope for users/balances —
                 both single reusable functions, not scattered conditionals
Architecture:    Layered REST API: Routes → Validator → Controller → Service → Repository → PostgreSQL
Main Modules:    Auth, Invitations, Users/Reporting, Leave Types, Leave Balances (ledger-derived),
                 Holidays, Leave Requests (submit/decide/report), Delegations
Important Routes: /api/auth/*, /api/users/*, /api/leave-types/*, /api/leave-balances/*,
                 /api/holidays/*, /api/leave-requests/*, /api/delegations/*
Important Controllers: leaveRequestController.js (largest — 13 handlers), authController.js, userController.js
Important Services: leaveRequestService.js (resolveActingCapacity, decideLeaveRequest, submitLeaveRequest),
                 leaveRequestStateMachine.js, workingDayService.js, reportingService.js, authService.js
Important Models: users (self-referencing manager_id tree), leave_requests, leave_balance_ledger
                 (append-only, drives every balance figure), audit_logs (append-only), oauth_accounts
                 (provider-agnostic), delegations
Testing Framework: Vitest both sides; Supertest + a real `_test` Postgres DB for backend integration
                 tests; React Testing Library for frontend component tests
Deployment:      Render — frontend Static Site + backend Web Service, separate subdomains (cross-site,
                 not just cross-origin — cookie needs SameSite=None+Secure in production)
```

## 10 Most Important Things to Remember

1. **Balances are never stored/mutated — they're `SUM()`ed live from an append-only ledger** every single read. This is the structural answer to "how do you keep a balance from drifting."
2. **One function, `resolveActingCapacity`, decides who can approve/reject/withdraw/cancel/override any leave request** — owner-only for withdraw/cancel, never-the-owner for approve/reject/override, then branches HR-subtree vs. direct-manager-or-active-delegate.
3. **One explicit map, `TRANSITIONS`, is the entire legal-state-move universe** for a leave request — nothing else in the codebase changes a request's status.
4. **HR authority for *mutating* actions is scoped per-branch (own reporting subtree), never company-wide** — even though HR can *view* everyone. This app supports multiple HR admins, each rooted at a different branch.
5. **An employee can never act on their own request in any capacity that requires a role** (approve/reject/override) — checked before any role branch, regardless of what other role they might also hold.
6. **403 vs 404 is a deliberate policy, not an accident**: 404 when the caller has no legitimate reason to know a record exists at all; 403 when they already know it exists (it's theirs) but this action isn't theirs to take.
7. **Google OAuth is login-only — never signup.** An unmatched email is a 403, proven-genuine-identity-but-no-permission, distinct from the 401 used for an invalid/unverifiable credential.
8. **`requireAuth` re-fetches the live user from the DB on every request** rather than trusting the JWT payload — this is why deactivating someone or changing their role takes effect on their very next request, not at token expiry.
9. **No ORM, no transactions, no rate limiting** — three deliberate/accepted gaps worth being able to name unprompted: raw SQL everywhere (control + recursive CTEs), multi-statement writes aren't atomic (a real if narrow consistency risk), and there's zero brute-force protection on login/reset/registration endpoints (the single highest-value security improvement available).
10. **A leave request's `working_days` is snapshotted at submission and never recomputed** — editing the holiday calendar later cannot retroactively change an already-decided request's day count or the balance history it produced. This is also *why* "HR adds a holiday inside already-approved leave" currently does nothing — no code path recalculates existing requests.
