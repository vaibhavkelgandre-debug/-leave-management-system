CREATE TABLE IF NOT EXISTS leave_types (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    annual_entitlement NUMERIC(5,1) NOT NULL CHECK (annual_entitlement >= 0),

    accrual_type VARCHAR(20) NOT NULL
        CHECK (accrual_type IN ('UPFRONT','MONTHLY')),

    allow_negative_balance BOOLEAN NOT NULL DEFAULT false,

    requires_document BOOLEAN NOT NULL DEFAULT false,

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_types_name_lower ON leave_types (lower(name));
