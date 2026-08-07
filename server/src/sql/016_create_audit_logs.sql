-- Module 3 (FR-021): a full, append-only audit trail of every leave request
-- state change. Append-only is enforced by convention, not a DB grant — the
-- repository layer (auditLogRepository.js) only ever exposes an insert
-- function, never update/delete, so there is no code path that could edit
-- a row after the fact.
CREATE TABLE IF NOT EXISTS audit_logs (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    leave_request_id UUID NOT NULL
        REFERENCES leave_requests(id)
        ON DELETE CASCADE,

    actor_id UUID NOT NULL
        REFERENCES users(id),

    -- Set only when a delegate acts on a manager's behalf, to the manager
    -- being represented — NULL for every other actor (owner, direct manager,
    -- HR override), so "who acted vs. who they acted for" is only ever
    -- ambiguous in the one case where it's supposed to be recorded (FR-020).
    acted_for UUID
        REFERENCES users(id),

    action VARCHAR(30) NOT NULL,

    old_status VARCHAR(20),

    new_status VARCHAR(20),

    comment TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE INDEX IF NOT EXISTS idx_audit_logs_leave_request_id ON audit_logs (leave_request_id);
