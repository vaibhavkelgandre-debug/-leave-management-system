# Workflow — adding a new employee

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 11 — "How is a new employee added?" (extreme detail)

### Step 1 — Where does the user click?

```text
Page:      EmployeesPage.jsx (/dashboard/employees, HR_ADMIN only)
Component: "Add Employee" Button — opens a Modal containing InviteEmployeeForm
Button:    client/src/pages/EmployeesPage.jsx — sets showInviteModal(true)
```

### Step 2 — What function executes?

```text
Function:  handleInvite(event) — an async submit handler
File:      client/src/components/team/InviteEmployeeForm.jsx
Purpose:   Client-side email-format check, then calls the invite service function
```

### Step 3 — What API is called?

```text
Function:  inviteEmployee({firstName,lastName,email,role,managerId}) — client/src/services/userService.js
HTTP:      POST /api/users/invite
Body:      { firstName, lastName, email, role: "EMPLOYEE"|"MANAGER"|"HR_ADMIN", managerId? }
Headers:   Content-Type: application/json (axios default)
Auth:      httpOnly cookie, sent automatically (withCredentials:true)
```

### Step 4 — Which route receives it?

```text
Route file: server/src/routes/userRoutes.js
Route:      router.post("/invite", requireRole("HR_ADMIN"), validateBody(inviteEmployeeSchema), inviteEmployee)
Middleware: router.use(requireAuth) applies to the whole router first, then the HR_ADMIN role gate
Controller: userController.inviteEmployee
```

### Step 5 — What validation happens?

`server/src/validators/userValidator.js` → `inviteEmployeeSchema`:
- `firstName`/`lastName` required strings, `email` valid-email format, `role` ∈ the three-role enum.
- `managerId` (UUID) is **required** when `role === "EMPLOYEE"` and also when `role === "HR_ADMIN"` (a new HR admin must report to whoever created them); **optional** when `role === "MANAGER"` — enforced via a `.superRefine`.
- Server-side business validation happens one layer down, in the service (`assertManagerAllowed` — the chosen manager must exist, be `ACTIVE`, and have a role that satisfies the hierarchy rule: `EMPLOYEE→[MANAGER,HR_ADMIN]`, `MANAGER→[HR_ADMIN]`, `HR_ADMIN→[HR_ADMIN]`).

### Step 6 — Which controller executes?

```text
Function: inviteEmployee(req, res, next) — server/src/controllers/userController.js
Input:    req.body (validated), req.user.id (the inviting HR admin)
Logic:    calls invitationService.inviteEmployee(req.body, req.user.id), then
          sendSuccess(res, 201, "Employee invited", result)
```

### Step 7 — Which service executes?

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

### Step 8 — What database operation happens?

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

### Step 9 — What response is returned?

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

### Step 10 — What does the UI do after success?

`InviteEmployeeForm.jsx` stores the result in `inviteResult` state — the form switches to a result view showing the invite link in a `<code>` block plus a "Copy link" `Button` (`navigator.clipboard.writeText`, icon swaps Copy→Check for 2 seconds). It also calls `onInvited?.()`, which `EmployeesPage.jsx` wires to its own `reload` (bumps a `reloadToken`, re-fetching `getUsers()` so the new INVITED row appears in the org chart immediately).

### Step 11 — What happens on failure?

- **400** — unknown role, manager not found, or the manager's role fails the hierarchy check.
- **401** — not logged in at all (never reaches the role gate).
- **403** — logged in but not `HR_ADMIN`.
- **409** — duplicate email (Postgres unique-violation on `users.email`, mapped by `errorHandler`).
- **422** — a required field missing or malformed (e.g. `managerId` omitted for an `EMPLOYEE`/`HR_ADMIN` role).

In every case, `InviteEmployeeForm.jsx` catches the error and calls `toErrorMessage(err, "Unable to invite employee")`, displaying it inline above the form without losing the entered field values.

### Accept-invite flow (the second half)

1. Employee opens `CLIENT_BASE_URL/invite/<token>` → `AcceptInvitePage.jsx` (`/invite/:token`, **ungated** — no login required to reach it).
2. On mount: `authService.verifyInvitation(token)` → `POST /api/auth/invitations/verify` → `invitationService.verifyInvitationToken` — hashes the raw token, looks up `findActiveByTokenHash` (only rows with `accepted_at IS NULL`), 401s ("invalid or has expired") if missing or past `expires_at`. Success renders "Welcome, {first_name}" + their email + a password form.
3. Submit → `authService.acceptInvitation({token,password})` → `POST /api/auth/invitations/accept` → `invitationService.acceptInvitation`: `hashPassword` (bcrypt), `setPasswordHashAndActivate` (`UPDATE users SET password_hash=$2, status='ACTIVE' WHERE id=$1`), `markAccepted` (stamps `accepted_at`), `signAuthToken({sub:user.id})`.
4. Controller sets the auth cookie **immediately** — the response itself completes login; there is no separate "now go log in" step. Frontend calls `refreshUser()` then `navigate("/dashboard", {replace:true})`.

### Interview-ready answer

> "Adding an employee is a two-step, invite-then-accept flow, not direct account creation. HR fills out a form on `EmployeesPage`, which POSTs to `/api/users/invite` — that endpoint is `requireRole("HR_ADMIN")`-gated, and a Zod schema enforces that an `EMPLOYEE` or `HR_ADMIN` role must come with a `managerId`, while a `MANAGER` doesn't need one. The service layer creates the `users` row immediately, but in an `INVITED` state with no password — it's a real row, just an unusable one — then seeds a leave-balance row for every active leave type so the person's balances aren't empty on day one. It generates a random token, stores only its SHA-256 hash in an `invitations` table, and emails the raw token embedded in a link to the invitee — with a 12-hour, single-use window, since a link sitting in an inbox is a credential — while still showing HR the same link with a copy button as a fallback for when mail is unconfigured or fails. When the employee opens that link, `AcceptInvitePage` verifies the token's still valid and unexpired, lets them set a password, and the accept endpoint hashes it with bcrypt, flips the user to `ACTIVE`, marks the invite used, and — this is the part I like — logs them in immediately by setting the auth cookie in that same response, so there's no separate login step after accepting. If the link's expired, the pending row actually gets deleted on the next `GET /api/users` call, specifically so the email frees up for a re-invite, since `email` is a unique column."

---
