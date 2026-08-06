import { findAuthByEmail, updatePasswordHash } from "../repositories/userRepository.js";
import {
    invalidateActiveForUser,
    insertPasswordReset,
    findActiveByTokenHash,
    markUsed,
} from "../repositories/passwordResetRepository.js";
import { generateSecureToken, hashSecureToken } from "../utils/secureToken.js";
import { hashPassword } from "../utils/password.js";
import { unauthorized } from "../utils/appError.js";

// Keep the reset window short so a leaked/intercepted link (email, logs, etc.)
// has a small blast radius.
const RESET_TOKEN_TTL_HOURS = 1;

// Kicks off the "forgot password" flow: issues a single-use reset token if the
// account exists, but is deliberately silent about whether it does.
export async function requestPasswordReset(email) {
    const user = await findAuthByEmail(email);

    // Always behave the same way whether or not the account exists, so this
    // endpoint can't be used to discover which emails are registered.
    if (!user || user.status !== "ACTIVE") {
        return;
    }

    await invalidateActiveForUser(user.id);

    const { rawToken, tokenHash } = generateSecureToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await insertPasswordReset({ userId: user.id, tokenHash, expiresAt });

    const resetLink = `${process.env.CLIENT_BASE_URL}/reset-password/${rawToken}`;

    if (process.env.NODE_ENV !== "production") {
        console.log(`Password reset link for ${email}: ${resetLink}`);
    }
}

// Completes the flow started by requestPasswordReset: validates the raw token
// sent to the user against its stored hash/expiry, then sets the new password
// and burns the token so it can't be replayed.
export async function confirmPasswordReset({ token, password }) {
    const tokenHash = hashSecureToken(token);
    const reset = await findActiveByTokenHash(tokenHash);

    if (!reset || reset.expires_at < new Date()) {
        throw unauthorized("This password reset link is invalid or has expired");
    }

    const passwordHash = await hashPassword(password);
    await updatePasswordHash(reset.user_id, passwordHash);
    await markUsed(reset.id);
}
