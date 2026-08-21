# Workflow — onboarding, documents & profile verification

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Workflow — adding a new employee

### Part 11 — "How is a new employee added?" (extreme detail)

#### Step 1 — Where does the user click?

```text
Page:      EmployeesPage.jsx (/dashboard/employees, HR_ADMIN only)
Component: "Add Employee" Button — opens a Modal containing InviteEmployeeForm
Button:    client/src/pages/EmployeesPage.jsx — sets showInviteModal(true)
```

#### Step 2 — What function executes?

```text
Function:  handleInvite(event) — an async submit handler
File:      client/src/components/team/InviteEmployeeForm.jsx
Purpose:   Client-side email-format check, then calls the invite service function
```

#### Step 3 — What API is called?

```text
Function:  inviteEmployee({firstName,lastName,email,role,managerId}) — client/src/services/userService.js
HTTP:      POST /api/users/invite
Body:      { firstName, lastName, email, role: "EMPLOYEE"|"MANAGER"|"HR_ADMIN", managerId? }
Headers:   Content-Type: application/json (axios default)
Auth:      httpOnly cookie, sent automatically (withCredentials:true)
```

#### Step 4 — Which route receives it?

```text
Route file: server/src/routes/userRoutes.js
Route:      router.post("/invite", requireRole("HR_ADMIN"), validateBody(inviteEmployeeSchema), inviteEmployee)
Middleware: router.use(requireAuth) applies to the whole router first, then the HR_ADMIN role gate
Controller: userController.inviteEmployee
```

#### Step 5 — What validation happens?

`server/src/validators/userValidator.js` → `inviteEmployeeSchema`:
- `firstName`/`lastName` required strings, `email` valid-email format, `role` ∈ the three-role enum.
- `managerId` (UUID) is **required** when `role === "EMPLOYEE"` and also when `role === "HR_ADMIN"` (a new HR admin must report to whoever created them); **optional** when `role === "MANAGER"` — enforced via a `.superRefine`.
- Server-side business validation happens one layer down, in the service (`assertManagerAllowed` — the chosen manager must exist, be `ACTIVE`, and have a role that satisfies the hierarchy rule: `EMPLOYEE→[MANAGER,HR_ADMIN]`, `MANAGER→[HR_ADMIN]`, `HR_ADMIN→[HR_ADMIN]`).

#### Step 6 — Which controller executes?

```text
Function: inviteEmployee(req, res, next) — server/src/controllers/userController.js
Input:    req.body (validated), req.user.id (the inviting HR admin)
Logic:    calls invitationService.inviteEmployee(req.body, req.user.id), then
          sendSuccess(res, 201, "Employee invited", result)
```

#### Step 7 — Which service executes?

```text
Function: inviteEmployee({firstName,lastName,email,role,managerId}, invitedByUserId)
File:     server/src/services/invitationService.js
Logic (in order):
  1. Look up the role row (findRoleByName) — 400 "Unknown role" if invalid.
  2. If managerId present, assertManagerAllowed(role, managerId) (reportingService.js) — 400 if the
     candidate manager doesn't exist/isn't ACTIVE, or their role doesn't satisfy the hierarchy rule.
  3. insertUser({..., status:"INVITED", passwordHash:null}) — creates the users row NOW, before
     any invite is accepted; the account exists in an unusable state until the link is used.
  4. seedBalancesForUser(user.id) — creates a balance row (full entitlement) for every active
     leave type immediately, so the new employee's balances aren't empty on first login.
  5. generateSecureToken() — crypto.randomBytes(32).toString("base64url") as the raw token, plus
     its SHA-256 hash; ONLY THE HASH IS PERSISTED.
  6. insertInvitation({userId, tokenHash, invitedBy, expiresAt}) — expiresAt = now + INVITE_TOKEN_TTL_HOURS
     (default 12h, env-configurable, clamped to 1-72h).
  7. Builds inviteLink = `${CLIENT_BASE_URL}/invite/${rawToken}` (null if CLIENT_BASE_URL is unset) —
     logs it to console outside production.
  8. sendEmployeeInviteEmail(...) — awaited (no enumeration concern: the caller is the HR admin who
     just created this account), wrapped in try/catch. A send failure is logged and reported as
     emailSent:false, never thrown: everything above is already committed.
  9. Returns { user, inviteLink, emailSent, expiresAt }.
```

#### Step 8 — What database operation happens?

```text
Table:        users
Query:        INSERT INTO users (first_name,last_name,email,password_hash,role_id,manager_id,status)
              VALUES (...) — password_hash is NULL, status is 'INVITED'
Generated ID: gen_random_uuid() (PK default)

Table:        leave_balances (one row per active leave type, via seedBalancesForUser)
Table:        invitations
Query:        INSERT INTO invitations (user_id, token_hash, invited_by, expires_at) VALUES (...)
              RETURNING id, user_id, expires_at
Relationship: invitations.user_id → users.id (the account this invite activates)
              invitations.invited_by → users.id (the HR admin who sent it — later governs who
              may edit this person's manager/status, see Part 9)
```

#### Step 9 — What response is returned?

```text
Database → { id, user_id, expires_at } (invitation row) + the created users row
 ↓
Service  → { user, inviteLink }
 ↓
Controller → sendSuccess(res, 201, "Employee invited", { user, inviteLink })
 ↓
HTTP 201 { success:true, message:"Employee invited",
           data:{ user:{id,first_name,last_name,email,role_id,manager_id,status:"INVITED",...},
                  inviteLink:"http://localhost:5173/invite/<raw-token>" } }
 ↓
Frontend: unwrap() → { user, inviteLink }
```

#### Step 10 — What does the UI do after success?

`InviteEmployeeForm.jsx` stores the result in `inviteResult` state — the form switches to a result view showing the invite link in a `<code>` block plus a "Copy link" `Button` (`navigator.clipboard.writeText`, icon swaps Copy→Check for 2 seconds). It also calls `onInvited?.()`, which `EmployeesPage.jsx` wires to its own `reload` (bumps a `reloadToken`, re-fetching `getUsers()` so the new INVITED row appears in the org chart immediately).

#### Step 11 — What happens on failure?

- **400** — unknown role, manager not found, or the manager's role fails the hierarchy check.
- **401** — not logged in at all (never reaches the role gate).
- **403** — logged in but not `HR_ADMIN`.
- **409** — duplicate email (Postgres unique-violation on `users.email`, mapped by `errorHandler`).
- **422** — a required field missing or malformed (e.g. `managerId` omitted for an `EMPLOYEE`/`HR_ADMIN` role).

In every case, `InviteEmployeeForm.jsx` catches the error and calls `toErrorMessage(err, "Unable to invite employee")`, displaying it inline above the form without losing the entered field values.

#### Accept-invite flow (the second half)

1. Employee opens `CLIENT_BASE_URL/invite/<token>` → `AcceptInvitePage.jsx` (`/invite/:token`, **ungated** — no login required to reach it).
2. On mount: `authService.verifyInvitation(token)` → `POST /api/auth/invitations/verify` → `invitationService.verifyInvitationToken` — hashes the raw token, looks up `findActiveByTokenHash` (only rows with `accepted_at IS NULL`), 401s ("invalid or has expired") if missing or past `expires_at`. Success renders "Welcome, {first_name}" + their email + a password form.
3. Submit → `authService.acceptInvitation({token,password})` → `POST /api/auth/invitations/accept` → `invitationService.acceptInvitation`: `hashPassword` (bcrypt), `setPasswordHashAndActivate` (`UPDATE users SET password_hash=$2, status='ACTIVE' WHERE id=$1`), `markAccepted` (stamps `accepted_at`), `signAuthToken({sub:user.id})`.
4. Controller sets the auth cookie **immediately** — the response itself completes login; there is no separate "now go log in" step. Frontend calls `refreshUser()` then `navigate("/dashboard", {replace:true})`.

#### Interview-ready answer

> "Adding an employee is a two-step, invite-then-accept flow, not direct account creation. HR fills out a form on `EmployeesPage`, which POSTs to `/api/users/invite` — that endpoint is `requireRole("HR_ADMIN")`-gated, and a Zod schema enforces that an `EMPLOYEE` or `HR_ADMIN` role must come with a `managerId`, while a `MANAGER` doesn't need one. The service layer creates the `users` row immediately, but in an `INVITED` state with no password — it's a real row, just an unusable one — then seeds a leave-balance row for every active leave type so the person's balances aren't empty on day one. It generates a random token, stores only its SHA-256 hash in an `invitations` table, and emails the raw token embedded in a link to the invitee — with a 12-hour, single-use window, since a link sitting in an inbox is a credential — while still showing HR the same link with a copy button as a fallback for when mail is unconfigured or fails. When the employee opens that link, `AcceptInvitePage` verifies the token's still valid and unexpired, lets them set a password, and the accept endpoint hashes it with bcrypt, flips the user to `ACTIVE`, marks the invite used, and — this is the part I like — logs them in immediately by setting the auth cookie in that same response, so there's no separate login step after accepting. If the link's expired, the pending row actually gets deleted on the next `GET /api/users` call, specifically so the email frees up for a re-invite, since `email` is a unique column."

---

---

## Workflow — document upload & profile verification

### What this module is for

A new employee's account exists the moment HR invites them, but it isn't *trusted* until a human has checked their
identity documents against what they typed. This module is that check: the employee fills in their profile and uploads
four documents, HR reviews each document individually, and only then can the profile become `VERIFIED`.

Verification is a gate, not a badge — `VERIFIED` is a precondition for payroll (see
[11-workflow-payroll-and-payslips.md](06-workflow-payroll-and-notifications.md)), which is the reason the guards below exist
at all.

### The four required documents

```js
// employeeDocumentService.js
export const REQUIRED_DOCUMENT_TYPES = ["PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "OFFER_LETTER"];
```

Employees may also upload **custom** documents (any name), which are *not* required and do not gate anything. They
exist because real onboarding always has a fifth document nobody anticipated.

### Profile status state machine

```text
INCOMPLETE ──SUBMIT──▶ SUBMITTED ──VERIFY────▶ VERIFIED
     ▲                     │
     └──────SEND_BACK───────┘
```

Transitions go through `assertLegalProfileTransition`, so an illegal one is a `409`, never a silent no-op. `VERIFIED`
is terminal in normal operation.

---

### Part A — Employee uploads and submits

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

### Part B — HR reviews each document

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

#### Previewing a PDF requires proxying its bytes

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

### Part C — HR verifies, or sends it back

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

### Who can see what

| Endpoint | Employee | Manager | HR_ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| `GET /employees/me/documents` | ✅ own | ✅ own | ✅ own | ✅ own |
| `GET /employees/:id/documents` | ❌ | ❌ | ✅ in scope | ✅ in scope |
| `GET /employees/documents/:documentId/file` | ✅ own rows | ✅ own rows | ✅ in scope | ✅ in scope |
| `POST /employees/:id/documents/:type/review` | ❌ | ❌ | ✅ | ✅ |
| `POST /employees/:id/verify` \| `/send-back` | ❌ | ❌ | ✅ | ✅ |

A `MANAGER` has **no** role in verification. Reviewing identity documents is an HR-tier job, and
[`7.role_permissions_matrix.md`](../7.role_permissions_matrix.md) is the authoritative version of this table.

### Failure modes worth knowing

| Symptom | Cause |
|---|---|
| Verify button rejected with a document name | that document is unreviewed or `REJECTED` — `assertRequiredDocumentsVerified` |
| Employee's submit rejected, listing fields | `REQUIRED_PROFILE_FIELDS` incomplete |
| Employee's submit rejected over a rejected document | `assertNoRejectedDocuments` — fix the document, don't resubmit it |
| PDF downloads instead of previewing | the Cloudinary URL was used directly instead of `/documents/:documentId/file?disposition=inline` |
| `404` on another employee's documents | out of the actor's HR scope — deliberately indistinguishable from "no such employee" |
