import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import pool from "../../config/db.js";
import { createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("GET /api/auth/me", () => {
    it("returns 401 without a cookie", async () => {
        const response = await request(app).get("/api/auth/me");
        expect(response.statusCode).toBe(401);
    });

    it("returns the current user for a valid session", async () => {
        const user = await createUser({ email: "me@example.com", role: "MANAGER" });
        const agent = await loginAs(user);

        const response = await agent.get("/api/auth/me");

        expect(response.statusCode).toBe(200);
        expect(response.body.data.user.email).toBe(user.email);
        expect(response.body.data.user.role).toBe("MANAGER");
    });

    it("invalidates the session once the user is deactivated", async () => {
        const user = await createUser({ email: "deactivated@example.com" });
        const agent = await loginAs(user);

        await pool.query("UPDATE users SET status = 'INACTIVE' WHERE id = $1", [user.id]);

        const response = await agent.get("/api/auth/me");
        expect(response.statusCode).toBe(401);
    });
});
