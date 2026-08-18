-- FR-026 (Module 5): self-service profile fields the employee themself
-- maintains. All nullable — nothing here is required at invite time, and
-- existing accounts simply have NULL until the employee fills them in.
-- Format checks (PAN pattern, Aadhar digit count, date format) live in
-- profileValidator.js, not here, so they stay cheap to change without a
-- migration.
--
-- pan_number/aadhar_number/bank_account_number/bank_ifsc_code/bank_name are
-- sensitive government/financial identifiers, stored in plaintext (no
-- encryption-at-rest) — masked at the application layer for a manager
-- viewing a report (see userService.maskSensitiveProfileFields), shown in
-- full only to HR and the employee themself.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_number VARCHAR(12);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(34);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(11);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
