import { findSubtreeUsers, findUserById, isUserInSubtree } from "../repositories/userRepository.js";
import { badRequest, conflict } from "../utils/appError.js";

// Encodes the reporting-line hierarchy rule for the org: an EMPLOYEE may
// report to a MANAGER or directly to HR_ADMIN, a MANAGER may only report to
// HR_ADMIN (managers can't report to other managers), and HR_ADMIN has no
// entry here at all because HR_ADMIN can never have a manager.
const ALLOWED_MANAGER_ROLES = {
    EMPLOYEE: ["MANAGER", "HR_ADMIN"],
    MANAGER: ["HR_ADMIN"],
};

// Returns everyone under a user in the reporting tree (used for the "my team"
// view) — excludes the user themselves so it's just their reports.
export async function getTeam(userId) {
    const subtree = await findSubtreeUsers(userId);
    return subtree.filter((user) => user.id !== userId);
}

// Shared by invite (brand-new user, no cycle possible yet) and reassignment
// (existing user, checked for cycles separately by assertNoCycle below).
export async function assertManagerAllowed(targetRole, newManagerId) {
    if (!newManagerId) {
        return null;
    }

    if (targetRole === "HR_ADMIN") {
        throw badRequest("HR_ADMIN accounts cannot have a manager");
    }

    const manager = await findUserById(newManagerId);
    if (!manager || manager.status === "INACTIVE") {
        throw badRequest("Manager not found");
    }

    const allowedRoles = ALLOWED_MANAGER_ROLES[targetRole] || [];
    if (!allowedRoles.includes(manager.role)) {
        throw badRequest(
            targetRole === "MANAGER"
                ? "A manager's manager must be an HR admin"
                : "Only a manager or HR admin can be assigned as a manager"
        );
    }

    return manager;
}

// Guards every manager reassignment against creating an infinite reporting
// loop. Naively setting user A's manager to B is fine on its own, but if B is
// already A's direct or indirect subordinate, A would end up reporting to
// someone who reports to A — a cycle with no top of the tree. isUserInSubtree
// walks B's ancestry-free subtree check (is A's candidate manager already
// underneath A?) to catch that case before it's written to the database.
export async function assertNoCycle(userId, newManagerId, targetRole) {
    if (!newManagerId) {
        return;
    }

    if (newManagerId === userId) {
        throw badRequest("A user cannot be their own manager");
    }

    await assertManagerAllowed(targetRole, newManagerId);

    const wouldCreateCycle = await isUserInSubtree(userId, newManagerId);
    if (wouldCreateCycle) {
        throw conflict("Assigning this manager would create a reporting cycle");
    }
}
