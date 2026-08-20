-- IF NOT EXISTS because runMigrations.js has no ledger: it replays every file
-- in order on each run, so a migration that isn't idempotent fails the *whole*
-- run against an already-migrated database (this file was where it stopped).
CREATE TABLE IF NOT EXISTS roles (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    role_name VARCHAR(30) NOT NULL UNIQUE,

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);
