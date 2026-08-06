import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Hashes a plaintext password before storage (signup/password reset) so raw
// passwords are never persisted — bcrypt salts automatically, so identical
// passwords still produce different hashes.
export async function hashPassword(plain) {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

// Checks a login attempt against the stored hash; guards against accounts
// that have no password set yet (e.g. OAuth-only users) by treating a
// missing hash as "never matches" instead of throwing.
export async function verifyPassword(plain, hash) {
    if (!hash) {
        return false;
    }
    return bcrypt.compare(plain, hash);
}
