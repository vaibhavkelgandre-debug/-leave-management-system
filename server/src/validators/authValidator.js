// Request-shape and business-rule checks for every auth endpoint (login, HR
// registration, invitations, password reset) — enforced before controllers run.
import { z } from "zod";

// Login only needs a well-formed email and a non-empty password — the actual
// credential check (hash comparison) happens later in the service, not here.
export const loginSchema = z.object({
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(1, "Password is required"),
});

// Google OAuth sign-in exchanges a Google-issued ID token for a session, so
// all this schema needs to confirm is that a token was actually sent.
export const googleLoginSchema = z.object({
    idToken: z.string().min(1, "idToken is required"),
});

// GitHub OAuth sign-in exchanges an authorization code (not an ID token like
// Google) for a session, so this schema only needs to confirm one was sent.
export const githubLoginSchema = z.object({
    code: z.string().min(1, "code is required"),
});

// Enforces the "no public registration" rule: an HR admin account can only be
// created by someone who has the secret registration code.
export const registerHrSchema = z.object({
    registrationCode: z.string().min(1, "Registration code is required"),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

// Used when an invited employee opens their invite link, to confirm the token
// is present before looking it up (and before letting them see the invite details).
export const verifyInviteSchema = z.object({
    token: z.string().min(1, "Token is required"),
});

// Completes onboarding for an invited employee — requires the same invite
// token plus a new password that meets the minimum strength rule.
export const acceptInviteSchema = z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

// First step of "forgot password" — just needs a valid email so a reset link
// can be issued (the service intentionally doesn't reveal if the email exists).
export const requestPasswordResetSchema = z.object({
    email: z.string().trim().email("Enter a valid email address"),
});

// Second step of "forgot password" — the reset token from the emailed link plus
// the new password, which must meet the same strength rule as registration.
export const confirmPasswordResetSchema = z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});
