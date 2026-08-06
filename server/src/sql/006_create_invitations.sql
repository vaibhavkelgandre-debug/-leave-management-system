CREATE TABLE IF NOT EXISTS invitations (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    invited_by UUID NOT NULL
        REFERENCES users(id),

    expires_at TIMESTAMP NOT NULL,

    accepted_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_active_user
    ON invitations (user_id)
    WHERE accepted_at IS NULL;
