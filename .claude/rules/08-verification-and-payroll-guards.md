# Document preview, verification & payroll guards

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 🧾 Document Preview, Profile Verification & Payroll Guards

> Four bugs found in live use of Module 5 v2, with the root cause of each — worth knowing before "simplifying" any of these back.

### Cloudinary raw assets can't be previewed — only proxied

- **Symptom:** HR clicking "View" on an employee's PDF document downloaded the file instead of showing it, with no way to just read it.
- **Root cause:** PDFs are uploaded with `resource_type: "raw"` (`cloudinaryService.uploadPrivateAsset` — anything not an image is raw), and Cloudinary serves raw assets with `Content-Disposition: attachment`. An `<iframe src={signedUrl}>` therefore triggers a save, not a render. There is no URL flag that makes a raw asset inline; the disposition belongs to whoever serves the bytes.
- **Fix:** `GET /api/employees/documents/:documentId/file` streams the bytes through this app (`employeeDocumentService.getDocumentFile` → `fetchDocumentStream`), setting `Content-Type` from the stored `mime_type` and `Content-Disposition` from a `disposition` query param that defaults to **`inline`**. `DocumentViewerPage` renders from that URL, never from `previewDocument.url`. The `/url` endpoints now also return `documentId` so the viewer can build it.
- **Consequences worth keeping:** the signed URL never reaches the DOM, and its five-minute expiry stops mattering to a viewer left open (each request mints a fresh one). Same trick as the salary-slip PDF endpoint's `?disposition=inline`, which existed for exactly this reason on a same-origin stream.
- **If you add another document kind:** it needs the same proxy, not a signed URL in an `iframe`. Images happen to work either way (`<img>` doesn't care about disposition) — don't let that mislead you into thinking the URL is previewable in general.

### Verifying a profile requires every document to be verified first

- **Symptom:** HR could mark a profile `VERIFIED` while its documents sat unreviewed — or after rejecting one — making the per-document review step decorative.
- **Fix:** `userService.verifyProfile` calls `assertRequiredDocumentsVerified` (in `employeeDocumentService.js`, which owns document rules) after the state-machine check, so "already verified" still answers **409** while a document problem answers **400**. Two distinct messages, because they need different actions from HR: a `PENDING_REVIEW` document is theirs to review now; a `REJECTED` one can only be fixed by the employee, so the way forward is `send-back`, not another `verify`.
- **The loop closes on the employee's side too:** `submitProfileForVerification` calls `assertNoRejectedDocuments`, so a profile sent back over a bad document can't be resubmitted unchanged — re-uploading resets the row to `PENDING_REVIEW` (`upsertEmployeeDocument`), which is what "replaced" means here. Without this, resubmitting just handed HR the same blocked Verify button.
- **Custom (`OTHER`) documents are never part of the gate** — they're optional extras, and any number may exist.
- **Error messages name the documents**, which is why `employeeDocumentService.js` carries its own `DOCUMENT_TYPE_LABELS`. The client has a separate copy for its list UI; that duplication is deliberate (messages are composed server-side).
- **Tests that verify a profile need `verifyAllEmployeeDocuments(employeeId, reviewerId)`** (`helpers/factories.js`) as setup, rather than driving four review requests each. Tests of the review endpoint itself still go through HTTP.

### A payslip is never issued for zero net pay

- **Root cause of the bug:** nothing checked the computed figure, so a full month of unpaid leave — or configured deductions (PF + ESIC + income tax) meeting or exceeding earnings — produced a real `₹0` payslip.
- **Why that's worse than no payslip:** it reads to the employee as "you were paid ₹0", and it occupies the `(employee, pay_period)` slot, so the corrected run has to void it first.
- **Fix:** `computeSlip` returns `status: "skipped"` when `netPay <= 0` (`<=`, not `===` — negative is the same case, and rounding means exact zero isn't guaranteed), keeping `computed` populated so HR can see *why* it came to zero.

### "Already received" is a preview status, not a confirm-time surprise

- **Symptom:** the run preview showed **Ready** for an employee who already had an `ACTIVE` slip for that period; they were then silently skipped on approve.
- **Root cause:** the duplicate check lived only in `confirmPayroll`, after the preview HR had already read.
- **Fix:** `calculateForSubtree` resolves the period's existing `ACTIVE` slips in one query up front and tags those rows `status: "already_generated"` with `computed: null` (recomputed figures would differ from the slip the employee actually keeps). The client badges it neutrally — "Already received" — not amber like a real problem, and the summary line says how many, so "0 of 12 payroll-ready" doesn't read as a failure.
- **Row statuses are now three:** `ok`, `skipped`, `already_generated`, with `ok + skipped + alreadyGenerated === total`. Anything filtering rows must use `!== "ok"` rather than `=== "skipped"`, or the new status silently vanishes — `confirmPayroll`'s `skipped` list was exactly that bug waiting to happen.
- **`ALREADY_GENERATED_REASON` is one shared constant** because both the preview and `confirmPayroll`'s race backstop report it; two wordings for one condition makes the UI look like it's describing two different problems.
- **A `VOIDED` slip deliberately doesn't count**, so voiding returns the employee to `ok` and reopens the period — that's the whole correction path.

---
