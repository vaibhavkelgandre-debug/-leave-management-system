import {
    deleteExpiredInvitees,
    findAllUsers,
    findSubtreeUsers,
    findUserById,
    updateManager,
    updateStatus,
} from "../repositories/userRepository.js";
import { assertNoCycle } from "./reportingService.js";
import { badRequest, forbidden, notFound } from "../utils/appError.js";

export async function listUsersFor(actor) {
    // Swept here rather than on a schedule: the project has no job runner, and
    // listing users is the moment the stale rows would otherwise be seen. Same
    // self-healing-on-read approach used for leave balances.
    await deleteExpiredInvitees();

    if (actor.role === "HR_ADMIN") {
        return findAllUsers();
    }

    if (actor.role === "MANAGER") {
        return findSubtreeUsers(actor.id);
    }

    const self = await findUserById(actor.id);
    return self ? [self] : [];
}

export async function getUserById(id) {
    const user = await findUserById(id);
    if (!user) {
        throw notFound("User not found");
    }
    return user;
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
    const target = await getUserById(id);

    if (actor.id !== target.invited_by) {
        throw forbidden("Only the HR admin who created this account can change who they report to");
    }

    await assertNoCycle(id, managerId, target.role);
    const updated = await updateManager(id, managerId);
    if (!updated) {
        throw notFound("User not found");
    }
    return getUserById(id);
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

    const target = await getUserById(id);
    if (actor.id !== target.invited_by) {
        throw forbidden("Only the HR admin who created this account can change its status");
    }

    const updated = await updateStatus(id, status);
    if (!updated) {
        throw notFound("User not found");
    }
    return getUserById(id);
}
