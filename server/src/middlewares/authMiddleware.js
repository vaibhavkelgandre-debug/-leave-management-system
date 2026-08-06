import { verifyAuthToken } from "../utils/jwt.js";
import { AUTH_COOKIE_NAME, clearAuthCookie } from "../utils/cookies.js";
import { findAuthContextById } from "../repositories/userRepository.js";
import { unauthorized } from "../utils/appError.js";

// Gatekeeper for every protected route: validates the session cookie, then
// re-fetches the user's role/status from the DB (rather than trusting the
// JWT payload) so a role change or account deactivation takes effect on the
// very next request instead of waiting for the token to expire or be revoked.
export async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.[AUTH_COOKIE_NAME];
        if (!token) {
            return next(unauthorized("Not authenticated"));
        }

        let payload;
        try {
            payload = verifyAuthToken(token);
        } catch {
            clearAuthCookie(res);
            return next(unauthorized("Session expired"));
        }

        const user = await findAuthContextById(payload.sub);
        if (!user || user.status !== "ACTIVE") {
            clearAuthCookie(res);
            return next(unauthorized("Not authenticated"));
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
}
