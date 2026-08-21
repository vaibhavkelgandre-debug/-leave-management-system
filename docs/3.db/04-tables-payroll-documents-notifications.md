# Tables — payroll, documents & notifications

> Part of [Database Schema](README.md). If this disagrees with the code, the code wins.

---

### 💰 `salary_slips`
*Migrations: `021_create_salary_slips.sql`, `026_alter_salary_slips_for_structure_payroll.sql`, `030_alter_salary_slips_add_status.sql`, `035_alter_salary_slips_add_leave_and_proration.sql`*

Module 5 v2 (FR-025), added beyond the original brief. One row per employee per pay period, **calculated** from the employee's `salary_structures` row plus LOP (`salarySlipService.calculatePayroll`/`confirmPayroll`) — `026` reworked the columns from the original generic CSV-driven shape (`allowances`/`deductions`/`tax`) to the structure's actual components; `030` added the `status`/void columns so HR can soft-delete a slip generated for the wrong pay period; `035` added `total_leave_days`/`payable_days` alongside a joining-date-aware, completed-month-only generation rule (see `salarySlipService.js`'s `assertPeriodCompleted`/`computeSlip`).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `employee_id` | `UUID` | FK → `users.id`, `ON DELETE CASCADE` | |
| `pay_period` | `VARCHAR(7)` | `NOT NULL`, `CHECK (pay_period ~ '^\d{4}-\d{2}$')` | `"YYYY-MM"` — sortable, unambiguous. Generation is only allowed once the period has fully ended, and only from an employee's `joining_date` onward |
| `basic_pay` / `hra` / `pf_employee_contribution` / `pf_employer_contribution` / `esic` / `special_allowance` / `income_tax` | `NUMERIC(12,2)` | `NOT NULL`, default `0` except `basic_pay` | Snapshotted from `salary_structures` at calculation time — never pro-rated, even for a partial joining month |
| `lop_days` | `NUMERIC(5,1)` | `NOT NULL`, default `0`, `CHECK >= 0` | Sum of `working_days` on `APPROVED` requests of a `counts_as_lop` leave type, overlapping this period (from `joining_date` onward if it falls inside the period) |
| `lop_deduction` | `NUMERIC(12,2)` | `NOT NULL`, default `0`, `CHECK >= 0` | `(basic_pay + hra + special_allowance) / <days in month> × lop_days` |
| `total_leave_days` | `NUMERIC(5,1)` | `NOT NULL`, default `0`, `CHECK >= 0` | Same overlap sum as `lop_days`, but across **every** leave type, not just `counts_as_lop` ones — informational, a superset of `lop_days`, doesn't feed into `net_pay` |
| `payable_days` | `NUMERIC(5,1)` | `NOT NULL`, default `0`, `CHECK >= 0` | How many of the period's days the earnings figure was actually based on: the full month minus `lop_days`, further reduced by the days before `joining_date` for an employee who joined partway through the period |
| `net_pay` | `NUMERIC(12,2)` | `NOT NULL`, `CHECK >= 0` | `basic_pay + hra + special_allowance - pf_employee_contribution - esic - income_tax - lop_deduction - <pre-joining-days deduction, if any>` — `pf_employer_contribution` is recorded but never subtracted |
| `status` | `VARCHAR(20)` | `NOT NULL`, default `'ACTIVE'`, `CHECK IN ('ACTIVE', 'VOIDED')` | Soft-delete flag — a mistaken run (e.g. wrong pay period) is voided, not deleted, so there's a record it happened |
| `voided_by` / `voided_at` / `void_reason` | `UUID` FK → `users.id` (nullable) / `TIMESTAMP` (nullable) / `TEXT` (nullable) | | Set only once voided; cleared again if the same period is later re-confirmed (a fresh confirm supersedes an earlier void) |
| `created_by` | `UUID` | FK → `users.id` | The HR admin who ran the original calculation |
| `updated_by` | `UUID` | FK → `users.id`, nullable | Set only if a later re-run corrected this row |
| `created_at` / `updated_at` | `TIMESTAMP` | default now | |

**Uniqueness:** `(employee_id, pay_period)` — re-confirming the same period **replaces** the existing row (`ON CONFLICT DO UPDATE`) rather than creating a duplicate; the prior values are archived into `salary_slip_revisions` first, and `status` is reset to `ACTIVE` (clearing `voided_by`/`voided_at`/`void_reason`) even if the row being replaced was `VOIDED`. **Indexes:** `employee_id`, `pay_period`.

---

### 🕰️ `salary_slip_revisions`
*Migrations: `021_create_salary_slips.sql`, `026_alter_salary_slips_for_structure_payroll.sql`, `035_alter_salary_slips_add_leave_and_proration.sql`*

Append-only snapshot of a `salary_slips` row's values immediately before a correction overwrites them — same append-only philosophy as `audit_logs`: the repository layer only ever exposes an insert into this table. Same columns as `salary_slips` (minus `created_by`/`updated_by`) plus `replaced_by`/`replaced_at`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `salary_slip_id` | `UUID` | FK → `salary_slips.id`, `ON DELETE CASCADE` | |
| `employee_id` | `UUID` | FK → `users.id` | Denormalized so history reads without a join back to the now-overwritten current row |
| `pay_period` | `VARCHAR(7)` | `NOT NULL` | Denormalized, same reason |
| `basic_pay` / `hra` / `pf_employee_contribution` / `pf_employer_contribution` / `esic` / `special_allowance` / `lop_days` / `lop_deduction` / `total_leave_days` / `payable_days` / `income_tax` / `net_pay` | `NUMERIC` | `NOT NULL` except `total_leave_days`/`payable_days` (nullable — added by `035` after this table already existed) | The slip's values just before this replacement |
| `replaced_by` | `UUID` | FK → `users.id`, `NOT NULL` | The HR admin who triggered the correction |
| `replaced_at` | `TIMESTAMP` | default now | |

**Index:** `salary_slip_id`.

---

### 📎 `employee_documents`
*Migrations: `023_create_employee_documents.sql`, `027_alter_employee_documents_types.sql`, `028_alter_employee_documents_add_custom.sql`, `029_alter_employee_documents_add_offer_letter.sql`*

Module 5 v2 (FR-027), added beyond the original brief. The identity/bank/offer documents an employee uploads before their profile can be submitted for verification — proof for the `pan_number`/`aadhar_number`/bank fields on `users` and, for the offer letter, the joining date/compensation — which is also where the upload UI sits client-side (`ProfileForm.jsx`'s "Government ID & bank details" section). `027` replaced the original two document types (a payslip-history/relieving-letter pair, which weren't actually what HR needed to verify) with `PAN_CARD`/`AADHAR_CARD`/`BANK_PASSBOOK`; `028` added `OTHER` for any number of additional self-named documents an employee wants to keep on their profile (never required for verification); `029` added a 4th required type, `OFFER_LETTER`. Same Cloudinary-metadata-only shape as `leave_request_documents` — the file lives in Cloudinary as a private `type: authenticated` asset, never a stored URL. Unlike `leave_request_documents` (immutable), re-uploading one of the required types **replaces** the existing row and resets its review status; an `OTHER` row is never replaced, only added or deleted (the only delete anywhere in this document flow).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `employee_id` | `UUID` | FK → `users.id`, `ON DELETE CASCADE` | |
| `document_type` | `VARCHAR(30)` | `CHECK IN ('PAN_CARD','AADHAR_CARD','BANK_PASSBOOK','OFFER_LETTER','OTHER')` | |
| `document_name` | `VARCHAR(100)` | nullable | The user-supplied label for an `OTHER` row (e.g. "Degree certificate"); always `NULL` for the four fixed types, whose label is derived from `document_type` client-side |
| `cloudinary_public_id` / `cloudinary_resource_type` / `original_filename` / `mime_type` / `file_size_bytes` | — | same shape as `leave_request_documents` | |
| `status` | `VARCHAR(20)` | `CHECK IN ('PENDING_REVIEW','VERIFIED','REJECTED')`, default `PENDING_REVIEW` | Reset to `PENDING_REVIEW` on every re-upload; unused in the UI for `OTHER` rows (no review workflow for custom documents) |
| `reviewed_by` | `UUID` | FK → `users.id`, nullable | The HR admin who reviewed it |
| `reviewed_at` | `TIMESTAMP` | nullable | |
| `review_comment` | `TEXT` | nullable | e.g. a rejection reason |
| `uploaded_by` | `UUID` | FK → `users.id` | Always the employee themself |
| `created_at` / `updated_at` | `TIMESTAMP` | default now | |

**Uniqueness:** a **partial** unique index on `(employee_id, document_type) WHERE document_type != 'OTHER'` (`028`, replacing the original plain `UNIQUE(employee_id, document_type)`) — every required type stays capped at one row per employee, re-upload replacing via `ON CONFLICT` (the predicate excludes only `OTHER` by name, so `029` adding `OFFER_LETTER` needed no index change); `OTHER` has no such cap, so any number of custom documents may exist per employee, each a fresh `INSERT` distinguished by `id`. **Index:** `employee_id`.

---

### 💵 `salary_structures`
*Migration: `024_create_salary_structures.sql`*

Module 5 v2 (FR-025), added beyond the original brief. The figures HR assigns once per employee that a payroll run reads from — replaces the earlier bulk-CSV-per-month model.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `employee_id` | `UUID` | FK → `users.id`, `ON DELETE CASCADE`, `UNIQUE` | One current structure per employee |
| `basic_salary` | `NUMERIC(12,2)` | `NOT NULL`, `CHECK >= 0` | |
| `hra` / `pf_employee_contribution` / `pf_employer_contribution` / `esic` / `special_allowance` / `income_tax` | `NUMERIC(12,2)` | `NOT NULL`, default `0`, `CHECK >= 0` | `income_tax` is a flat, HR-declared figure — not a computed slab-based TDS calculation |
| `created_by` | `UUID` | FK → `users.id` | |
| `updated_by` | `UUID` | FK → `users.id`, nullable | Set only if HR later revises it |
| `created_at` / `updated_at` | `TIMESTAMP` | default now | |

---

### 🕰️ `salary_structure_revisions`
*Migration: `024_create_salary_structures.sql`*

Append-only snapshot of a `salary_structures` row's values immediately before HR changes them — same archive-on-change philosophy as `salary_slip_revisions`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `salary_structure_id` | `UUID` | FK → `salary_structures.id`, `ON DELETE CASCADE` | |
| `employee_id` | `UUID` | FK → `users.id` | Denormalized, same reason as `salary_slip_revisions` |
| `basic_salary` / `hra` / `pf_employee_contribution` / `pf_employer_contribution` / `esic` / `special_allowance` / `income_tax` | `NUMERIC` | `NOT NULL` | The structure's values just before this change |
| `replaced_by` | `UUID` | FK → `users.id`, `NOT NULL` | |
| `replaced_at` | `TIMESTAMP` | default now | |

**Index:** `salary_structure_id`.

---

### 🔔 `notifications`
*Migrations: `032_create_notifications.sql`, `033_alter_notifications_add_types.sql`, `036_alter_notifications_add_profile_created.sql`*

The in-app notification system: one row per (recipient, event) — never a broadcast row, so a multi-recipient event (e.g. both a manager and an employee caring about the same leave request) is one insert per recipient, not a wider table. Created by `notificationService.js`'s `notify*` helpers, almost all called right after the triggering action succeeds (leave request submit/decide/withdraw/cancel, profile submit/verify/send-back, salary slip confirm/void, manager reassignment, salary structure update, account status change, delegation nomination, invite acceptance) — always a non-critical side effect, so its own failure never fails the real action. The two exceptions are `DELEGATION_STARTED`/`DELEGATION_ENDED`: time-based rather than event-driven (a delegation's start/end date isn't anyone's action on the day itself), created by `notificationSweepService.js`'s periodic sweep (`server.js`, hourly) instead of a request handler — see the dedupe note below.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `recipient_id` | `UUID` | FK → `users.id`, `NOT NULL` | Who sees this notification — every read/mutate endpoint filters by this against the authenticated caller |
| `actor_id` | `UUID` | FK → `users.id`, nullable | Who/what caused it (e.g. the employee who submitted) |
| `type` | `VARCHAR(40)` | `CHECK IN (...)` | One entry per `notify*` helper — `LEAVE_REQUEST_SUBMITTED`, `LEAVE_REQUEST_DECIDED`, `LEAVE_REQUEST_WITHDRAWN_CANCELLED`, `PROFILE_SUBMITTED`, `PROFILE_VERIFIED`, `PROFILE_SENT_BACK`, `SALARY_SLIP_GENERATED`, `SALARY_SLIP_VOIDED`, `MANAGER_REASSIGNED`, `TEAM_MEMBER_ASSIGNED`, `SALARY_STRUCTURE_UPDATED`, `ACCOUNT_STATUS_CHANGED`, `DELEGATION_NOMINATED`, `DELEGATION_STARTED`, `DELEGATION_ENDED`, `INVITE_ACCEPTED` (033 added everything from `SALARY_SLIP_VOIDED` on), `PROFILE_CREATED` (036) |
| `entity_type` | `VARCHAR(20)` | `CHECK IN ('LEAVE_REQUEST','PROFILE','SALARY_SLIP','DELEGATION')` | What this is about — the frontend derives a deep-link route from `type`/`entity_type`/`entity_id` (`client/src/utils/notificationRouting.js`); deliberately no stored route/URL, keeping UI routing out of the database. `PROFILE` is reused for anything "about a user's own record" beyond just verification — manager reassignment, salary structure updates, status changes, invite acceptance — rather than adding a new entity type per field that changed |
| `entity_id` | `UUID` | `NOT NULL` | The leave request/employee/salary slip/delegation id |
| `message` | `TEXT` | `NOT NULL` | A single precomputed human-readable line (e.g. "Priya Sharma submitted a Sick Leave request") — not a template resolved client-side |
| `is_read` | `BOOLEAN` | `NOT NULL`, default `false` | |
| `read_at` | `TIMESTAMP` | nullable | |
| `created_at` / `updated_at` | `TIMESTAMP` | default now | |

**Index:** `(recipient_id, is_read, created_at DESC)` — backs both "my unread count" and "my notification list, newest first" at NFR-7 scale. No unique constraint on `(type, entity_id)` — `notificationRepository.existsNotificationCreatedToday` (a plain `WHERE type = $1 AND entity_id = $2 AND created_at::date = CURRENT_DATE`) is instead how `notifyDelegationStarted`/`notifyDelegationEnded` guard against the periodic sweep creating a duplicate on the same calendar day; a *future* occurrence of the same delegation transition (there isn't one — a delegation's start/end date fires once) is deliberately not blocked by this, since the check is scoped to "today."

---
