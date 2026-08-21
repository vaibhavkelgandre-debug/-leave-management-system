# Module 1 — accounts, roles & reporting structure

> Part of [Functional Requirements](README.md). If this disagrees with the code, the code wins.

---

## Module 1: Accounts, Roles & Reporting Structure

### Status Legend

| Emoji | Meaning |
|-------|---------|
| ✅ | **Done** — implemented end-to-end and covered by an integration test |
| 🟡 | **Partial** — some code exists, but incomplete, untested, or blocked on another module |
| ⬜ | **Not Started** — no corresponding code found yet |

> Statuses below reflect the codebase as of **2026-08-14** (all five modules built, including Module 5's payroll/profile additions beyond the original brief). Re-check and update as work progresses.

---

### ✅ FR-001: Employee Invitation

- HR administrator can add a new employee.
- Employee receives an invitation link.
- Employee sets their own password.
- Real email delivery is not required; displaying or logging the invitation link is sufficient.

*Implemented via `invitationService.js` / `invitationRepository.js` / `authController.js` (`verifyInvitation`, `acceptInvitation`); tested in `invitationFlow.test.js`.*

---

### ✅ FR-002: Secure Password Storage

- Passwords must never be stored or logged in plain text.

*Implemented via `utils/password.js` using bcrypt hashing (10 salt rounds).*

---

### ✅ FR-003: Social Login

- Employee can log in using at least one OAuth 2.0 provider.
- Supported providers may include Google or GitHub.
- If the OAuth email matches an existing employee account, both accounts must resolve to a single user account.

*Implemented via `config/googleClient.js` / `authController.js` (`googleLogin`) / `oauthAccountRepository.js`; tested in `authGoogle.test.js`.*

---

### ✅ FR-004: User Roles

System must support three roles:

- Employee
- Manager
- HR Administrator

Everyone is an employee. Managers and HR have additional permissions.

*Implemented via `roleRepository.js` + seed migrations; enforced with the `requireRole` middleware.*

---

### ✅ FR-005: Reporting Structure

- Every employee has exactly one manager.
- The top-level employee has no manager.
- Reporting structure forms a tree.
- Cycles are not allowed.

**Example (valid):**
```
CEO
 ↓
Manager
 ↓
Employee
```

**Invalid:**
```
A → B
B → C
C → A
```

- Changing a person's manager, or activating/deactivating their account, is done from "My Team" (`TeamPage.jsx`, `/dashboard/team`) — the page for managing your own reports, not from "All Employees" (`EmployeesPage.jsx`), which is a read-only, reporting-line-grouped directory of the whole company. Both pages render the same `EmployeePersonRow`; `EmployeesPage.jsx` just renders it with `showActions={false}`. The permission rule is unchanged either way: only whoever invited a person (`invited_by`) may edit their manager or status.
- "My Team" also tags each row with their profile verification status (`INCOMPLETE`/`SUBMITTED`/`VERIFIED`, `showProfileStatus` on `EmployeePersonRow`) — the same field FR-027 tracks — so HR/a manager can tell at a glance who on their team is already verified without opening each profile. "All Employees" doesn't show this tag; only "My Team" does.

*Implemented via `reportingService.js` (`assertManagerAllowed`, `assertNoCycle`, `isUserInSubtree`, `findSubtreeUsers`); tested in `reportingCycle.test.js`. The two pages share `EmployeePersonRow.jsx`/`EmployeeTeamCard.jsx` (team/manager-card row rendering) and `employeeGroups.js` (`groupEmployeesForOrgView` — the leadership/teams/unassigned grouping `EmployeesPage.jsx` uses to visualize the reporting tree without an actual tree/graph component); action-toggling tested in `TeamPage.test.jsx` (interactive) and `EmployeesPage.test.jsx` (read-only).*

---

### ✅ FR-006: Role-Based Access

Employee can:
- View own leave

Manager can:
- View own leave
- View team leave
- Approve/reject team requests

HR can:
- View everything

Authorization must be enforced on the server.

*Generic RBAC infrastructure (`requireRole`, `requireUserScope`) was already done and tested (`usersScope.test.js`); the leave-specific rules landed with Module 3 via `leaveRequestService.js` → `resolveActingCapacity` — an employee sees only their own requests (`GET /leave-requests/mine`), a manager sees and can act on their direct reports' (`GET /leave-requests/team`, scoped to `findDirectReports`), and HR sees and can act on everyone's. Tested in `leaveRequests.test.js`.*

---
