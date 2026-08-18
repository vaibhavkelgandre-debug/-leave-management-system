-- Lets HR explain, in their own words, why a profile was sent back for
-- correction (misleading info, a mismatch against an uploaded document,
-- etc.) — mirrors the existing profile_verified_by/profile_verified_at
-- pair, just for the send-back action instead of verify.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_send_back_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_send_back_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_send_back_at TIMESTAMP;
