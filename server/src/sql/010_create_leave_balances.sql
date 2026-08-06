CREATE TABLE IF NOT EXISTS leave_balances (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    leave_type_id UUID NOT NULL
        REFERENCES leave_types(id)
        ON DELETE RESTRICT,

    year INTEGER NOT NULL,

    entitlement NUMERIC(5,1) NOT NULL DEFAULT 0,

    days_taken NUMERIC(5,1) NOT NULL DEFAULT 0,

    days_pending NUMERIC(5,1) NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_leave_balances_user_type_year UNIQUE (user_id, leave_type_id, year)

);

CREATE INDEX IF NOT EXISTS idx_leave_balances_user_id ON leave_balances (user_id);
