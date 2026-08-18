// Shared "does this HR-tier actor have authority over this specific person"
// check, used by every HR-scoped write action (profile verification, document
// review, salary structure/slips, leave-request visibility) instead of each
// one re-deriving it. An HR_ADMIN's authority is subtree-wide (isUserInSubtree,
// a transitive manager_id walk) — this app supports more than one HR_ADMIN,
// each the root of their own branch, and "HR can act on any request" always
// meant "their own branch," not company-wide. SUPER_ADMIN's authority is
// deliberately narrower: only their direct-report HR_ADMINs, never those
// HR_ADMINs' own downstream teams — reusing isUserInSubtree for SUPER_ADMIN
// would transitively include the entire company (every HR_ADMIN eventually
// funnels up to the one SUPER_ADMIN), which was explicitly rejected in favor
// of "acts as HR for other HR who report directly to them," read literally.
import { isUserInSubtree, isDirectReport, findSubtreeUsers, findDirectReports } from "../repositories/userRepository.js";

export async function isInActorsHrScope(actor, targetId) {
    if (actor.role === "SUPER_ADMIN") {
        return isDirectReport(actor.id, targetId);
    }
    if (actor.role === "HR_ADMIN") {
        return isUserInSubtree(actor.id, targetId);
    }
    return false;
}

// The list-shaped counterpart to isInActorsHrScope above — every user row
// currently in an HR-tier actor's scope, used wherever a caller previously
// did findSubtreeUsers(actor.id) then filtered itself out. SUPER_ADMIN's
// direct reports never include themselves, so no self-filter is needed there.
export async function getHrScopedUsers(actor) {
    if (actor.role === "SUPER_ADMIN") {
        return findDirectReports(actor.id);
    }
    const subtree = await findSubtreeUsers(actor.id);
    return subtree.filter((person) => person.id !== actor.id);
}

export async function getHrScopedEmployeeIds(actor) {
    const users = await getHrScopedUsers(actor);
    return users.map((person) => person.id);
}
