import apiClient, { unwrap } from "./apiClient.js";
import { toHttpError } from "./httpError.js";

// Passes every field on the raw user row through as-is — the auth context's
// `user` is read directly by ProfilePage/ProfileForm (all the Module 5
// profile fields, `profile_status`, etc.), so trimming it down to a fixed
// allowlist here silently breaks any field added later. `role` is the one
// field actually normalized: some endpoints have historically returned it
// as a nested `{ role_name }` object rather than a plain string.
export function normalizeUser(raw) {
    if (!raw) return null;
    return {
        ...raw,
        role: raw.role?.role_name ?? raw.role_name ?? raw.role ?? null,
    };
}

export async function login({ email, password }) {
    try {
        const response = await apiClient.post(
            "/auth/login",
            { email, password },
            { skipAuthRedirect: true }
        );
        const data = unwrap(response);
        return normalizeUser(data?.user);
    } catch (error) {
        throw toHttpError(error);
    }
}

export async function loginWithGoogle(idToken) {
    try {
        const response = await apiClient.post(
            "/auth/google",
            { idToken },
            { skipAuthRedirect: true }
        );
        const data = unwrap(response);
        return normalizeUser(data?.user);
    } catch (error) {
        throw toHttpError(error);
    }
}

export async function logout() {
    await apiClient.post("/auth/logout");
}

export async function getMe() {
    const response = await apiClient.get("/auth/me", { skipAuthRedirect: true });
    const data = unwrap(response);
    return normalizeUser(data?.user);
}

export async function verifyInvitation(token) {
    try {
        const response = await apiClient.post(
            "/auth/invitations/verify",
            { token },
            { skipAuthRedirect: true }
        );
        return unwrap(response);
    } catch (error) {
        throw toHttpError(error);
    }
}

export async function acceptInvitation({ token, password }) {
    try {
        const response = await apiClient.post(
            "/auth/invitations/accept",
            { token, password },
            { skipAuthRedirect: true }
        );
        const data = unwrap(response);
        return normalizeUser(data?.user);
    } catch (error) {
        throw toHttpError(error);
    }
}

export async function requestPasswordReset(email) {
    try {
        await apiClient.post("/auth/password-reset/request", { email }, { skipAuthRedirect: true });
    } catch (error) {
        throw toHttpError(error);
    }
}

export async function confirmPasswordReset({ token, password }) {
    try {
        await apiClient.post(
            "/auth/password-reset/confirm",
            { token, password },
            { skipAuthRedirect: true }
        );
    } catch (error) {
        throw toHttpError(error);
    }
}
