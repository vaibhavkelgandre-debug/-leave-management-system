-- FR-025 (Module 5): a salary slip HR generates for an employee for a given
-- pay period, from a bulk payroll CSV upload (see salarySlipService.js) —
-- never a per-employee manual upload. One slip per employee per pay period;
-- a re-upload for the same period replaces the existing row via
-- ON CONFLICT (see salarySlipRepository.replaceSlipsForPeriod), rather than
-- creating a duplicate or refusing the correction.
CREATE TABLE IF NOT EXISTS salary_slips (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employee_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- "YYYY-MM" rather than free text like "March 2026" — sortable, and
    -- unambiguous for the UNIQUE constraint below.
    pay_period VARCHAR(7) NOT NULL
        CHECK (pay_period ~ '^\d{4}-\d{2}$'),

    basic_pay NUMERIC(12,2) NOT NULL CHECK (basic_pay >= 0),
    allowances NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
    deductions NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
    tax NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
    -- Stored as provided by the CSV, not derived from the four figures
    -- above — reconciling net_pay against them is a validation check at
    -- upload time (salarySlipService.validateAndMatchRows), not something
    -- recomputed here.
    net_pay NUMERIC(12,2) NOT NULL CHECK (net_pay >= 0),

    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_salary_slips_employee_period UNIQUE (employee_id, pay_period)

);

CREATE INDEX IF NOT EXISTS idx_salary_slips_employee_id ON salary_slips (employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_slips_pay_period ON salary_slips (pay_period);

-- Append-only snapshot of a slip's values immediately before a correction
-- overwrites them — same append-only philosophy as audit_logs: the
-- repository layer only ever exposes an insert into this table, never an
-- update/delete, so a correction's "before" state stays attributable
-- without a full versioning system. employee_id/pay_period are denormalized
-- so history stays readable even after the current row has moved on.
CREATE TABLE IF NOT EXISTS salary_slip_revisions (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    salary_slip_id UUID NOT NULL
        REFERENCES salary_slips(id)
        ON DELETE CASCADE,

    employee_id UUID NOT NULL REFERENCES users(id),
    pay_period VARCHAR(7) NOT NULL,

    basic_pay NUMERIC(12,2) NOT NULL,
    allowances NUMERIC(12,2) NOT NULL,
    deductions NUMERIC(12,2) NOT NULL,
    tax NUMERIC(12,2) NOT NULL,
    net_pay NUMERIC(12,2) NOT NULL,

    replaced_by UUID NOT NULL REFERENCES users(id),
    replaced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE INDEX IF NOT EXISTS idx_salary_slip_revisions_salary_slip_id ON salary_slip_revisions (salary_slip_id);
