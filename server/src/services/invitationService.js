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
import { notifyTeamMemberAssigned, notifyInviteAccepted, notifyProfileCreated } from "./notificationService.js";
import { sendEmployeeInviteEmail } from "./mailService.js";
import { generateSecureToken, hashSecureToken } from "../utils/secureToken.js";
import { hashPassword } from "../utils/password.js";
import { signAuthToken } from "../utils/jwt.js";
import { badRequest, unauthorized } from "../utils/appError.js";

// How long an invite link stays valid before the recipient must be re-invited — keeps
// stale, unused invites from being redeemable indefinitely. Once this lapses the
// account itself is removed (see deleteExpiredInvitees), so the person disappears
// from the employee list and their email is freed up for a fresh invite.
//
// Shortened from 24 hours now that the link is delivered by email rather than
// pasted to the recipient by HR: it sits in an inbox (and in whatever else has
// a copy of that inbox — a synced phone, a shared mailbox, a mail archive), so
// the window in which an intercepted copy is still redeemable is the thing
// worth shrinking. Twelve hours is deliberately not shorter than that: this
// link is the *only* way into a brand-new account, the account itself is
// deleted once the link lapses (deleteExpiredInvitees), and there is no
// resend endpoint — so an over-tight window means HR re-typing the whole
// employee form, not just re-sending a link.
//
// Three properties do the rest of the work and are all enforced elsewhere:
// the token is stored only as a SHA-256 hash (`generateSecureToken`), it is
// single-use (`accepted_at` is stamped by `markAccepted`, and
// `findActiveByTokenHash` only matches rows where it's still null), and the
// raw link is never logged outside development.
const DEFAULT_INVITE_TTL_HOURS = 12;
const MIN_INVITE_TTL_HOURS = 1;
const MAX_INVITE_TTL_HOURS = 72;

// Read per-invite rather than captured at import time so the value is a
// deployment setting (change it, restart, done) and so tests can set it per
// case. Clamped, not trusted: an unparseable or absurd value
// (`INVITE_TOKEN_TTL_HOURS=2400`, a stray comma) would otherwise silently
// mint a hundred-day credential — the exact failure this window exists to
// prevent, arrived at by typo.
function inviteTtlHours() {
    const configured = Number(process.env.INVITE_TOKEN_TTL_HOURS);
    if (!Number.isFinite(configured) || configured <= 0) {
        return DEFAULT_INVITE_TTL_HOURS;
    }
    return Math.min(Math.max(configured, MIN_INVITE_TTL_HOURS), MAX_INVITE_TTL_HOURS);
}

// A trailing slash would produce "...//invite/x" and an unset var a literal
// "undefined/invite/x" — the same defensive shape passwordResetService.js
// uses for its reset links, and for the same reason: now that this address is
// emailed to a real person rather than shown to the HR admin who could see it
// was wrong, a malformed link burns the token on a dead page.
function inviteLinkFor(rawToken) {
    const base = (process.env.CLIENT_BASE_URL || "").replace(/\/+$/, "");
    if (!base) return null;
    return `${base}/invite/${rawToken}`;
}

// Onboards a new employee/manager without public self-registration: HR creates the
// account up front in an INVITED (inactive) state and emails a one-time link that lets
// the recipient set their own password. This keeps account creation under HR's control
// while still letting users choose their own credentials.
//
// Output: `{ user, inviteLink, emailSent, expiresAt }`. `inviteLink` is still
// returned to HR even though the email now carries it — it's the fallback for
// an unconfigured/failed mail setup, and it leaks nothing new: the caller is
// the HR admin who just created this account and could invite them again
// anyway. `emailSent` is false when mail is unconfigured, switched off
// (config/mailFeatures.js) or the send failed, which is what tells the UI
// whether to lean on that fallback.
//
// Failure modes: 400 for an unknown role or an illegal manager assignment.
// A mail failure is deliberately *not* one of them — see the send below.
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

    const ttlHours = inviteTtlHours();
    const { rawToken, tokenHash } = generateSecureToken();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await insertInvitation({
        userId: user.id,
        tokenHash,
        invitedBy: invitedByUserId,
        expiresAt,
    });

    const inviteLink = inviteLinkFor(rawToken);

    if (process.env.NODE_ENV !== "production") {
        console.log(`Invite link for ${email}: ${inviteLink}`);
    }

    if (!inviteLink) {
        // Nothing to email and nothing HR can share, but the account and its
        // invitation row are already written — reporting that plainly beats
        // throwing and leaving a stranded INVITED user with no explanation.
        console.error("CLIENT_BASE_URL is not set — cannot build an invite link");
        return { user, inviteLink: null, emailSent: false, expiresAt };
    }

    // Awaited, unlike the password-reset send: there's no account-enumeration
    // concern here (the caller is an authenticated HR admin who already knows
    // this account exists — they just created it), and HR needs the answer to
    // know whether to fall back to sharing the link by hand. The mailer's own
    // timeouts cap the wait at ~10s.
    //
    // Never fatal: the account, its leave balances and its invitation row are
    // all committed by now, so throwing would leave HR looking at an error
    // beside an employee who *was* in fact created — and the link in the
    // response is still a working way to onboard them.
    let emailSent = false;
    try {
        const invitedBy = invitedByUserId ? await findUserById(invitedByUserId) : null;
        emailSent = await sendEmployeeInviteEmail({
            to: email,
            firstName,
            role,
            inviteLink,
            expiresInHours: ttlHours,
            invitedByName: invitedBy ? `${invitedBy.first_name} ${invitedBy.last_name}`.trim() : null,
        });
    } catch (error) {
        // inviteLink is deliberately absent from this log: it's a live
        // credential, and application logs are the one place it shouldn't be
        // duplicated to.
        console.error(`Failed to send invite email to ${email}:`, error.message);
    }

    return { user, inviteLink, emailSent, expiresAt };
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
    // Both non-critical side effects; actor is the accepting user themself
    // in each case — there's no HR actor in the loop at accept time.
    await notifyInviteAccepted(user.id, user.id);
    await notifyProfileCreated(user.id, user.id);

    const authToken = signAuthToken({ sub: user.id });
    return { token: authToken, user };
}
