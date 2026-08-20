-- Two figures the payroll calculation previously had nowhere to record:
-- `payable_days` (how many of the month's days the earnings figure was
-- actually based on -- less than the full month for someone who joined
-- partway through, so a lower net pay is self-explanatory instead of
-- looking like a miscalculation) and `total_leave_days` (every APPROVED
-- leave day in the period, any leave type -- a superset of the existing
-- LOP-only `lop_days`, which only counts leave types flagged
-- `counts_as_lop`). Nullable on salary_slip_revisions, matching that
-- table's existing role as a pure archive of whatever salary_slips looked
-- like before being overwritten.
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS total_leave_days NUMERIC(5,1) NOT NULL DEFAULT 0
    CHECK (total_leave_days >= 0);
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS payable_days NUMERIC(5,1) NOT NULL DEFAULT 0
    CHECK (payable_days >= 0);

ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS total_leave_days NUMERIC(5,1);
ALTER TABLE salary_slip_revisions ADD COLUMN IF NOT EXISTS payable_days NUMERIC(5,1);
