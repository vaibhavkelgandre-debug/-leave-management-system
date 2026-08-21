# Workflow — document upload & profile verification

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## What this module is for

A new employee's account exists the moment HR invites them, but it isn't *trusted* until a human has checked their
identity documents against what they typed. This module is that check: the employee fills in their profile and uploads
four documents, HR reviews each document individually, and only then can the profile become `VERIFIED`.

Verification is a gate, not a badge — `VERIFIED` is a precondition for payroll (see
[11-workflow-payroll-and-payslips.md](11-workflow-payroll-and-payslips.md)), which is the reason the guards below exist
at all.

## The four required documents

```js
// employeeDocumentService.js
export const REQUIRED_DOCUMENT_TYPES = ["PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "OFFER_LETTER"];
```

Employees may also upload **custom** documents (any name), which are *not* required and do not gate anything. They
exist because real onboarding always has a fifth document nobody anticipated.

## Profile status state machine

```text
INCOMPLETE ──SUBMIT──▶ SUBMITTED ──VERIFY────▶ VERIFIED
     ▲                     │
     └──────SEND_BACK───────┘
```

Transitions go through `assertLegalProfileTransition`, so an illegal one is a `409`, never a silent no-op. `VERIFIED`
is terminal in normal operation.

---

## Part A — Employee uploads and submits

```text
ProfilePage.jsx / document upload control
 ↓ picks a file for one of the four required types
POST /api/employees/me/documents/:documentType
 ↓
requireAuth (router-wide)
 ↓
validateParams(documentTypeParamSchema)   -- :documentType must be one of the four
 ↓
uploadEmployeeDocument                    -- multer, memory storage, size/mimetype limits
 ↓
employeeDocumentController.uploadDocument → employeeDocumentService.uploadDocument(actorId, documentType, file)
 ↓
cloudinaryService.upload(..., { resource_type: "raw" })
 ↓
UPSERT one row per (employee_id, document_type) — re-uploading replaces, so there is never
    a second competing copy of "your PAN card", and the review status resets with it
```

Custom documents take a parallel path: `POST /api/employees/me/documents/custom` (multer + `customDocumentUploadSchema`
for the name), `DELETE /api/employees/me/documents/custom/:documentId` to remove one. Only custom documents are
deletable — a required document can be replaced but not removed, because its absence would silently un-gate nothing.

Then the employee submits:

```text
POST /api/employees/me/profile/submit
 ↓
userService.submitProfileForVerification(actorId)
 ↓
1. every field in REQUIRED_PROFILE_FIELDS is present    → else 400, naming the missing fields
2. all four REQUIRED_DOCUMENT_TYPES have been uploaded  → else 400
3. assertNoRejectedDocuments(actorId)                   → else 400
 ↓
assertLegalProfileTransition("SUBMIT", profile_status) → SUBMITTED
 ↓
updateProfileStatus
 ↓
notifyProfileSubmitted(user)   -- non-critical; notifies the *nearest HR ancestor*, not all HR
```

⚠️ **Guard 3 is the non-obvious one.** Without it, an employee whose profile was sent back for a mismatched document
could resubmit the same rejected document unchanged — HR would then find the Verify button blocked for a reason the
employee had already been told about and thought they'd addressed. Blocking it at submit time turns a confusing dead
end into a precise error at the moment it can be fixed.

---

## Part B — HR reviews each document

```text
Verification detail page
 ↓
GET /api/employees/:id/documents                    -- the list, with each row's review status
GET /api/employees/:id/documents/:documentType/url  -- a viewable link for one document
 ↓
POST /api/employees/:id/documents/:documentType/review   { status, comment }
 ↓
requireRole("HR_ADMIN", "SUPER_ADMIN")
 ↓
employeeDocumentService.reviewDocument(actor, employeeId, documentType, { status, comment })
 ↓
row's review status becomes VERIFIED or REJECTED, with the comment stored
```

Each document is reviewed **individually**. There is no "verify all" shortcut, deliberately: the whole point is that a
human looked at each one.

### Previewing a PDF requires proxying its bytes

Cloudinary serves assets uploaded with `resource_type: "raw"` with `Content-Disposition: attachment`, so a link to the
Cloudinary URL always *downloads* — a PDF can never preview in the browser, which is useless for someone whose job is
to look at it.

```text
GET /api/employees/documents/:documentId/file?disposition=inline
 ↓
validateParams(documentIdParamSchema) + validateQuery(documentDispositionQuerySchema)
 ↓
employeeDocumentService.getDocumentFile(actor, documentId)
 ↓
fetch the asset server-side, stream the bytes back with our own
    Content-Type and Content-Disposition (inline | attachment)
```

Authorization comes from **the row itself**, not from the URL shape: this one endpoint serves a required document or a
custom one, the caller's own or (for HR in scope) someone else's. That's the same pattern as `GET /salary-slips/:id`
and `GET /leave-requests/:id` — the id is looked up, then the row decides.

⚠️ **Route ordering here is load-bearing**, and `employeeRoutes.js` documents each case:
- `/documents/:documentId/file` is registered **first** — it's the one route whose first segment could be mistaken
  for an employee id.
- `/me/documents/custom` precedes `/me/documents/:documentType` — Express matches in registration order, and
  `:documentType`'s zod enum check happens too late to hand `"custom"` on to the right handler.
- `/pending-verification` and `/verified` precede `/:id` for the same reason.

---

## Part C — HR verifies, or sends it back

```text
POST /api/employees/:id/verify
 ↓
requireRole("HR_ADMIN", "SUPER_ADMIN")
 ↓
userService.verifyProfile(actor, employeeId)
 ↓
role re-checked in the service (not only at the route)
 ↓
isInActorsHrScope(actor, employeeId)  -- HR_ADMIN's own subtree; SUPER_ADMIN's direct-report
                                         HR_ADMINs only (hrScopeService.js). Out of scope → 404,
                                         not 403: existence itself isn't disclosed.
 ↓
assertLegalProfileTransition("VERIFY", profile_status)   -- already verified → 409
 ↓
assertRequiredDocumentsVerified(employeeId)             -- any of the four not VERIFIED → 400
 ↓
updateProfileStatus(status: VERIFIED, verifiedBy: actor.id, verifiedAt: now)
 ↓
notifyProfileVerified   -- non-critical side effect
```

⚠️ **The order of the last two guards is deliberate.** The state transition is checked *before* the documents, so
re-verifying an already-verified profile answers "you already did this" (`409`) rather than a confusing complaint about
documents. Swap them and the common double-click produces the wrong diagnosis.

`assertRequiredDocumentsVerified` is what makes a missed document impossible rather than merely discouraged: HR cannot
verify a profile while any of the four is unreviewed or rejected, and the error names the offending document.

Sending it back instead:

```text
POST /api/employees/:id/send-back   { reason }        -- reason required by sendProfileBackSchema
 ↓
userService.sendProfileBack(actor, employeeId, reason)
 ↓
same role + scope + transition checks
 ↓
updateProfileStatus(status: INCOMPLETE, sendBackReason, sendBackBy, sendBackAt)
 ↓
notifyProfileSentBack(employeeId, actor.id, reason)
```

The reason is **stored on the user row and shown to the employee**, not just logged. Being told "your profile was
returned" without being told what was wrong produces a resubmission of exactly the same thing. It's cleared on the next
transition — `updateProfileStatus` nulls the other transitions' fields — so a stale reason can't linger on a profile
that has since been fixed.

---

## Who can see what

| Endpoint | Employee | Manager | HR_ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| `GET /employees/me/documents` | ✅ own | ✅ own | ✅ own | ✅ own |
| `GET /employees/:id/documents` | ❌ | ❌ | ✅ in scope | ✅ in scope |
| `GET /employees/documents/:documentId/file` | ✅ own rows | ✅ own rows | ✅ in scope | ✅ in scope |
| `POST /employees/:id/documents/:type/review` | ❌ | ❌ | ✅ | ✅ |
| `POST /employees/:id/verify` \| `/send-back` | ❌ | ❌ | ✅ | ✅ |

A `MANAGER` has **no** role in verification. Reviewing identity documents is an HR-tier job, and
[`7.role_permissions_matrix.md`](../7.role_permissions_matrix.md) is the authoritative version of this table.

## Failure modes worth knowing

| Symptom | Cause |
|---|---|
| Verify button rejected with a document name | that document is unreviewed or `REJECTED` — `assertRequiredDocumentsVerified` |
| Employee's submit rejected, listing fields | `REQUIRED_PROFILE_FIELDS` incomplete |
| Employee's submit rejected over a rejected document | `assertNoRejectedDocuments` — fix the document, don't resubmit it |
| PDF downloads instead of previewing | the Cloudinary URL was used directly instead of `/documents/:documentId/file?disposition=inline` |
| `404` on another employee's documents | out of the actor's HR scope — deliberately indistinguishable from "no such employee" |
