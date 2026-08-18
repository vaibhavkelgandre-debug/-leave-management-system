-- Module 5 v2: reworks salary_slips/salary_slip_revisions from the generic
-- (basic_pay, allowances, deductions, tax, net_pay) shape (021, CSV-driven)
-- to the structure-matching shape a calculated payroll run produces
-- (salarySlipService.calculatePayroll) — `allowances`/`deductions`/`tax`
-- are dropped in favor of the specific components a salary_structures row
-- actually has, plus the LOP figures computed for that period. No real
-- payroll data has been generated yet, so this is a clean column swap
-- rather than a data-migrating rename.
ALTER TABLE salary_slips DROP COLUMN IF EXISTS allowances;
ALTER TABLE salary_slips DROP COLUMN IF EXISTS deductions;
ALTER TABLE salary_slips DROP COLUMN IF EXISTS tax;

ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS hra NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS pf_employee_contribution NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS pf_employer_contribution NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS esic NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS special_allowance NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS lop_days NUMERIC(5,1) NOT NULL DEFAULT 0 CHECK (lop_days >= 0);
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS lop_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (lop_deduction >= 0);
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS income_tax NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE salary_slip_revisions DROP COLUMN IF EXISTS allowances;
ALTER TABLE salary_slip_revisions DROP COLUMN IF EXISTS deductions;
ALTER TABLE salary_slip_revisions DROP COLUMN IF EXISTS tax;

ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS hra NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS pf_employee_contribution NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS pf_employer_contribution NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS esic NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS special_allowance NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS lop_days NUMERIC(5,1) NOT NULL DEFAULT 0;
ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS lop_deduction NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS income_tax NUMERIC(12,2) NOT NULL DEFAULT 0;
