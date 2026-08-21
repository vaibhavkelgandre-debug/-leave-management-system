# Module 5 — payroll & employee profile

> Part of [Test Cases](README.md). If this disagrees with the code, the code wins.

---

## Module 5: Payroll & Employee Profile

### ✅ Covered

**Server — `profileVerification.test.js`**
- Rejects submission with missing fields (400) or missing required documents (400)
- Full state machine: `INCOMPLETE → SUBMITTED → VERIFIED`, visible in HR's pending queue only while `SUBMITTED`
- Send-back to `INCOMPLETE` with a required reason (422 if missing), reason visible to the employee, cleared on resubmission
- Rejects verify/send-back from non-HR (403) or an out-of-subtree HR admin (404)
- Rejects verifying a still-`INCOMPLETE` profile (409)
- Detail fetch scoped to the caller's subtree; verified-employee listing scoped the same way

**Server — `profileVerification.test.js`** (document-gate cases)
- Refuses to verify a profile while any required document is still `PENDING_REVIEW` (400, names the missed document, profile stays in the queue)
- Refuses to verify a profile with a `REJECTED` document, and the message points HR at sending it back rather than retrying
- Blocks resubmission until a rejected document is actually replaced, then accepts it and lets HR verify once the replacement is reviewed

**Server — `employeeDocuments.test.js`**
- 401 unauthenticated; rejects non-PDF/JPG/PNG content regardless of declared type (400)
- Upload replaces a prior upload of the same required type; visibility scoped to uploader + in-subtree HR (404 otherwise)
- HR review (verify/reject with comment), rejected from non-HR (403)
- Custom documents: add any number, requires a name (422), fetch/delete own only (404 for someone else's)

**Server — `employeeDocuments.test.js`** (document streaming)
- Streams a document `inline` by default — correct `Content-Type`, `Content-Disposition: inline`, original filename, real bytes — which is what makes a PDF previewable at all (Cloudinary raw delivery forces a download)
- `?disposition=attachment` still forces a save; the `/url` payload carries the `documentId` the viewer needs
- 404 for a peer employee, 401 unauthenticated, 422 for a malformed id or a `disposition` outside the two allowed values

**Server — `salaryStructures.test.js`**
- 401 unauthenticated; rejects non-HR (403)
- Assign within subtree, visible to employee + HR; update archives prior figures as a revision
- Out-of-subtree employee unreachable (404)

**Server — `salarySlips.test.js`**
- 401 on every route; rejects calculate/confirm from non-HR (403)
- Skips (without failing the run) unverified/no-structure employees, and one not yet joined for the period, with per-row reasons
- Correct net-pay calculation with zero LOP; correct LOP deduction and per-day rate rounding for a `counts_as_lop` type
- Pro-rates earnings for an employee who joined partway through the period (divisor stays the full month, payable days shrink), with a strictly lower net pay than the full-month figure
- Reports `total_leave_days` as a superset of the LOP-only `lop_days` figure when both a LOP and a non-LOP leave type were taken in the same period
- Rejects re-confirming an already-`ACTIVE` period (skip, figures untouched); allows confirming again after voiding, archiving pre-void figures
- `calculate` still previews full figures even when `confirm` would be blocked
- Rejects calculate/confirm for a not-yet-started period (400) **and** for the current, still-running month (400) — only a fully completed past month is runnable
- Subtree-scoped visibility/generation throughout, including `/mine` vs. team list separation and role/profile-status filters
- Void with reason; rejects double-void (409); rejects from non-HR (403) or out-of-subtree HR (404)
- Re-confirm after void supersedes back to `ACTIVE`
- Visible only to the employee and HR (404 for the manager); PDF disposition defaults to `attachment`, `inline` opt-in, any other value falls back safely (no header injection)

**Server — `salarySlips.test.js`** (guard cases)
- Skips an employee whose net pay works out to zero, keeping the figures visible, and commits nothing for them
- Reports an employee who already holds an `ACTIVE` slip for the period as `already_generated` **in the preview** (not just at confirm), with `computed: null` and a matching `summary.alreadyGenerated`; a second approve commits nothing and leaves the original slip untouched
- Returns that employee to `ok` once their slip is voided, reopening the period for a corrected run
- *(Replaced the earlier "still previews full figures for a period that already has an ACTIVE slip" case, which asserted the pre-fix behaviour.)*

**Server — `payslipEmail.test.js`** (`mailService` mocked; the PDF renderer deliberately is **not**, since the point is that a real attachment reaches the sender)
- Emails each employee their own payslip after a confirmed run: right recipient, human-readable period label, `payslip-YYYY-MM.pdf` filename, and a real PDF buffer (asserted on the `%PDF-` signature)
- One email per committed slip and none for a skipped employee
- One employee's failed send doesn't stop the others, and never touches the committed slips
- A run that commits nothing emails nothing

**Server — `numberToWords.test.js`, `payslipPdfService.test.js` (unit)**
- Correct Indian-numbering-system conversion across zero/tens/hundreds/thousands/lakhs/crores, paise rounding, numeric-string input
- Produces a structurally valid, non-empty PDF for a complete slip, with missing optional fields, with an LOP deduction present, and for an employee who joined partway through the period (fewer payable days than the month)

**Client — `ProfilePage.test.jsx`, `ProfileForm.test.jsx`, `ProfileDocumentUpload.test.jsx`, `ChangePasswordForm.test.jsx`, `ChangePasswordModal.test.jsx`, `EmployeeDetailsPage.test.jsx`, `EmployeeVerificationPage.test.jsx`, `EmployeeVerificationDetailPage.test.jsx`, `SalaryStructureForm.test.jsx`, `PayrollRunPage.test.jsx`, `PayrollRunForm.test.jsx`, `SalarySlipsPage.test.jsx`, `SalarySlipList.test.jsx`, `DocumentViewerPage.test.jsx`, `DocumentPreviewModal.test.jsx`**
- Full profile page: identity display, manager/HR display, send-back banner (and its disappearance once verified), read-only↔edit toggle, submit-for-verification wiring
- Profile form: collapsible sections, prefill, partial-save, conditional fields (no-passport / no-health-insurance clearing), server validation surfacing
- Document upload widget: required-slot states, rejection-with-comment + replace flow, custom document add/remove
- Password change form + modal wrapper
- Employee details (post-verification, read-only) and verification queue/detail pages: full profile display, document view/verify/reject, whole-profile verify/send-back with required reason and cancel-out
- Salary structure form: assign vs. update labeling, prefill, submit
- Payroll run: calculate preview with role/status filters, approve with committed/skipped-with-reason summary, error surfacing
- Salary slips page: employee-vs-HR views, tabs, void action, pay-period/role/employee filters
- Document viewer/preview: own vs. others'-via-HR vs. custom vs. salary-slip URL resolution, unsupported-type fallback, error handling, "open in new tab"
- Dashboard tile: never fetches a request list or the full team roster (regression test for the count endpoints), and titles itself for the organisation vs. the team by role
- NavBar badge: renders the server's count, asks for no count at all for an employee with no delegation
- Approvals: pages the list while the calendar keeps its whole month (the windowed call sends no `limit`), and hides the pager when everything fits on one page
- Salary Slips: pages the team list, resets to page 1 when a filter changes, hides the pager on a single page
- HR Reports browse: pages through results showing the server's total, hides the pager when everything fits on one page, and returns to page 1 when filters are applied or cleared
- Dashboard "on leave today": renders as a table with Employee/Role/Leave type/Dates/Days columns, sorted by name, half-day noted; `SUPER_ADMIN` reads the company-wide list (and the tile is titled "Organisation overview") while every other role reads the team-scoped one
- Dashboard "My leave": the leave-type picker filters the history to that type and shows its balance detail, a balance chip selects its own type, an untouched type says so, and each type keeps its own accent colour
- My Team: HR can change a report's manager and deactivate them; a plain `MANAGER` is offered neither control on any row, including one attributed to them (the routes are HR-tier server-side); the manager-edit form opens in its own full-width `colSpan` row (not inside a column), the extended team is grouped under each manager with no Reports To column, and an unresolvable-manager report still shows (with that column back on)
- `groupTeamByManager` (unit): groups reports under managers resolved from the directory, sorts managers and reports by first name, and collects anyone whose manager can't be resolved instead of dropping them
- TopBar: the bar shows initials + role badge but not the user's name (which is the trigger's accessible name and appears in the open menu), carries no brand label, logs out only from inside the account menu, and the search box grows on focus / shrinks on blur while staying expanded whenever a query is present
- Calendar events: hovering a holiday (HolidayCalendar) or a team leave bar (ApprovalsPage) shows the app's own `role="tooltip"` label with the date range and status, removes it on unhover, and carries no native `title` attribute
- Document viewer renders every employee document through the app's own stream (`/employees/documents/:id/file`), never the Cloudinary URL — including the "open in new tab" link — with a fallback to the given URL when there's no document id (the salary-slip path)
- Payroll run badges an already-paid employee as "Already received", distinctly from an amber "Skipped", and says how many in the summary line

### 🔴🟡 Gaps

These first three are **already-documented, deliberate product gaps** from `.claude/rules.md`, not just missing tests — surfacing them here so they're visible in one place with everything else:

- 🔴 **No re-sync of a salary slip's LOP when a leave request affecting that pay period is approved/cancelled *after* the slip was generated** — the slip silently drifts from the real leave record. Explicitly declined as out of scope so far.
- 🔴 **No proration for an employee who *exits* mid-pay-period** — full-period figures are always calculated regardless of actual days employed. (Proration for an employee who *joins* mid-period was the other half of this gap — that half is now implemented, see `salarySlips.test.js` above and `.claude/rules.md`'s payroll section.)
- 🟡 **Regenerating a slip after voiding always uses today's salary structure**, not the structure as of the original period.

Genuinely untested (not just declined):

- 🔴 **No test that the generated PDF's printed figures actually match the input data.** `payslipPdfService.test.js` only checks the byte stream is a structurally valid, non-empty PDF — never that the net-pay number rendered in it matches what was passed in. A positioning/formatting bug could silently print the wrong number while still "producing a valid PDF."
- 🟡 No test at the file-size **limit boundary** for document/leave-request uploads (only wrong-content-type is tested, not exactly-at-the-limit vs. one-byte-over).
- 🟡 No test simulating a Cloudinary upload failure — the documented guarantee ("a Cloudinary failure never leaves a half-created request behind") has no test exercising the failure path itself.
- 🟡 No validation-edge-case tests for salary structure figures (negative pay, HRA exceeding basic, non-numeric input).
- 🟡 No `SUPER_ADMIN`-specific test against salary structures/slips/documents directly — `superAdmin.test.js` proves the direct-report-only scoping principle via profile verification only; the same principle is applied to three other services per `.claude/rules.md` but isn't independently exercised there.

---
