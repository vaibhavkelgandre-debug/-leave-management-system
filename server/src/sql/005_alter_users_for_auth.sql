ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

ALTER TABLE users ADD CONSTRAINT chk_manager_not_self CHECK (manager_id IS NULL OR manager_id <> id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email));

CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users (manager_id);
