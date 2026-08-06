import { forbidden } from "../utils/appError.js";

// Route-level authorization gate: lets a route declare which roles
// (e.g. HR_ADMIN, MANAGER) may access it. Must run after requireAuth, which
// populates req.user.
export function requireRole(...roleNames) {
    return (req, res, next) => {
        if (!req.user || !roleNames.includes(req.user.role)) {
            return next(forbidden("You do not have permission to perform this action"));
        }
        next();
    };
}
