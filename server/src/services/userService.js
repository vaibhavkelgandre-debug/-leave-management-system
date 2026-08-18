import {
    deleteExpiredInvitees,
    findAllUsers,
    findEmployeesPendingVerification,
    findPasswordHashById,
    findReportingLine,
    findSubtreeUsers,
    findUserById,
    findVerifiedEmployees,
    updateManager,
    updatePasswordHash,
    updateProfileFields,
    updateProfileStatus,
    updateStatus,
} from "../repositories/userRepository.js";
import { findDocumentsByEmployeeId } from "../repositories/employeeDocumentRepository.js";
import { REQUIRED_DOCUMENT_TYPES } from "./employeeDocumentService.js";
import { assertNoCycle } from "./reportingService.js";
import { isInActorsHrScope, getHrScopedEmployeeIds } from "./hrScopeService.js";
import { assertLegalProfileTransition } from "./profileVerificationStateMachine.js";
import {
    notifyProfileSubmitted,
    notifyProfileVerified,
    notifyProfileSentBack,
    notifyManagerReassigned,
    notifyTeamMemberAssigned,
    notifyAccountStatusChanged,
} from "./notificationService.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/appError.js";

// The minimum a profile needs before HR can meaningfully review it — not
// every optional field on the sheet (education, passport, blood group, …),
// just enough to actually run payroll and reach the employee in an
// emergency. Checked by submitProfileForVerification below.
const REQUIRED_PROFILE_FIELDS = [
    "phone",
    "current_address",
    "permanent_address",
    "pan_number",
    "aadhar_number",
    "bank_account_number",
    "bank_ifsc_code",
    "bank_name",
    "emergency_contact_1_phone",
    "emergency_contact_1_relationship",
];

// PAN/Aadhar/passport/bank details are sensitive government/financial
// identifiers — shown in full only to HR and to the employee themself;
// nulled out for anyone else viewing the record (e.g. a manager viewing a
// direct report). Other new profile fields (phone/address/DOB/emergency
// contact/designation/etc.) aren't masked: a manager plausibly needs a
// report's contact details, same row-level scope as everything else on
// these endpoints.
const SENSITIVE_PROFILE_FIELDS = [
    "pan_number",
    "aadhar_number",
    "passport_number",
    "bank_account_number",
    "bank_ifsc_code",
    "bank_name",
];

function maskSensitiveProfileFields(user, viewer) {
    if (!user || viewer.id === user.id || viewer.role === "HR_ADMIN" || viewer.role === "SUPER_ADMIN") {
        return user;
    }
    const masked = { ...user };
    for (const field of SENSITIVE_PROFILE_FIELDS) {
        masked[field] = null;
    }
    return masked;
}

// Exported for reportingService's "my team" list (userController.getMyTeam)
// — that path fetches rows via findSubtreeUsers directly rather than through
// listUsersFor below, so it needs the same masking applied explicitly.
export function maskSensitiveProfileFieldsForList(users, viewer) {
    return users.map((user) => maskSensitiveProfileFields(user, viewer));
}

export async function listUsersFor(actor) {
    // Swept here rather than on a schedule: the project has no job runner, and
    // listing users is the moment the stale rows would otherwise be seen. Same
    // self-healing-on-read approach used for leave balances.
    await deleteExpiredInvitees();

    let users;
    if (actor.role === "HR_ADMIN" || actor.role === "SUPER_ADMIN") {
        users = await findAllUsers();
    } else if (actor.role === "MANAGER") {
        users = await findSubtreeUsers(actor.id);
    } else {
        const self = await findUserById(actor.id);
        users = self ? [self] : [];
    }

    return maskSensitiveProfileFieldsForList(users, actor);
}

// A user viewing their own profile also gets a quick summary of who's above
// them in the reporting chain: their direct manager, and the nearest
// HR-tier ancestor — whoever will actually end up verifying their profile,
// per isUserInSubtree's downward-from-HR scoping (the first HR_ADMIN found
// walking up is the closest one whose subtree contains this user) — or, for
// an HR_ADMIN reporting straight to SUPER_ADMIN, SUPER_ADMIN itself (without
// this, an HR_ADMIN whose only ancestor is SUPER_ADMIN would see "hr: null"
// here, since SUPER_ADMIN's role doesn't literally match "HR_ADMIN"). Only
// computed for self-view: nobody else needs it, and it'd be wasted work on
// every row of a list.
async function attachReportingLine(user) {
    const ancestors = await findReportingLine(user.id);
    const toSummary = (row) => ({ id: row.id, first_name: row.first_name, last_name: row.last_name, email: row.email });
    const hrAncestor = ancestors.find((row) => row.role === "HR_ADMIN" || row.role === "SUPER_ADMIN");
    return {
        ...user,
        manager: ancestors[0] ? toSummary(ancestors[0]) : null,
        hr: hrAncestor ? toSummary(hrAncestor) : null,
    };
}

// `viewer` gates the 5 sensitive profile columns (see
// maskSensitiveProfileFields above); every caller of this function passes
// the acting user, even an HR-only one (changeManager/changeStatus below),
// where masking is always a no-op since viewer.role === "HR_ADMIN".
export async function getUserById(id, viewer) {
    const user = await findUserById(id);
    if (!user) {
        throw notFound("User not found");
    }
    const masked = maskSensitiveProfileFields(user, viewer);
    return viewer.id === id ? attachReportingLine(masked) : masked;
}

// Input: the caller's own id and a partial set of self-editable fields
// (already whitelisted twice over — profileValidator.js's zod schema, then
// updateProfileFields' own column whitelist — so this never needs to filter
// anything itself). Output: the caller's own updated record, always
// unmasked (a user editing their own profile is always "self").
export async function updateMyProfile(actorId, fields) {
    const updated = await updateProfileFields(actorId, fields);
    if (!updated) {
        throw notFound("User not found");
    }
    return updated;
}

// Input: the caller's own id. Output: the updated user, moved from
// INCOMPLETE to SUBMITTED. Throws 400 if a required field is still blank or
// either required document hasn't been uploaded yet — this is the one place
// "is this profile actually complete" is checked, so the state machine
// itself never has to know what "complete" means.
export async function submitProfileForVerification(actorId) {
    const user = await findUserById(actorId);
    const missingFields = REQUIRED_PROFILE_FIELDS.filter((field) => !user[field]);
    if (missingFields.length > 0) {
        throw badRequest(`Please fill in all required fields before submitting: ${missingFields.join(", ")}`);
    }

    const documents = await findDocumentsByEmployeeId(actorId);
    const uploadedTypes = new Set(documents.map((document) => document.document_type));
    const missingDocuments = REQUIRED_DOCUMENT_TYPES.filter((type) => !uploadedTypes.has(type));
    if (missingDocuments.length > 0) {
        throw badRequest("Please upload all required documents before submitting");
    }

    const newStatus = assertLegalProfileTransition("SUBMIT", user.profile_status);
    await updateProfileStatus(actorId, { status: newStatus });
    const submittedUser = await findUserById(actorId);
    // Non-critical side effect (see notifyProfileSubmitted) — notifies the
    // nearest HR ancestor, the one whose subtree actually includes this employee.
    await notifyProfileSubmitted(submittedUser);
    return submittedUser;
}

// HR-tier-only, scoped via isInActorsHrScope (HR_ADMIN's own subtree, or
// SUPER_ADMIN's direct-report HR_ADMINs only — see hrScopeService.js) —
// moves a SUBMITTED profile to VERIFIED, recording who verified it and when.
export async function verifyProfile(actor, employeeId) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can verify a profile");
    }
    const employee = await findUserById(employeeId);
    if (!employee || !(await isInActorsHrScope(actor, employeeId))) {
        throw notFound("Employee not found");
    }

    const newStatus = assertLegalProfileTransition("VERIFY", employee.profile_status);
    await updateProfileStatus(employeeId, { status: newStatus, verifiedBy: actor.id, verifiedAt: new Date() });
    await notifyProfileVerified(employeeId, actor.id); // non-critical side effect
    return findUserById(employeeId);
}

// The flip side of verifyProfile — kicks a SUBMITTED profile back to
// INCOMPLETE so the employee can fix and resubmit it. `reason` is required
// (enforced by sendProfileBackSchema at the route layer) and stored on the
// user row — the employee needs to know *what* was wrong (misleading info,
// a mismatch against an uploaded document, etc.) to actually fix it, not
// just that something was. Cleared again once the employee resubmits
// (updateProfileStatus defaults every other transition's fields to null).
export async function sendProfileBack(actor, employeeId, reason) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can send a profile back");
    }
    const employee = await findUserById(employeeId);
    if (!employee || !(await isInActorsHrScope(actor, employeeId))) {
        throw notFound("Employee not found");
    }

    const newStatus = assertLegalProfileTransition("SEND_BACK", employee.profile_status);
    await updateProfileStatus(employeeId, {
        status: newStatus,
        sendBackReason: reason,
        sendBackBy: actor.id,
        sendBackAt: new Date(),
    });
    await notifyProfileSentBack(employeeId, actor.id, reason); // non-critical side effect
    return findUserById(employeeId);
}

// A single employee's full profile for HR's verification detail page.
// Deliberately its own function rather than reusing GET /api/users/:id
// (requireUserScope) — that route lets *any* HR_ADMIN view *any* user
// company-wide, which doesn't match the "each HR admin owns their own
// branch" rule every other HR-scoped action here enforces via
// isInActorsHrScope (documents, salary structures, verify/send-back above).
// Never masked: the caller is always HR-tier by this point, and masking
// only ever applies to a manager viewing a report.
export async function getEmployeeForVerification(actor, employeeId) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can view an employee's profile for verification");
    }
    const employee = await findUserById(employeeId);
    if (!employee || !(await isInActorsHrScope(actor, employeeId))) {
        throw notFound("Employee not found");
    }
    return employee;
}

// HR's queue of profiles awaiting review, scoped to their own HR scope
// (HR_ADMIN's subtree, or SUPER_ADMIN's direct-report HR_ADMINs only).
export async function listPendingVerification(actor) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can view the verification queue");
    }
    const employeeIds = await getHrScopedEmployeeIds(actor);
    return findEmployeesPendingVerification(employeeIds);
}

// The "Verified Employees" section on the same page — everyone in HR's scope
// whose profile has already reached VERIFIED, so HR can jump back into an
// already-verified employee's details (e.g. to adjust their salary
// structure) without hunting through "All Employees".
export async function listVerifiedEmployees(actor) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can view verified employees");
    }
    const employeeIds = await getHrScopedEmployeeIds(actor);
    return findVerifiedEmployees(employeeIds);
}

// Input: the caller's own id, current + new plaintext passwords. Output:
// nothing — throws 401 if the current password doesn't match (same
// `verifyPassword` used by login, which already treats a missing hash as
// "never matches"). Reuses hashPassword exactly as passwordResetService.js
// does for the forgot-password flow.
export async function changeMyPassword(actorId, { currentPassword, newPassword }) {
    const passwordHash = await findPasswordHashById(actorId);
    if (!(await verifyPassword(currentPassword, passwordHash))) {
        throw unauthorized("Current password is incorrect");
    }
    const newHash = await hashPassword(newPassword);
    await updatePasswordHash(actorId, newHash);
}

// Auth is strict per-team, not "any HR admin can manage everyone": a
// target's reporting line can only be edited by whoever created them
// (`invited_by`, see userRepository.js), for every role, not just
// HR_ADMIN — same mechanism and same reasoning as changeStatus below.
// Without this, an HR admin with no reports of their own (or reports
// outside a given branch entirely) could still re-parent a completely
// unrelated team's employees, which is exactly the "any HR admin sees a
// filtered view of every branch" bug already fixed for FR-024's browse/
// report tools, just showing up here for the write side of the Employees
// page instead. A target with no `invited_by` at all (a root HR_ADMIN who
// registered via POST /auth/register/hr) can't be edited by anyone here,
// same reasoning: there's no legitimate "their own creator" to grant that to.
export async function changeManager(id, managerId, actor) {
    const target = await getUserById(id, actor);

    if (actor.id !== target.invited_by) {
        throw forbidden("Only the HR admin who created this account can change who they report to");
    }

    await assertNoCycle(id, managerId, target.role);
    const updated = await updateManager(id, managerId);
    if (!updated) {
        throw notFound("User not found");
    }

    // Non-critical side effects — only fire when this actually assigns a
    // *new* manager (not a no-op re-save of the same one), and never for a
    // reassignment straight to `null` (nobody to tell "you now report to").
    if (managerId && managerId !== target.manager_id) {
        await notifyManagerReassigned(target, managerId, actor.id);
        await notifyTeamMemberAssigned(target, managerId, actor.id);
    }

    return getUserById(id, actor);
}

// Activating/deactivating a user is restricted to whoever created them
// (`invited_by`) — same mechanism, and same reasoning, as changeManager's
// HR_ADMIN restriction above, but applied to every role: any HR admin can
// still *see* everyone (listUsersFor), just not toggle a status they didn't
// create. A user with no `invited_by` at all (a root HR_ADMIN registered
// via POST /auth/register/hr) can't be deactivated by anyone through this
// endpoint — deliberately, there's no legitimate "their creator" to grant
// that to, matching changeManager's same edge case.
export async function changeStatus(id, status, actor) {
    if (id === actor.id && status === "INACTIVE") {
        throw badRequest("You cannot deactivate your own account");
    }

    const target = await getUserById(id, actor);
    if (actor.id !== target.invited_by) {
        throw forbidden("Only the HR admin who created this account can change its status");
    }

    const updated = await updateStatus(id, status);
    if (!updated) {
        throw notFound("User not found");
    }
    await notifyAccountStatusChanged(id, status, actor.id); // non-critical side effect
    return getUserById(id, actor);
}
