-- Lets HR void a salary slip generated for the wrong pay period by mistake,
-- without losing the record that it happened — a status flag (soft delete),
-- not a DELETE, matching this table's existing archive-on-replace
-- philosophy (salary_slip_revisions is append-only, never overwritten or
-- dropped).
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'VOIDED'));
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id);
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS void_reason TEXT;
