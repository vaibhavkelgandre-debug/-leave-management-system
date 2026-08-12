import crypto from "node:crypto";
import {
    findAuthByEmail,
    touchLastLogin,
    insertUser,
    findUserById,
} from "../repositories/userRepository.js";
import { findRoleByName } from "../repositories/roleRepository.js";
import {
    findByProviderSubject,
    insertOauthAccount,
} from "../repositories/oauthAccountRepository.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAuthToken } from "../utils/jwt.js";
import { getGoogleClient } from "../config/googleClient.js";
import { fetchGithubIdentity } from "../config/githubClient.js";
import { badRequest, unauthorized, forbidden } from "../utils/appError.js";

// Constant-time string comparison so checking the HR registration code doesn't leak
// timing information an attacker could use to guess it character-by-character.
function timingSafeEqualStrings(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

// Verifies email/password credentials and mints a session token — the primary login
// path for users onboarded via HR invite or HR-admin registration. Rejects inactive
// (e.g. offboarded) accounts even if the password is correct.
export async function loginWithPassword({ email, password }) {
    const authUser = await findAuthByEmail(email);

    const isValid = authUser && (await verifyPassword(password, authUser.password_hash));
    if (!isValid || authUser.status !== "ACTIVE") {
        throw unauthorized("Invalid email or password");
    }

    await touchLastLogin(authUser.id);

    const token = signAuthToken({ sub: authUser.id, role: authUser.role });
    const user = await findUserById(authUser.id);
    return { token, user };
}

// Alternative login method for users who already have an account (invited by HR or
// registered as HR_ADMIN) — Google is never used to create new accounts, only to sign
// into existing ones, so an unmatched email is rejected rather than auto-registered.
// The first successful Google sign-in for a user links their Google identity so future
// logins can skip re-verifying the email match.
export async function loginWithGoogle(idToken) {
    const client = getGoogleClient();
    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
    } catch {
        throw unauthorized("Invalid Google token");
    }

    if (!payload?.email_verified) {
        throw unauthorized("Google email is not verified");
    }

    const authUser = await findAuthByEmail(payload.email);
    if (!authUser || authUser.status !== "ACTIVE") {
        throw forbidden("No account found for this email");
    }

    const existingLink = await findByProviderSubject("GOOGLE", payload.sub);
    if (!existingLink) {
        await insertOauthAccount({
            userId: authUser.id,
            provider: "GOOGLE",
            providerUserId: payload.sub,
            providerEmail: payload.email,
        });
    }

    await touchLastLogin(authUser.id);

    const token = signAuthToken({ sub: authUser.id, role: authUser.role });
    const user = await findUserById(authUser.id);
    return { token, user };
}

// Alternative login method via GitHub OAuth — same rules as loginWithGoogle: only
// signs into an existing account matched by email, never creates one, and links the
// GitHub identity on first successful sign-in. GitHub's flow yields an authorization
// code rather than an ID token, so the identity comes from fetchGithubIdentity's code
// exchange instead of a local JWT verification.
export async function loginWithGithub(code) {
    let identity;
    try {
        identity = await fetchGithubIdentity(code);
    } catch {
        throw unauthorized("Invalid GitHub code");
    }

    if (!identity.email) {
        throw unauthorized("GitHub email is not verified");
    }

    const authUser = await findAuthByEmail(identity.email);
    if (!authUser || authUser.status !== "ACTIVE") {
        throw forbidden("No account found for this email");
    }

    const existingLink = await findByProviderSubject("GITHUB", identity.githubId);
    if (!existingLink) {
        await insertOauthAccount({
            userId: authUser.id,
            provider: "GITHUB",
            providerUserId: identity.githubId,
            providerEmail: identity.email,
        });
    }

    await touchLastLogin(authUser.id);

    const token = signAuthToken({ sub: authUser.id, role: authUser.role });
    const user = await findUserById(authUser.id);
    return { token, user };
}

// Bootstraps an HR_ADMIN account using a shared secret code instead of an invite —
// this is the one path into the system that isn't gated by an existing HR user, so it
// exists solely to get the first admin set up.
export async function registerHrRoot({ registrationCode, firstName, lastName, email, password }) {
    if (!timingSafeEqualStrings(registrationCode, process.env.HR_REGISTRATION_CODE || "")) {
        throw unauthorized("Invalid registration code");
    }

    const role = await findRoleByName("HR_ADMIN");
    if (!role) {
        throw badRequest("HR_ADMIN role is not configured");
    }

    // HR_ADMIN accounts never have a manager, regardless of how many other
    // users already exist — role (permissions) and reporting line are
    // independent, but HR is deliberately kept outside the reporting tree.
    const passwordHash = await hashPassword(password);
    const user = await insertUser({
        firstName,
        lastName,
        email,
        passwordHash,
        roleId: role.id,
        managerId: null,
        status: "ACTIVE",
    });

    const token = signAuthToken({ sub: user.id, role: "HR_ADMIN" });
    return { token, user };
}
