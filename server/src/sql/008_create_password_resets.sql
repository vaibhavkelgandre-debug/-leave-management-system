CREATE TABLE IF NOT EXISTS password_resets (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMP NOT NULL,

    used_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

CREATE UNIQUE INDEX IF NOT EXISTS uq_password_resets_active_user
    ON password_resets (user_id)
    WHERE used_at IS NULL;
