-- Module 3: an employee's leave request and its lifecycle. `working_days` is
-- snapshotted here at submission time rather than recomputed later, so that
-- editing the holiday calendar afterward can never retroactively change the
-- day count of a request that's already been decided (or the balance history
-- it produced).
CREATE TABLE IF NOT EXISTS leave_requests (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employee_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    leave_type_id UUID NOT NULL
        REFERENCES leave_types(id)
        ON DELETE RESTRICT,

    start_date DATE NOT NULL,

    end_date DATE NOT NULL,

    start_half_day BOOLEAN NOT NULL DEFAULT false,

    end_half_day BOOLEAN NOT NULL DEFAULT false,

    working_days NUMERIC(5,1) NOT NULL CHECK (working_days > 0),

    reason TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED')),

    decided_by UUID
        REFERENCES users(id),

    decided_at TIMESTAMP,

    decision_comment TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_leave_requests_dates CHECK (end_date >= start_date)

);

-- Every list of "my requests" filters by employee_id; overlap detection and
-- the team/approvals view additionally filter by status on top of that.
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status ON leave_requests (employee_id, status);
