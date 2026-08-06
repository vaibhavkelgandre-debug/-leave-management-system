import {
    deleteExpiredInvitees,
    findAllUsers,
    findSubtreeUsers,
    findUserById,
    updateManager,
    updateStatus,
} from "../repositories/userRepository.js";
import { assertNoCycle } from "./reportingService.js";
import { badRequest, notFound } from "../utils/appError.js";

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

export async function changeManager(id, managerId) {
    const target = await getUserById(id);

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
