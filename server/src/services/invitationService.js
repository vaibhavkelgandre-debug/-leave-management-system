import {
    insertUser,
    findUserById,
    setPasswordHashAndActivate,
} from "../repositories/userRepository.js";
import { findRoleByName } from "../repositories/roleRepository.js";
import {
    insertInvitation,
    findActiveByTokenHash,
    markAccepted,
} from "../repositories/invitationRepository.js";
import { assertManagerAllowed } from "./reportingService.js";
import { seedBalancesForUser } from "./leaveBalanceService.js";
import { notifyTeamMemberAssigned, notifyInviteAccepted } from "./notificationService.js";
import { generateSecureToken, hashSecureToken } from "../utils/secureToken.js";
import { hashPassword } from "../utils/password.js";
import { signAuthToken } from "../utils/jwt.js";
import { badRequest, unauthorized } from "../utils/appError.js";

// How long an invite link stays valid before the recipient must be re-invited — keeps
// stale, unused invites from being redeemable indefinitely. Once this lapses the
// account itself is removed (see deleteExpiredInvitees), so the person disappears
// from the employee list and their email is freed up for a fresh invite.
const INVITE_TOKEN_TTL_HOURS = Number(process.env.INVITE_TOKEN_TTL_HOURS) || 24;

// Onboards a new employee/manager without public self-registration: HR creates the
// account up front in an INVITED (inactive) state and emails a one-time link that lets
// the recipient set their own password. This keeps account creation under HR's control
// while still letting users choose their own credentials.
export async function inviteEmployee({ firstName, lastName, email, role, managerId }, invitedByUserId) {
    const roleRecord = await findRoleByName(role);
    if (!roleRecord) {
        throw badRequest("Unknown role");
    }

    if (managerId) {
        await assertManagerAllowed(role, managerId);
    }
    const resolvedManagerId = managerId || null;

    const user = await insertUser({
        firstName,
        lastName,
        email,
        passwordHash: null,
        roleId: roleRecord.id,
        managerId: resolvedManagerId,
        status: "INVITED",
    });

    // Every employee needs a balance for each active leave type (FR-008) as
    // soon as they exist, rather than waiting for a scheduled job.
    await seedBalancesForUser(user.id);

    // Non-critical side effect — tells the assigned manager right away,
    // rather than waiting for the invite to even be accepted (an invited-but-
    // not-yet-active account can't be notified itself, so only the manager
    // side fires here; see notifyInviteAccepted below for HR's side, which
    // fires once the account is actually active).
    if (resolvedManagerId) {
        await notifyTeamMemberAssigned(user, resolvedManagerId, invitedByUserId);
    }

    const { rawToken, tokenHash } = generateSecureToken();
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await insertInvitation({
        userId: user.id,
        tokenHash,
        invitedBy: invitedByUserId,
        expiresAt,
    });

    const inviteLink = `${process.env.CLIENT_BASE_URL}/invite/${rawToken}`;

    if (process.env.NODE_ENV !== "production") {
        console.log(`Invite link for ${email}: ${inviteLink}`);
    }

    return { user, inviteLink };
}

// Checks an invite link is still valid (unexpired, not already accepted) before showing
// the recipient the accept-invitation form, without requiring them to be logged in.
export async function verifyInvitationToken(rawToken) {
    const tokenHash = hashSecureToken(rawToken);
    const invitation = await findActiveByTokenHash(tokenHash);

    if (!invitation || invitation.expires_at < new Date()) {
        throw unauthorized("This invitation link is invalid or has expired");
    }

    const user = await findUserById(invitation.user_id);
    if (!user) {
        throw unauthorized("This invitation link is invalid or has expired");
    }

    return {
        email: user.email,
        first_name: user.first_name,
        expires_at: invitation.expires_at,
    };
}

export async function acceptInvitation({ token, password }) {
    const tokenHash = hashSecureToken(token);
    const invitation = await findActiveByTokenHash(tokenHash);

    if (!invitation || invitation.expires_at < new Date()) {
        throw unauthorized("This invitation link is invalid or has expired");
    }

    const passwordHash = await hashPassword(password);
    const user = await setPasswordHashAndActivate(invitation.user_id, passwordHash);
    await markAccepted(invitation.id);
    await notifyInviteAccepted(user.id, user.id); // non-critical side effect; actor is the accepting user themself

    const authToken = signAuthToken({ sub: user.id });
    return { token: authToken, user };
}
