# Keeping this in sync, and the ERD

> Part of [Database Schema](README.md). If this disagrees with the code, the code wins.

---

## 📌 Keep this file in sync

> **Rule:** Whenever a new file is added to `server/src/sql/`, update this document in the same change — new/changed tables in the diagram and table breakdown below, and move anything from "🔮 Planned" to "✅ Live" once it's actually built. This is also logged in [`.claude/rules.md`](../.claude/rules.md) under Database Rules.

---

## 🧬 Entity-relationship diagram (live schema)

```mermaid
erDiagram
    ROLES ||--o{ USERS : "assigned to"
    USERS ||--o{ USERS : "manages"
    USERS ||--o{ INVITATIONS : "invited as"
    USERS ||--o{ INVITATIONS : "sent by"
    USERS ||--o{ OAUTH_ACCOUNTS : "links"
    USERS ||--o{ PASSWORD_RESETS : "requests"
    USERS ||--o{ LEAVE_BALANCES : "has"
    LEAVE_TYPES ||--o{ LEAVE_BALANCES : "tracked by"
    USERS ||--o{ LEAVE_REQUESTS : "submits"
    LEAVE_TYPES ||--o{ LEAVE_REQUESTS : "requested as"
    LEAVE_REQUESTS ||--o{ LEAVE_BALANCE_LEDGER : "produces"
    LEAVE_REQUESTS ||--o{ AUDIT_LOGS : "history"
    LEAVE_REQUESTS ||--o| LEAVE_REQUEST_DOCUMENTS : "may have"
    USERS ||--o{ LEAVE_REQUEST_DOCUMENTS : "uploaded"
    USERS ||--o{ DELEGATIONS : "delegates as manager"
    USERS ||--o{ DELEGATIONS : "stands in as delegate"
    USERS ||--o{ SALARY_SLIPS : "belongs to"
    SALARY_SLIPS ||--o{ SALARY_SLIP_REVISIONS : "archives"
    USERS ||--o{ EMPLOYEE_DOCUMENTS : "uploads"
    USERS ||--o| SALARY_STRUCTURES : "assigned"
    SALARY_STRUCTURES ||--o{ SALARY_STRUCTURE_REVISIONS : "archives"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ NOTIFICATIONS : "triggers as actor"

    ROLES {
        uuid id PK
        varchar role_name UK "SUPER_ADMIN / HR_ADMIN / MANAGER / EMPLOYEE"
        text description
    }
    USERS {
        uuid id PK
        varchar first_name
        varchar last_name
        varchar email UK
        text password_hash "nullable until an invite is accepted"
        uuid role_id FK
        uuid manager_id FK "self-referencing; NULL only for the top HR admin"
        uuid department_id "reserved, unused - no departments table exists yet"
        varchar status "ACTIVE / INVITED / INACTIVE"
        timestamp last_login_at
        varchar employee_code "HR-assigned, informational only"
        varchar designation "self-editable (Module 5 v2)"
        varchar department "self-editable"
        varchar phone "self-editable"
        date date_of_birth "self-editable"
        varchar highest_education "self-editable"
        varchar passport_number "self-editable, masked from managers"
        date passport_expiry_date "self-editable"
        date joining_date "self-editable"
        date last_working_day "self-editable"
        varchar blood_group "self-editable"
        varchar marital_status "self-editable, SINGLE/MARRIED/OTHER"
        text current_address "self-editable"
        text permanent_address "self-editable"
        varchar nearest_airport "self-editable"
        text health_problem "self-editable"
        varchar health_insurance_status "self-editable"
        varchar emergency_contact_1_phone "self-editable"
        varchar emergency_contact_1_relationship "self-editable"
        varchar emergency_contact_2_phone "self-editable"
        varchar emergency_contact_2_relationship "self-editable"
        varchar pan_number "self-editable, masked from managers"
        varchar aadhar_number "self-editable, masked from managers"
        varchar bank_account_number "self-editable, masked from managers"
        varchar bank_ifsc_code "self-editable, masked from managers"
        varchar bank_name "self-editable, masked from managers"
        varchar profile_status "INCOMPLETE / SUBMITTED / VERIFIED"
        uuid profile_verified_by FK "nullable"
        timestamp profile_verified_at "nullable"
        text profile_send_back_reason "nullable, cleared on resubmit"
        uuid profile_send_back_by FK "nullable"
        timestamp profile_send_back_at "nullable"
    }
    INVITATIONS {
        uuid id PK
        uuid user_id FK "the invited account"
        text token_hash UK
        uuid invited_by FK "the HR admin who sent it"
        timestamp expires_at
        timestamp accepted_at "NULL while still pending"
    }
    OAUTH_ACCOUNTS {
        uuid id PK
        uuid user_id FK
        varchar provider "GOOGLE today"
        varchar provider_user_id
        varchar provider_email
    }
    PASSWORD_RESETS {
        uuid id PK
        uuid user_id FK
        text token_hash UK
        timestamp expires_at
        timestamp used_at "NULL while still usable"
    }
    LEAVE_TYPES {
        uuid id PK
        varchar name UK "case-insensitive unique"
        numeric annual_entitlement "multiple of 0.5"
        varchar accrual_type "UPFRONT / MONTHLY"
        boolean allow_negative_balance
        boolean requires_document
        boolean counts_as_lop "Module 5 v2 - unpaid leave for payroll"
        boolean is_active
    }
    LEAVE_BALANCES {
        uuid id PK
        uuid user_id FK
        uuid leave_type_id FK
        int year
        numeric entitlement "days_taken/days_pending are NOT columns - derived from LEAVE_BALANCE_LEDGER"
    }
    HOLIDAYS {
        uuid id PK
        varchar name
        date start_date
        date end_date "equals start_date for a single-day holiday"
    }
    LEAVE_REQUESTS {
        uuid id PK
        uuid employee_id FK
        uuid leave_type_id FK
        date start_date
        date end_date
        boolean start_half_day
        boolean end_half_day
        numeric working_days "snapshotted at submission, never recomputed"
        text reason
        varchar status "SUBMITTED/APPROVED/REJECTED/WITHDRAWN/CANCELLED"
        uuid decided_by FK "nullable"
        timestamp decided_at
        text decision_comment
    }
    LEAVE_BALANCE_LEDGER {
        uuid id PK
        uuid user_id FK
        uuid leave_type_id FK
        int year
        uuid leave_request_id FK
        numeric pending_delta
        numeric taken_delta
        varchar reason "SUBMIT/APPROVE/REJECT/WITHDRAW/CANCEL/HR_OVERRIDE_*"
    }
    DELEGATIONS {
        uuid id PK
        uuid manager_id FK
        uuid delegate_id FK
        date start_date
        date end_date
    }
    AUDIT_LOGS {
        uuid id PK
        uuid leave_request_id FK
        uuid actor_id FK
        uuid acted_for FK "set only when a delegate acts"
        varchar action
        varchar old_status
        varchar new_status
        text comment
    }
    LEAVE_REQUEST_DOCUMENTS {
        uuid id PK
        uuid leave_request_id FK UK "one document per request"
        varchar cloudinary_public_id
        varchar cloudinary_resource_type "image/raw"
        varchar original_filename
        varchar mime_type
        int file_size_bytes
        uuid uploaded_by FK
    }
    SALARY_SLIPS {
        uuid id PK
        uuid employee_id FK
        varchar pay_period "YYYY-MM"
        numeric basic_pay
        numeric hra
        numeric pf_employee_contribution
        numeric pf_employer_contribution
        numeric esic
        numeric special_allowance
        numeric lop_days "computed from approved leave"
        numeric lop_deduction "computed"
        numeric total_leave_days "computed, any leave type"
        numeric payable_days "computed, joining-date aware"
        numeric income_tax "flat, HR-declared"
        numeric net_pay "computed, never CSV-provided"
        uuid created_by FK
        uuid updated_by FK "nullable"
    }
    SALARY_SLIP_REVISIONS {
        uuid id PK
        uuid salary_slip_id FK
        uuid employee_id FK "denormalized"
        varchar pay_period "denormalized"
        numeric basic_pay
        numeric hra
        numeric pf_employee_contribution
        numeric pf_employer_contribution
        numeric esic
        numeric special_allowance
        numeric lop_days
        numeric lop_deduction
        numeric total_leave_days "nullable"
        numeric payable_days "nullable"
        numeric income_tax
        numeric net_pay
        uuid replaced_by FK
        timestamp replaced_at
    }
    EMPLOYEE_DOCUMENTS {
        uuid id PK
        uuid employee_id FK
        varchar document_type "PAN_CARD/AADHAR_CARD/BANK_PASSBOOK/OFFER_LETTER unique per employee, OTHER unlimited"
        varchar document_name "label for an OTHER row, else NULL"
        varchar cloudinary_public_id
        varchar cloudinary_resource_type "image/raw"
        varchar original_filename
        varchar mime_type
        int file_size_bytes
        varchar status "PENDING_REVIEW / VERIFIED / REJECTED"
        uuid reviewed_by FK "nullable"
        timestamp reviewed_at "nullable"
        text review_comment "nullable"
        uuid uploaded_by FK
    }
    SALARY_STRUCTURES {
        uuid id PK
        uuid employee_id FK UK "one current structure per employee"
        numeric basic_salary
        numeric hra
        numeric pf_employee_contribution
        numeric pf_employer_contribution
        numeric esic
        numeric special_allowance
        numeric income_tax "flat, HR-declared"
        uuid created_by FK
        uuid updated_by FK "nullable"
    }
    SALARY_STRUCTURE_REVISIONS {
        uuid id PK
        uuid salary_structure_id FK
        uuid employee_id FK "denormalized"
        numeric basic_salary
        numeric hra
        numeric pf_employee_contribution
        numeric pf_employer_contribution
        numeric esic
        numeric special_allowance
        numeric income_tax
        uuid replaced_by FK
        timestamp replaced_at
    }
    NOTIFICATIONS {
        uuid id PK
        uuid recipient_id FK
        uuid actor_id FK "nullable"
        varchar type "e.g. LEAVE_REQUEST_SUBMITTED, PROFILE_SENT_BACK"
        varchar entity_type "LEAVE_REQUEST / PROFILE / SALARY_SLIP"
        uuid entity_id
        text message "precomputed, human-readable"
        boolean is_read
        timestamp read_at "nullable"
    }
```

`HOLIDAYS` has no relationship to any other table — it's standalone reference data (see the note in its section below).

---
