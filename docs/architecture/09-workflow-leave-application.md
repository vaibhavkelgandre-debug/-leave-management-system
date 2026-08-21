# Workflow — applying for leave

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 12 — Leave Application Workflow (extreme detail)

Traced from `client/src/components/leave/RequestLeaveForm.jsx` (opened in a `Modal` from `MyBalancesPage.jsx`) through to the database and back.

```text
Employee opens the "Request Leave" modal
        ↓
Form loads leave types on mount — getLeaveTypes()
        ↓
Employee selects a leave type, dates, half-day flags, writes a reason,
    (optionally) attaches a document
        ↓
CLIENT-SIDE checks (mirror, never replace, server validation):
  1. endDate < startDate → inline error
  2. single-day request with BOTH half-day flags set → inline error
  3. selected leave type's requires_document is true and no file attached → inline error
        ↓
LIVE PREVIEW — fires on every relevant field change (debounced via the effect's own dependency array):
    previewLeaveRequest({startDate,endDate,startHalfDay,endHalfDay})
        ↓ POST /api/leave-requests/preview
    (no role gate beyond requireAuth; a pure, side-effect-free calculation, no DB write)
        ↓
    validateBody(previewLeaveRequestSchema) — date-format + endDate>=startDate
        ↓
    leaveRequestController.preview → leaveRequestService.previewWorkingDays
        ↓
    findAllHolidays({}) + calculateWorkingDays(...) — workingDayService.js:
        excludes weekends and any date inside a holiday's [start_date,end_date] range,
        then subtracts 0.5 per boundary half-day flag ONLY IF that boundary date is
        itself a working day (a half-day flag on a weekend/holiday boundary is a no-op)
        ↓
    Response: { workingDays: 4.5 } → shown to the employee before they submit —
        THE SAME calculation the real submission uses, so the number is never a guess
        ↓
Employee clicks Submit
        ↓
submitLeaveRequest(form, documentFile) — client/src/services/leaveRequestService.js:
    builds multipart/form-data (Content-Type left undefined so the browser sets its own
    boundary) if a file is attached, else plain JSON
        ↓ POST /api/leave-requests
        ↓
uploadLeaveRequestDocument middleware (multer, memory storage, 5MB limit, field "document")
    runs BEFORE validateBody, since it's what turns the multipart body into req.body
        ↓
validateBody(submitLeaveRequestSchema) — leaveTypeId UUID, date strings, half-day flags
    coerced from multipart's stringified "true"/"false", reason non-empty, endDate>=startDate
        ↓
leaveRequestController.submit → leaveRequestService.submitLeaveRequest(req.user.id, req.body, req.file)
    (employee_id is ALWAYS req.user.id — never taken from the request body)
        ↓
SERVER-SIDE VALIDATION ORDER (exact, from leaveRequestService.js):
  1. findLeaveTypeById — 400 if missing or !is_active
  2. leaveType.requires_document && !file → 400
  3. detectFileType(file.buffer) — magic-byte sniff (PDF %PDF-, JPEG FFD8FF, PNG signature);
     NOT in {pdf,jpeg,png} → 400 "Document must be a PDF, JPG or PNG file"
     (never trusts the client-reported extension or Content-Type)
  4. calculateWorkingDays(...) — 400 if the result is <= 0
  5. findOverlappingLeaveRequest({employeeId,startDate,endDate}) — 409 if it overlaps an
     existing SUBMITTED/APPROVED request of the SAME employee
  6. Balance check: year resolved from startDate (year-boundary debit rule — a request
     spanning two years is debited against its START date's year), seedBalancesForUser
     (self-heal), getBalanceForUserAndType; 400 "This request would take your balance
     below zero" UNLESS leaveType.allow_negative_balance
        ↓
  7. ONLY IF ALL OF THE ABOVE PASSED: Cloudinary upload (cloudinaryService.js) — private
     `type:"authenticated"` asset, resource_type raw for PDF / image for JPG/PNG. This
     order matters: nothing has touched Postgres yet at this point, so a Cloudinary
     failure never leaves a half-created request behind.
  8. insertLeaveRequest(...) — INSERT INTO leave_requests (...)
  9. insertLeaveRequestDocument(...) — only if a document was uploaded; stores
     cloudinary_public_id/cloudinary_resource_type, NEVER a URL
 10. insertLedgerEntry({..., pendingDelta: workingDays, takenDelta: 0, reason:"SUBMIT"})
 11. insertAuditLog({..., action:"SUBMIT", oldStatus:null, newStatus:"SUBMITTED"})
        ↓
Response: 201 { success:true, message:"Leave request submitted", data:<joined request row> }
        ↓
Frontend: onSubmitted(created) → modal closes, calendar's focusDate jumps to the new
    request's start date, reload() bumps reloadToken → balances + "my requests" +
    holidays all refetch, MyLeaveRequestList/MyLeaveCalendar re-render
```

### Failure scenarios, by layer

| Failure | Status | Where caught |
|---|---|---|
| Leave type inactive/not found | 400 | `submitLeaveRequest` step 1 |
| Required document missing | 400 | step 2 |
| Document isn't actually a PDF/JPG/PNG (by content, not extension) | 400 | step 3 |
| Date range has zero working days (e.g. a single weekend day) | 400 | step 4 |
| Overlaps an existing pending/approved request | 409 | step 5 |
| Balance would go negative and the type disallows it | 400 | step 6 |
| File exceeds 5MB | 400 (Multer `LIMIT_FILE_SIZE` → mapped by `errorHandler`) | upload middleware, before the controller even runs |
| Malformed body (bad UUID, missing reason, etc.) | 422 | `validateBody`, before the controller runs |

---
