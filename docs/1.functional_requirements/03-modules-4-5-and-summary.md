# Modules 4–5 — dashboards, reporting, payroll, profile & summary

> Part of [Functional Requirements](README.md). If this disagrees with the code, the code wins.

---

## Module 4 — dashboards & reporting

### Module 4: Dashboards & Reporting

#### ✅ FR-022: Employee Dashboard

Employee can view:
- Leave balance
- Request history
- Personal calendar

*Leave balance and request history are both covered — the full detail lives on `MyBalancesPage.jsx` (balance cards + "My requests" history), and a condensed at-a-glance version lives on `DashboardPage.jsx` via `MyLeaveSummary.jsx`. The personal calendar is `MyLeaveCalendar.jsx` — a month-grid (same compact FullCalendar setup as `calendar/HolidayCalendar.jsx`) showing the employee's own SUBMITTED/APPROVED requests (amber/green dots) alongside public holidays (indigo dots), sitting next to the request list on `MyBalancesPage.jsx`. Clicking a request's dot highlights and scrolls to its row in the list below, the same click-to-select interaction `HolidaysPage.jsx` already used for holidays. Withdrawn/rejected/cancelled requests are deliberately left off the calendar (they never happened) but stay visible in the list, which shows full history regardless of status. Tested in `MyLeaveRequestList.test.jsx` (the selection/highlight behavior) and `MyBalancesPage.test.jsx` (the calendar actually mounts, and the click-to-highlight wiring).*

---

#### ✅ FR-023: Manager Dashboard

Manager can view:
- Pending approvals
- Team calendar

*Pending approvals is done — the full list lives on `ApprovalsPage.jsx` (`/dashboard/approvals`, manager's direct reports; HR sees everyone with an override option), and `DashboardPage.jsx` surfaces a summary via `TeamOverviewSummary.jsx`. The team calendar is `TeamLeaveCalendar.jsx`, added directly to `ApprovalsPage.jsx` (sticky left column, same layout as the personal calendar on `MyBalancesPage.jsx`) rather than a separate page — it's fed whichever `requests` the page already fetched for the active tab (My Team / All Requests), so it's automatically scoped the same way for MANAGER, HR_ADMIN, and a delegate-employee alike, with zero new backend endpoints. Unlike the compact dot-only `HolidayCalendar.jsx`/`MyLeaveCalendar.jsx` style, each request renders as a small labeled bar ("Asha · Sick Leave", green/amber by status) since a team view needs to say *who* at a glance, not just *whether*; public holidays still render as compact indigo dots alongside. Clicking a bar highlights and scrolls to the matching row in `TeamRequestList.jsx` beside it, same click-to-select pattern used twice already (`HolidayCalendar`↔`HolidayList`, `MyLeaveCalendar`↔`MyLeaveRequestList`). Tested in `ApprovalsPage.test.jsx`.*

---

#### ✅ FR-024: HR Dashboard

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

---

## Module 5 — payroll & employee profile

### Module 5: Payroll & Employee Profile

> Not part of the original brief — added afterward, then substantially reworked once the real onboarding/payroll requirements (a full employee-record spreadsheet plus an onboarding→payroll flowchart) were provided. Salary slips moved from a monthly bulk-CSV upload to a one-time-per-employee salary structure with a calculated monthly payroll run; the profile grew from 10 fields to the full spreadsheet shape plus a document-upload-and-HR-verification workflow gating who's "payroll-ready".

#### ✅ FR-025: Salary Slip Generation (calculated payroll)

- HR assigns each employee a **salary structure** once (Basic salary, HRA, PF employee/employer contribution, ESIC, Special Allowance, Income Tax) rather than re-entering figures every month.
- HR picks a pay period; the system **calculates** net pay for every payroll-ready employee in HR's own subtree from their structure plus **LOP (loss of pay)** derived from approved leave — no file upload, no manual monthly data entry.
- An employee is only included once their profile is `VERIFIED` (FR-027) **and** a salary structure exists for them; anyone missing either is reported as skipped, with a reason, never silently dropped.
- HR reviews the calculated figures before approving; approving commits the run and generates downloadable PDF payslips.
- A slip is visible only to the employee it belongs to, and to HR — never to that employee's manager.
- Re-running a period updates the existing slip; the previous values are archived, not discarded.
- Before calculating, HR may narrow the run to a role and/or a profile verification status (e.g. only `VERIFIED` employees, or only `EMPLOYEE`s) — the same filter carries through from calculate to approve, so what gets confirmed always matches exactly what was previewed, never a broader, unfiltered run.
- Payroll generation lives on its own dedicated page (`/dashboard/payroll-run`), not a modal on the Salary Slips page — the pay-period picker, the role/profile-status filters, the preview table, and the approve step all need room of their own to stay organized as a distinct HR workflow, separate from just *viewing* slip history.
- If HR generates a slip for the wrong pay period by mistake, they can **void** it from the Salary Slips page instead of it just sitting there wrong — a soft delete (a `VOIDED` status), not a real delete, so there's still a record that a mistake happened and was corrected, matching this feature's existing archive-rather-than-discard philosophy. A voided slip stays visible (tagged `VOIDED`, with the optional reason HR gave) rather than disappearing; re-confirming that same pay period later supersedes the void and makes the slip `ACTIVE` again.

*Salary structures: `salaryStructureRepository.js` (`upsertStructure` — a single atomic archive-then-upsert statement, same convention as `replaceSlipsForPeriod`) / `salaryStructureService.js` (self-or-HR-in-subtree to view, HR-in-subtree-only to assign) / `PATCH`\|`GET /api/employees/:id/salary-structure`. Tables: `salary_structures` + append-only `salary_structure_revisions` (`024_create_salary_structures.sql`).*

*Filters/void: `030_alter_salary_slips_add_status.sql` adds `salary_slips.status` (`ACTIVE`\|`VOIDED`, default `ACTIVE`) plus `voided_by`/`voided_at`/`void_reason`. `salarySlipService.js`: `calculateForSubtree(actor, payPeriod, { role, profileStatus })` filters the subtree before computing anything (a pre-filter on *who's included*, separate from the existing per-employee `skipped` reasons for missing verification/structure); `calculatePayroll`/`confirmPayroll` both take and forward the same `{ role, profileStatus }` shape. `voidSalarySlip(actor, id, reason)` — HR-only, subtree-scoped like `getSalarySlipById`, 409 if already voided; `replaceSlipsForPeriod`'s `ON CONFLICT` reset (`status = 'ACTIVE', voided_by/voided_at/void_reason = NULL`) is what makes re-confirming supersede a void. Routes: `POST /api/salary-slips/calculate`\|`/confirm` (body gains optional `role`/`profileStatus`), `POST /api/salary-slips/:id/void`. Frontend: `PayrollRunPage.jsx` (`/dashboard/payroll-run`, HR-only) wraps `PayrollRunForm.jsx` (now with role/profile-status selects); `SalarySlipsPage.jsx`'s "Run payroll" is a link to that page, not a `Modal`; `SalarySlipList.jsx` shows a `VOIDED` badge and a `canVoid`-gated Void action (HR's team view only, never the employee's own history).*

*LOP: `leave_types.counts_as_lop` (`025_alter_leave_types_add_counts_as_lop.sql`) lets HR flag a leave type (e.g. "Loss of Pay") as unpaid; `leaveRequestRepository.findLopWorkingDays` sums `working_days` on `APPROVED` requests of such a type overlapping the pay period — reusing the existing leave-request/leave-type data instead of a separate attendance system, which doesn't exist in this app. Per-day rate = (basic + HRA + special allowance) ÷ calendar days in the month; PF employer contribution is recorded but never subtracted from net pay (a company cost, not a deduction); income tax is a flat HR-entered figure, not a computed slab-based TDS calculation.*

*Payroll run: `salarySlipService.js` (`calculatePayroll` — pure read, writes nothing; `confirmPayroll` — re-runs the same calculation server-side and commits it, so nothing computed client-side is ever trusted or resent) / `salarySlipController.js` / `POST /api/salary-slips/calculate` \| `/confirm`, `GET /mine` \| `/` \| `/:id` \| `/:id/pdf`. `salary_slips`/`salary_slip_revisions` columns reworked in `026_alter_salary_slips_for_structure_payroll.sql` to match the structure's components plus `lop_days`/`lop_deduction`. PDF payslips are rendered on demand via `pdfkit` (`payslipPdfService.js`) — never persisted as a file, same "generate fresh on every authorized request" philosophy as Cloudinary's signed URLs. Frontend: `SalarySlipsPage.jsx` (`/dashboard/salary-slips`), `PayrollRunForm.jsx` (calculate → review → approve), `SalarySlipList.jsx` (with a PDF download link per slip). Tested in `salarySlips.test.js`, `salaryStructures.test.js`.*

---

#### ✅ FR-026: Employee Profile Management

- Employee can view and edit their own personal details, matching the fields on the source onboarding spreadsheet: designation, department, contact info, date of birth, education, passport, joining/last working date, blood group, marital status, current/permanent address, nearest airport, health details, two emergency contacts (phone + relationship each), PAN/Aadhar numbers, and bank details.
- Fields HR already manages elsewhere (role, manager, status) stay read-only on this page.
- PAN/Aadhar/passport/bank fields are shown in full only to HR and the employee themself — masked (`null`) for a manager viewing a report; every other profile field is visible to a manager for their own reports, same as any other user field.
- Employee can change their own password (distinct from the existing forgot-password reset flow, which doesn't require knowing the current one) — from a "Change password" button (`ProfilePage`, or a dropdown under the TopBar identity block) that opens a modal, not an always-visible inline form.
- The profile opens **read-only** — every saved field is visible but disabled — until the employee checks "Edit details"; unchecking it (or a successful save) returns to read-only. This applies to the profile fields and the document uploads alike (they share the same "Government ID & bank details" section), but never to the section expand/collapse toggles themselves, which always work so a read-only profile can still be looked through.
- Passport and health-insurance fields each have an "I don't have one" checkbox — checking it hides (and clears) the corresponding field(s), since neither is required and a blank field otherwise reads as "not filled in yet" rather than "not applicable".

*Migration `020_alter_users_add_profile_fields.sql`'s original 10 columns were replaced by `022_alter_users_profile_v2.sql`'s fuller set (`address`/single emergency contact dropped; ~24 columns added) to match the spreadsheet exactly. `userRepository.updateProfileFields` (camelCase-in/snake_case-SQL, matching `insertUser`'s convention) whitelists exactly the self-editable columns. `userService.maskSensitiveProfileFields` nulls the 6 sensitive columns (added `passport_number`) for any viewer who isn't the subject or `HR_ADMIN`, applied inside `getUserById`/`listUsersFor`/`getMyTeam`. `PATCH /api/users/me/profile` and `POST /api/users/me/password` are both self-only by construction (always `req.user.id`, no `:id` param). Change-password reuses `hashPassword`/`verifyPassword` from `utils/password.js`, same as the reset flow. Frontend: `ProfilePage.jsx` (`/dashboard/profile`), `ProfileForm.jsx`, `ChangePasswordForm.jsx` inside `ChangePasswordModal.jsx` (shared by `ProfilePage` and `TopBar`'s dropdown). Tested in `userRoutes.test.js` and the masking test in `usersScope.test.js`.*

---

#### ✅ FR-027: Employee Onboarding & Profile Verification

- New flow: HR creates the account → employee logs in and completes their profile → uploads the required identity/bank/offer documents (PAN card, Aadhar card, bank passbook, signed offer letter — proof for the `pan_number`/`aadhar_number`/bank fields and the joining date/compensation on the same form) → submits for review → HR verifies (or sends it back with a reason) → HR assigns a salary structure → the employee is payroll-ready.
- The document uploads live inside the profile form's "Government ID & bank details" section, right next to the corresponding number fields — not a separate, disconnected "documents" step. (An earlier version required a payslip-history/relieving-letter pair instead; replaced once it was clear those weren't the actual documents HR needed to verify.)
- An employee may also attach any number of additional, self-named documents (e.g. a degree certificate) — optional, never checked at submission, just a convenient place to keep them on the profile. Every document's "View" action opens the signed link in the current tab rather than a new one.
- Submission is blocked (400) until a minimum set of required fields and all required documents are present — checked server-side, not assumed client-side.
- Documents are visible only to the employee and to HR within their subtree — never to a manager. Re-uploading one of the required documents replaces the previous one, resetting it to pending review.
- HR's verification queue (`/dashboard/profile-verification`) lists submitted profiles by name; opening one navigates to a dedicated detail page (`/dashboard/profile-verification/:id`), not a modal — there's enough on a submission (full profile summary, four documents, the salary-structure form) that a modal stopped being a good fit. Each document opens in its own small preview modal (image via `<img>`, PDF via `<iframe>`) from within that page, so reviewing several documents doesn't mean navigating away and back.
- Each required document has its own Verify/Reject control on the detail page, independent of the whole-profile Verify/Send-back decision — a document's status only changes when HR explicitly reviews *that* document, not as a side effect of the profile-level decision.
- The employee's dashboard and profile page both show who's above them in the reporting chain: their direct manager, and the nearest HR_ADMIN ancestor — i.e. specifically whichever HR admin's subtree contains them, so it's clear in advance who will actually verify their profile (not just "some HR admin"). If the direct manager already is that HR admin, the HR line is omitted rather than repeated.
- Below the pending-review queue, a "Verified Employees" section lists everyone in HR's own subtree whose profile has already reached VERIFIED. "See details" opens a new, dedicated employee-details page at `/dashboard/team/:id` — under "team", not "employees" — rather than the verification detail page: there's nothing left to verify or send back, so that page drops the Verify/Send-back action bar and the per-document Verify/Reject controls, keeping only the read-only profile summary, read-only documents, and — the one thing HR still routinely returns for — an editable salary structure. Both pages share `EmployeeProfileSummary.jsx` and `EmployeeDocumentList.jsx` so the two stay visually and structurally identical. The `/dashboard/team/:id` route is registered inside the HR_ADMIN-only route group (not the MANAGER-or-HR_ADMIN group that plain `/dashboard/team` sits in), matching the server side's `GET /api/employees/:id`, which is HR-only regardless of URL — a manager can see their team list, but not open this detail page.
- Sending a profile back always requires a reason (e.g. "PAN number doesn't match the uploaded PAN card") — HR can't send one back with no explanation, since the employee has no way to fix "misleading info" without knowing which info, or why it didn't match their documents. The reason is stored on the employee's own record and shown to them (a banner on their Profile page) for as long as their profile stays `INCOMPLETE` because of it; resubmitting clears it, since it's now been addressed and a fresh review cycle has started.

*State machine: `users.profile_status` (`INCOMPLETE → SUBMITTED → VERIFIED`, or `SUBMITTED → INCOMPLETE` via HR's send-back) — `profileVerificationStateMachine.js`, the same explicit from/to transition-map shape as `leaveRequestStateMachine.js`. `userService.js`: `submitProfileForVerification` (validates required fields + all required documents present), `verifyProfile`/`sendProfileBack` (HR + subtree-scoped, `isUserInSubtree`), `listPendingVerification` (queue rows), `listVerifiedEmployees` (same subtree scoping, `profile_status = 'VERIFIED'` instead), `getEmployeeForVerification` (the detail page's full-profile fetch — deliberately its own subtree-scoped function rather than reusing `GET /api/users/:id`, which lets any HR admin view any user company-wide and doesn't match the per-branch isolation every other HR-scoped action here enforces; reused as-is for the employee-details page too, since it isn't filtered by profile_status). `users.profile_send_back_reason`/`profile_send_back_by`/`profile_send_back_at` (`031_alter_users_add_profile_send_back_reason.sql`) mirror the existing `profile_verified_by`/`profile_verified_at` pair; `userRepository.updateProfileStatus` is the single UPDATE behind all three transitions (submit/verify/send-back), defaulting every field not relevant to the current transition to `null` — which is what clears a stale send-back reason on the next submit. Documents: `employee_documents` table (`023_create_employee_documents.sql`, document types reworked in `027_alter_employee_documents_types.sql` to `PAN_CARD`/`AADHAR_CARD`/`BANK_PASSBOOK`, `028_alter_employee_documents_add_custom.sql` added `OTHER` for custom documents, `029_alter_employee_documents_add_offer_letter.sql` added `OFFER_LETTER`; the three-plus-offer-letter required types stay capped at one row per employee via a partial unique index excluding `OTHER`, which allows unlimited custom rows) / `employeeDocumentRepository.js` / `employeeDocumentService.js` (visibility mirrors salary slips' self-or-HR-in-subtree rule, not the leave-document rule; `reviewDocument` is HR-only, subtree-scoped, and is what actually moves a document out of `PENDING_REVIEW`) — Cloudinary storage reuses the private `type: authenticated` asset pattern from `leave_request_documents`, via a shared `cloudinaryService.uploadPrivateAsset` helper; `deletePrivateAsset` removes a custom document's asset when the employee deletes it (the only delete anywhere in this document flow). Routes: `POST /api/employees/me/profile/submit`, `POST /api/employees/me/documents/:documentType` \| `/custom`, `GET /api/employees/me/documents` \| `/:documentType/url` \| `/custom/:documentId/url` \| `/:id/documents` \| `/:id/documents/:documentType/url`, `GET /api/employees/:id` (the detail/details pages' profile fetch), `POST /api/employees/:id/documents/:documentType/review` \| `/:id/verify` \| `/:id/send-back` (body: `{ reason }`, required), `GET /api/employees/pending-verification`, `GET /api/employees/verified`, `DELETE /api/employees/me/documents/custom/:documentId`. Frontend: `ProfileDocumentUpload.jsx` (rendered inside `ProfileForm.jsx`, not `ProfilePage.jsx` directly), `EmployeeVerificationPage.jsx` (the queue + Verified Employees list, `/dashboard/profile-verification`, HR-only), `EmployeeVerificationDetailPage.jsx` (the review page, `/dashboard/profile-verification/:id`, HR-only — "Send back" opens an inline reason prompt, disabled until non-empty), `EmployeeDetailsPage.jsx` (the read-only-profile + editable-salary-structure page, `/dashboard/team/:id`, HR-only), `SalaryStructureForm.jsx`. Tested in `profileVerification.test.js` and `employeeDocuments.test.js`.*

---

---

## Summary table

### 📊 Functional Requirements Summary

| Status | ID | Requirement |
|--------|-----|-------------|
| ✅ | FR-001 | Employee Invitation |
| ✅ | FR-002 | Secure Password Storage |
| ✅ | FR-003 | OAuth Login |
| ✅ | FR-004 | User Roles |
| ✅ | FR-005 | Reporting Hierarchy |
| ✅ | FR-006 | Role-Based Authorization |
| ✅ | FR-007 | Leave Type Management |
| ✅ | FR-008 | Leave Balance Management |
| ✅ | FR-009 | Half-Day Leave |
| ✅ | FR-010 | Holiday Calendar |
| ✅ | FR-011 | Leave Request Submission |
| ✅ | FR-012 | Document Upload |
| ✅ | FR-013 | Working Day Calculation |
| ✅ | FR-014 | Balance Validation |
| ✅ | FR-015 | Leave Overlap Detection |
| ✅ | FR-016 | Leave State Management |
| ✅ | FR-017 | Manager Approval |
| ✅ | FR-018 | HR Override |
| ✅ | FR-019 | Leave Withdrawal & Cancellation |
| ✅ | FR-020 | Delegation |
| ✅ | FR-021 | Audit Trail |
| ✅ | FR-022 | Employee Dashboard |
| ✅ | FR-023 | Manager Dashboard |
| ✅ | FR-024 | HR Dashboard & Reporting |
| ✅ | FR-025 | Salary Slip Generation (calculated payroll) |
| ✅ | FR-026 | Employee Profile Management |
| ✅ | FR-027 | Employee Onboarding & Profile Verification |

**Progress: 27 done · 0 partial · 0 not started** (of 27) — every functional requirement in the brief is implemented, plus three (FR-025–027) added afterward beyond the original brief.
