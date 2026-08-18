-- Module 5 v2: replaces the initial profile-field sketch from migration 020
-- with the fields actually requested (matched to a real HR onboarding
-- spreadsheet) plus the profile-completion/verification workflow. `address`
-- and the single emergency contact from 020 are dropped and replaced —
-- no real data depends on them yet.
ALTER TABLE users DROP COLUMN IF EXISTS address;
ALTER TABLE users DROP COLUMN IF EXISTS emergency_contact_name;
ALTER TABLE users DROP COLUMN IF EXISTS emergency_contact_phone;

-- HR-assigned, informational only — CSV/bulk matching was dropped in favor
-- of a per-employee salary structure (see 024_create_salary_structures.sql),
-- so this is never used as a lookup key, just displayed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_code ON users (employee_code) WHERE employee_code IS NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS highest_education VARCHAR(150);
-- Sensitive government id, same masking rule as pan_number/aadhar_number
-- (see userService.maskSensitiveProfileFields) — full value only to HR and
-- the employee themself.
ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_expiry_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_working_day DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group VARCHAR(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)
    CHECK (marital_status IN ('SINGLE', 'MARRIED', 'OTHER'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nearest_airport VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS health_problem TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS health_insurance_status VARCHAR(50);

-- Two emergency contacts, phone + relationship only (no separate name
-- field) — matches the source spreadsheet exactly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_1_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_1_relationship VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_2_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_2_relationship VARCHAR(50);

-- Onboarding workflow: employee fills the profile + uploads documents,
-- submits for review, HR verifies (or sends it back with a comment) before
-- a salary structure can be assigned. See profileVerificationStateMachine.js.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_status VARCHAR(20)
    NOT NULL DEFAULT 'INCOMPLETE'
    CHECK (profile_status IN ('INCOMPLETE', 'SUBMITTED', 'VERIFIED'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_verified_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_verified_at TIMESTAMP;
