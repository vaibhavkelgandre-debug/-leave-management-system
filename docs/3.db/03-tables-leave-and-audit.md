# Tables — leave requests, ledger, delegation & audit

> Part of [Database Schema](README.md). If this disagrees with the code, the code wins.

---

### 📝 `leave_requests`
*Migration: `013_create_leave_requests.sql`*

Module 3's core table — an employee's leave request and its lifecycle (FR-011, FR-016). See the state machine in `server/src/services/leaveRequestStateMachine.js` for the legal status transitions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `employee_id` | `UUID` | FK → `users.id`, `ON DELETE CASCADE` | |
| `leave_type_id` | `UUID` | FK → `leave_types.id`, `ON DELETE RESTRICT` | |
| `start_date` / `end_date` | `DATE` | `NOT NULL`, `CHECK (end_date >= start_date)` | |
| `start_half_day` / `end_half_day` | `BOOLEAN` | default `false` | |
| `working_days` | `NUMERIC(5,1)` | `NOT NULL`, `CHECK > 0` | **Snapshotted at submission** — never recomputed, so editing the holiday calendar later can't retroactively change an already-decided request's day count or the balance history it produced |
| `reason` | `TEXT` | `NOT NULL` | |
| `status` | `VARCHAR(20)` | `CHECK IN ('SUBMITTED','APPROVED','REJECTED','WITHDRAWN','CANCELLED')`, default `SUBMITTED` | |
| `decided_by` | `UUID` | FK → `users.id`, nullable | Whoever most recently changed the status — approver, the employee themself (withdraw/cancel), HR (override), or SUPER_ADMIN themself for their own auto-approved request (inserted directly as `APPROVED`, never `SUBMITTED`) |
| `decided_at` | `TIMESTAMP` | nullable | |
| `decision_comment` | `TEXT` | nullable | |
| `created_at` / `updated_at` | `TIMESTAMP` | default now | |

**Indexes:** `employee_id`, `(employee_id, status)` (overlap checks and "my requests" both filter this way), and `(employee_id, start_date DESC)` — added by migration 037 for HR's **paginated** browse view, whose query is always `WHERE employee_id = ANY(subtree) … ORDER BY start_date DESC LIMIT/OFFSET`. The first two indexes can find those rows but not return them ordered, so without the third every page sorts the whole matching set before discarding all but 25 rows — which would make page 1 no cheaper than the unpaginated query it replaced. `DESC` is part of the index, not decoration: an ASC index can only be read backwards for a single key, not for this multi-key `= ANY(...)` case.

---

### 📒 `leave_balance_ledger`
*Migration: `014_create_leave_balance_ledger.sql`*

Append-only entries explaining every change to a balance (NFR-2) — see the note on `leave_balances` above. Every leave-request action (submit/approve/reject/withdraw/cancel/override) writes exactly one row here; nothing ever updates or deletes one.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → `users.id`, `ON DELETE CASCADE` | |
| `leave_type_id` | `UUID` | FK → `leave_types.id`, `ON DELETE RESTRICT` | |
| `year` | `INTEGER` | `NOT NULL` | A request spanning a year boundary is debited against its **start date's** year (documented simplification) |
| `leave_request_id` | `UUID` | FK → `leave_requests.id`, `ON DELETE CASCADE`, nullable | |
| `pending_delta` / `taken_delta` | `NUMERIC(5,1)` | default `0` | Signed amounts; a balance's `days_taken`/`days_pending` are `SUM()` over these per user/type/year |
| `reason` | `VARCHAR(30)` | `CHECK IN ('SUBMIT','APPROVE','REJECT','WITHDRAW','CANCEL','HR_OVERRIDE_APPROVE','HR_OVERRIDE_REJECT')` | Descriptive only — not read by any query logic. SUPER_ADMIN's auto-approve bypass reuses `'APPROVE'` (no new tag needed) but writes only that one entry, never a preceding `'SUBMIT'` — there's no pending state to represent when a request never passes through SUBMITTED |
| `created_at` | `TIMESTAMP` | default now | |

**Index:** `(user_id, leave_type_id, year)` (the exact grouping the balance SELECT sums over).

---

### 🔁 `delegations`
*Migration: `015_create_delegations.sql`*

A manager nominating someone to approve on their behalf for a date range (FR-020).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `manager_id` | `UUID` | FK → `users.id`, `ON DELETE CASCADE` | |
| `delegate_id` | `UUID` | FK → `users.id`, `ON DELETE CASCADE`, `chk_delegations_not_self` | Any active user the manager can currently see via `GET /users` — not restricted to another manager |
| `start_date` / `end_date` | `DATE` | `NOT NULL`, `CHECK (end_date >= start_date)` | |
| `created_at` | `TIMESTAMP` | default now | |

**No DB-level overlap constraint** — two delegations for the same manager with intersecting ranges are rejected at the service layer (`delegationService.js`, `409`), same interval-overlap pattern as holidays.

---

### 🧾 `audit_logs`
*Migration: `016_create_audit_logs.sql`*

A full, append-only trail of every leave-request state change (FR-021).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `leave_request_id` | `UUID` | FK → `leave_requests.id`, `ON DELETE CASCADE` | |
| `actor_id` | `UUID` | FK → `users.id` | Who actually performed the action |
| `acted_for` | `UUID` | FK → `users.id`, nullable | Set only when a delegate acts — the manager they were standing in for. `NULL` for every other actor |
| `action` | `VARCHAR(30)` | `NOT NULL` | e.g. `SUBMIT`, `APPROVE`, `HR_OVERRIDE_TO_APPROVED`, `AUTO_APPROVE` (SUPER_ADMIN's own request, bypassing the review workflow entirely) |
| `old_status` / `new_status` | `VARCHAR(20)` | nullable | `old_status` is `NULL` for the initial `SUBMIT` entry, and also for `AUTO_APPROVE` (never had a prior status) |
| `comment` | `TEXT` | nullable | |
| `created_at` | `TIMESTAMP` | default now | |

**Append-only by convention, not by DB grant** — `auditLogRepository.js` exposes only an insert function, never update/delete, so no code path in this codebase can edit a past entry. **Index:** `leave_request_id`.

---

### 📎 `leave_request_documents`
*Migration: `017_create_leave_request_documents.sql`*

The document attached to a leave request when its leave type requires one — e.g. a medical certificate for sick leave (FR-012). The file itself lives in Cloudinary, uploaded as a private (`type: authenticated`) asset; this table stores only enough to locate and describe it. There is deliberately no stored URL — a viewable link is a short-lived signed URL generated on demand (`cloudinaryService.js`), after the same authorization check as viewing the request itself, never persisted.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `leave_request_id` | `UUID` | FK → `leave_requests.id`, `ON DELETE CASCADE`, `UNIQUE` | One document per request — immutable once attached, no replace/delete endpoint |
| `cloudinary_public_id` | `VARCHAR(255)` | `NOT NULL` | Cloudinary's asset identifier |
| `cloudinary_resource_type` | `VARCHAR(20)` | `CHECK IN ('image','raw')` | Cloudinary's own classification (`image` for jpg/png, `raw` for pdf) — needed to regenerate a correctly-typed signed URL |
| `original_filename` | `VARCHAR(255)` | `NOT NULL` | As uploaded, shown back to the viewer |
| `mime_type` | `VARCHAR(100)` | `NOT NULL` | Detected from the file's actual content (magic bytes), not the client-reported Content-Type |
| `file_size_bytes` | `INTEGER` | `NOT NULL`, `CHECK > 0` | Max 5MB, enforced server-side |
| `uploaded_by` | `UUID` | FK → `users.id` | Always the requester — uploaded as part of `POST /leave-requests` |
| `created_at` / `updated_at` | `TIMESTAMP` | default now | |

**Index:** `leave_request_id`.

---
