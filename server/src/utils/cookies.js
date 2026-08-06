export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "lms_token";

// secure/sameSite differ by environment because the deployment topology
// differs: local dev serves the client and API from the same origin over
// plain http (so "lax"/non-secure works), while production serves them from
// separate subdomains over https on Render, which requires
// sameSite: "none" + secure to let the cookie travel cross-site at all.
function cookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/",
    };
}

// Issues the session cookie after successful login/OAuth — centralized here
// so every login path shares the same cookie name/options.
export function setAuthCookie(res, token) {
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
}

// Logs the user out / invalidates a bad session by removing the cookie;
// options must match setAuthCookie's exactly or the browser won't clear it.
export function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE_NAME, cookieOptions());
}
