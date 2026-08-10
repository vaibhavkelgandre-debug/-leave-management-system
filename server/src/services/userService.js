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

// `actor` is only actually consulted for an HR_ADMIN target: HR's own
// reporting line can only be edited by whoever created them (`invited_by`,
// see userRepository.js) — not any other HR admin, even though any HR admin
// can otherwise see/manage everyone. A target with no `invited_by` at all
// (a root HR_ADMIN who registered via POST /auth/register/hr) can't be
// edited by anyone here, same reasoning: there's no legitimate "their own
// creator" to grant that to. Reassigning a MANAGER/EMPLOYEE's manager is
// unaffected — any HR_ADMIN still can, as before.
export async function changeManager(id, managerId, actor) {
    const target = await getUserById(id);

    if (target.role === "HR_ADMIN" && actor.id !== target.invited_by) {
        throw forbidden("Only the HR admin who created this account can change who they report to");
    }

    await assertNoCycle(id, managerId, target.role);
    const updated = await updateManager(id, managerId);
    if (!updated) {
        throw notFound("User not found");
    }
    return getUserById(id);
}

export async function changeStatus(id, status, actorId) {
    if (id === actorId && status === "INACTIVE") {
        throw badRequest("You cannot deactivate your own account");
    }

    const updated = await updateStatus(id, status);
    if (!updated) {
        throw notFound("User not found");
    }
    return getUserById(id);
}
