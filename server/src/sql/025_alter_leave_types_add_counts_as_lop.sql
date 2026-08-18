-- Module 5 v2: lets HR flag a leave type (e.g. "Loss of Pay") as unpaid for
-- payroll purposes. LOP days for an employee/pay-period are computed as the
-- sum of `working_days` on their APPROVED requests of any leave type with
-- this flag set, overlapping that period (see salarySlipService.js
-- calculatePayroll) — reuses the existing leave-request/leave-type data
-- instead of a separate attendance system, which doesn't exist in this app.
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS counts_as_lop BOOLEAN NOT NULL DEFAULT false;
