-- Module 3 / NFR-2: balances must never drift from the history that produced
-- them. Rather than mutating running totals on leave_balances directly (where
-- a single missed update anywhere would silently corrupt the number forever),
-- every action that affects a balance writes one append-only entry here, and
-- the displayed days_taken/days_pending are always a SUM() over these rows —
-- see leaveBalanceRepository.js. There is nothing to drift because there is
-- no stored running total to drift.
CREATE TABLE IF NOT EXISTS leave_balance_ledger (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    leave_type_id UUID NOT NULL
        REFERENCES leave_types(id)
        ON DELETE RESTRICT,

    year INTEGER NOT NULL,

    leave_request_id UUID
        REFERENCES leave_requests(id)
        ON DELETE CASCADE,

    pending_delta NUMERIC(5,1) NOT NULL DEFAULT 0,

    taken_delta NUMERIC(5,1) NOT NULL DEFAULT 0,

    -- Which lifecycle event produced this entry; purely descriptive for
    -- humans reading the ledger, not read by any query logic.
    reason VARCHAR(30) NOT NULL
        CHECK (reason IN (
            'SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW', 'CANCEL',
            'HR_OVERRIDE_APPROVE', 'HR_OVERRIDE_REJECT'
        )),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE INDEX IF NOT EXISTS idx_leave_balance_ledger_lookup
    ON leave_balance_ledger (user_id, leave_type_id, year);

-- days_taken/days_pending were plain mutable columns; they're now derived by
-- summing leave_balance_ledger instead (see leaveBalanceRepository.js), so
-- keeping them here would just be a second, driftable source of truth.
ALTER TABLE leave_balances DROP COLUMN IF EXISTS days_taken;
ALTER TABLE leave_balances DROP COLUMN IF EXISTS days_pending;
