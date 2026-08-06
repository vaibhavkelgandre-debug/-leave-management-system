// Shared helper for generating one-time secure tokens (e.g. invitations,
// password reset links): only the hash is stored in the DB, so a database
// leak alone can't be used to redeem the token — the raw value is only ever
// sent to the user (email link) and never persisted.
import crypto from "node:crypto";

// Creates a random token to hand to the user (email link) plus its hash to
// store in the DB — lets us verify a redeemed token later without ever
// keeping the redeemable value at rest.
export function generateSecureToken() {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashSecureToken(rawToken);
    return { rawToken, tokenHash };
}

// Deterministically hashes a raw token so it can be looked up/compared
// against the stored hash when a user clicks an invitation/reset link.
export function hashSecureToken(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
}
