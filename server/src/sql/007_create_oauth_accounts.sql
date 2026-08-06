CREATE TABLE IF NOT EXISTS oauth_accounts (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    provider VARCHAR(20) NOT NULL
        CHECK (provider IN ('GOOGLE')),

    provider_user_id VARCHAR(255) NOT NULL,

    provider_email VARCHAR(255) NOT NULL,

    linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (provider, provider_user_id),

    UNIQUE (user_id, provider)

);
