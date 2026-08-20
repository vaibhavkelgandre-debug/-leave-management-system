ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Dropped first so a replay re-adds it instead of failing on a duplicate
-- constraint name — the same drop-then-add shape used by every later
-- constraint change in this directory (018/019/027/028/029).
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_manager_not_self;
ALTER TABLE users ADD CONSTRAINT chk_manager_not_self CHECK (manager_id IS NULL OR manager_id <> id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email));

CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users (manager_id);
