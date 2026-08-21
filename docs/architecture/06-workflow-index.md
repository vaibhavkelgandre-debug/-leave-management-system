# Module workflows — index, and HR reporting/CSV

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 10 — Complete Module Workflows (index)

Every module actually present in the codebase, cross-referenced to its full trace below:

- **Accounts, roles, reporting** → [07-workflow-employee-onboarding.md](07-workflow-employee-onboarding.md).
- **Document upload & profile verification** → [08-workflow-documents-and-verification.md](08-workflow-documents-and-verification.md).
- **Payroll run & payslips** → [11-workflow-payroll-and-payslips.md](11-workflow-payroll-and-payslips.md).
- **Leave request submission** → [09-workflow-leave-application.md](09-workflow-leave-application.md).
- **Leave approval / rejection / HR override / withdraw / cancel** → [10-workflow-leave-decisions.md](10-workflow-leave-decisions.md).
- **Leave balance** → embedded in the two leave workflows (it's not a standalone workflow — every balance change is a side effect of a decision action, computed live from the ledger, never a separate "update balance" call).
- **Delegation** → [10-workflow-leave-decisions.md](10-workflow-leave-decisions.md)'s delegate sub-trace, plus the timer-driven start/end notifications in [12-workflow-notifications-and-email.md](12-workflow-notifications-and-email.md).
- **Authentication & authorization** → [05-auth-and-authorization.md](05-auth-and-authorization.md).
- **HR dashboard / reporting (CSV)** → traced below.
- **Notifications** → in-app (`notifications` table + bell) for everything, plus **three** outbound email paths, all going through `config/mailer.js` (SendGrid's HTTP API — SMTP is unusable from Render, which blocks 587 and 465) and each individually switchable via `config/mailFeatures.js`: the **password-reset link** (the only flow with no alternative delivery — returning the link in an API response would let anyone reset anyone's password), the **invite link** (also still returned to HR as a fallback, so this one degrades rather than breaks when mail is off), and the **payslip PDF** after a confirmed payroll run (attached, so it previews and downloads inside the mail client; the in-app notification and the download endpoint remain the non-email path). No SMS or push anywhere.
- **Calendar** → `MyLeaveCalendar`/`TeamLeaveCalendar`/`HolidayCalendar`, all FullCalendar-backed, fed by whichever list the host page already fetched — no separate calendar API exists.

### Part 10a — HR reporting/CSV workflow

```text
HrReportsPage.jsx (Leave Report tab)
 ↓ user picks a date range, clicks Generate
getLeaveTakenReport({startDate,endDate}) — client/src/services/leaveRequestService.js
 ↓
GET /api/leave-requests/report?startDate=...&endDate=...
 ↓
requireAuth (router-wide) — no separate role middleware; role check happens inside the controller path
 ↓
validateQuery(leaveTakenReportQuerySchema) — both dates required, endDate >= startDate
 ↓
leaveRequestController.getReport → leaveRequestService.generateLeaveTakenReport(req.user, req.query)
 ↓
subtreeEmployeeIds(actor.id) — HR admin's OWN reporting subtree only (bug fixed post-launch: this
                                 used to be unscoped, letting any HR admin report on any branch)
 ↓
findLeaveTakenReport({startDate,endDate,employeeIds}) — GROUP BY aggregation over APPROVED requests
    overlapping the period, one row per employee: {employee_id, first_name, last_name, role, request_count, total_days_taken}
 ↓
Response: [{...}] → rendered as an on-screen table
 ↓
"Download CSV" link → GET /api/leave-requests/report/csv (same params, same aggregation) →
    text/csv attachment, Content-Disposition filename="leave-report-<start>-to-<end>.csv"
```

A request only partially overlapping the period is counted **in full**, not pro-rated — a documented simplification, same category as the year-boundary balance-debit rule.

---
