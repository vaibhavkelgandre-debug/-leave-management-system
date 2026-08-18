-- Module 5 v2: the salary structure HR assigns once per employee (Basic/
-- HRA/PF employee+employer/ESIC/Special Allowance/Income Tax) — replaces
-- the bulk-CSV-per-month model. A monthly payroll run (salarySlipService.js
-- calculatePayroll) reads whichever structure is CURRENT at calculation
-- time; it does not track "what the structure was during period X" beyond
-- the revision archive below.
CREATE TABLE IF NOT EXISTS salary_structures (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employee_id UUID NOT NULL UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    basic_salary NUMERIC(12,2) NOT NULL CHECK (basic_salary >= 0),
    hra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
    pf_employee_contribution NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pf_employee_contribution >= 0),
    pf_employer_contribution NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pf_employer_contribution >= 0),
    esic NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (esic >= 0),
    special_allowance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (special_allowance >= 0),
    -- A flat, HR-declared monthly deduction — not a computed slab-based TDS
    -- calculation (out of scope; see salarySlipService.js's module comment).
    income_tax NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (income_tax >= 0),

    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- Append-only snapshot of a structure's values immediately before HR
-- changes them — same archive-on-replace philosophy as
-- salary_slip_revisions/audit_logs.
CREATE TABLE IF NOT EXISTS salary_structure_revisions (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    salary_structure_id UUID NOT NULL
        REFERENCES salary_structures(id)
        ON DELETE CASCADE,

    employee_id UUID NOT NULL REFERENCES users(id),

    basic_salary NUMERIC(12,2) NOT NULL,
    hra NUMERIC(12,2) NOT NULL,
    pf_employee_contribution NUMERIC(12,2) NOT NULL,
    pf_employer_contribution NUMERIC(12,2) NOT NULL,
    esic NUMERIC(12,2) NOT NULL,
    special_allowance NUMERIC(12,2) NOT NULL,
    income_tax NUMERIC(12,2) NOT NULL,

    replaced_by UUID NOT NULL REFERENCES users(id),
    replaced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE INDEX IF NOT EXISTS idx_salary_structure_revisions_structure_id ON salary_structure_revisions (salary_structure_id);
