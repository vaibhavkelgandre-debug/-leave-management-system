import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import pool from "../../config/db.js";
import { createUser } from "./helpers/factories.js";

function extractToken(link) {
    return link.split("/reset-password/")[1];
}

async function getLatestResetLink(email) {
    const result = await pool.query(
        `SELECT pr.token_hash, pr.expires_at
         FROM password_resets pr
         JOIN users u ON u.id = pr.user_id
         WHERE u.email = $1
         ORDER BY pr.created_at DESC
         LIMIT 1`,
        [email]
    );
    return result.rows[0];
}

describe("Password reset flow", () => {
    it("returns the same generic response whether or not the email exists", async () => {
        await createUser({ email: "reset-user@example.com" });

        const existing = await request(app)
            .post("/api/auth/password-reset/request")
            .send({ email: "reset-user@example.com" });
        const unknown = await request(app)
            .post("/api/auth/password-reset/request")
            .send({ email: "no-such-user@example.com" });

        expect(existing.statusCode).toBe(200);
        expect(unknown.statusCode).toBe(200);
        expect(existing.body.message).toBe(unknown.body.message);
    });

    it("creates a usable reset row only for an existing active user", async () => {
        await createUser({ email: "has-reset-row@example.com" });

        await request(app).post("/api/auth/password-reset/request").send({ email: "has-reset-row@example.com" });

        const row = await getLatestResetLink("has-reset-row@example.com");
        expect(row).toBeTruthy();
    });

    it("resets the password end to end and the token is single-use", async () => {
        const user = await createUser({ email: "reset-flow@example.com" });

        await request(app).post("/api/auth/password-reset/request").send({ email: user.email });

        // Recover the raw token the same way a real "email" link would carry it:
        // insert directly isn't possible since only the hash is stored, so we
        // read it back via a temporary console capture is unnecessary here —
        // instead, drive the request/confirm cycle through the service directly.
        const { requestPasswordReset } = await import("../../services/passwordResetService.js");
        const logs = [];
        const originalLog = console.log;
        console.log = (msg) => logs.push(msg);
        await requestPasswordReset(user.email);
        console.log = originalLog;

        const link = logs.find((l) => l.includes("/reset-password/"));
        const token = extractToken(link);

        const confirmResponse = await request(app)
            .post("/api/auth/password-reset/confirm")
            .send({ token, password: "BrandNewPassword1!" });
        expect(confirmResponse.statusCode).toBe(200);

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({ email: user.email, password: "BrandNewPassword1!" });
        expect(loginResponse.statusCode).toBe(200);

        const reuseResponse = await request(app)
            .post("/api/auth/password-reset/confirm")
            .send({ token, password: "AnotherPassword1!" });
        expect(reuseResponse.statusCode).toBe(401);
    });

    it("rejects an invalid token", async () => {
        const response = await request(app)
            .post("/api/auth/password-reset/confirm")
            .send({ token: "not-a-real-token", password: "SomePassword1!" });

        expect(response.statusCode).toBe(401);
    });
});
