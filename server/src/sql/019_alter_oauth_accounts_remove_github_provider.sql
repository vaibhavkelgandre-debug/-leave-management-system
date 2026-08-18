-- Reverts 018: GitHub login was removed, Google is the only supported OAuth
-- provider again. Any linked GitHub identities are removed first since the
-- narrowed CHECK constraint below would otherwise fail to validate them.
DELETE FROM oauth_accounts WHERE provider = 'GITHUB';

ALTER TABLE oauth_accounts DROP CONSTRAINT IF EXISTS oauth_accounts_provider_check;

ALTER TABLE oauth_accounts ADD CONSTRAINT oauth_accounts_provider_check CHECK (provider IN ('GOOGLE'));
