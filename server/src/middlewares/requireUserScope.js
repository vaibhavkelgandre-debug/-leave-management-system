import { forbidden, notFound } from "../utils/appError.js";
import { findUserById, isUserInSubtree } from "../repositories/userRepository.js";

// Restricts a user-scoped route (e.g. GET /users/:id) to: the user themself,
// HR_ADMIN/SUPER_ADMIN (who can see everyone — company-wide read stays the
// same for both, only write/act authority is narrower for SUPER_ADMIN), or a
// MANAGER whose reporting subtree includes the target user — enforces the
// org-hierarchy visibility rule so managers can't view/act on arbitrary
// employees outside their team.
export function requireUserScope(paramName = "id") {
    return async (req, res, next) => {
        try {
            const targetId = req.params[paramName];

            if (req.user.id === targetId) {
                return next();
            }

            if (req.user.role === "HR_ADMIN" || req.user.role === "SUPER_ADMIN") {
                return next();
            }

            const target = await findUserById(targetId);
            if (!target) {
                return next(notFound("User not found"));
            }

            if (req.user.role === "MANAGER" && (await isUserInSubtree(req.user.id, targetId))) {
                return next();
            }

            return next(forbidden("You do not have permission to view this user"));
        } catch (error) {
            next(error);
        }
    };
}
