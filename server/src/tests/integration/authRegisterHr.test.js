import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";

const REG_CODE = process.env.HR_REGISTRATION_CODE;

describe("POST /api/auth/register/hr", () => {
    it("creates the single SUPER_ADMIN as the tree root, already VERIFIED", async () => {
        const response = await request(app).post("/api/auth/register/hr").send({
            registrationCode: REG_CODE,
            firstName: "Root",
            lastName: "Admin",
            email: "root@example.com",
            password: "Password123!",
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.role).toBe("SUPER_ADMIN");
        expect(response.body.data.user.manager_id).toBeNull();
        expect(response.body.data.user.profile_status).toBe("VERIFIED");
        expect(response.headers["set-cookie"]).toBeDefined();
        expect(JSON.stringify(response.body)).not.toContain("password_hash");
    });

    it("rejects an invalid registration code", async () => {
        const response = await request(app).post("/api/auth/register/hr").send({
            registrationCode: "wrong-code",
            firstName: "Root",
            lastName: "Admin",
            email: "root2@example.com",
            password: "Password123!",
        });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
    });

    it("rejects a second bootstrap attempt once a super admin already exists", async () => {
        const first = await request(app).post("/api/auth/register/hr").send({
            registrationCode: REG_CODE,
            firstName: "Root",
            lastName: "Admin",
            email: "root3@example.com",
            password: "Password123!",
        });
        expect(first.statusCode).toBe(201);

        const second = await request(app).post("/api/auth/register/hr").send({
            registrationCode: REG_CODE,
            firstName: "Second",
            lastName: "Admin",
            email: "second@example.com",
            password: "Password123!",
        });

        expect(second.statusCode).toBe(409);
        expect(second.body.success).toBe(false);

        // The first super admin is untouched by the rejected second attempt.
        const stillOnlyOne = await request(app).post("/api/auth/register/hr").send({
            registrationCode: REG_CODE,
            firstName: "Third",
            lastName: "Admin",
            email: "third@example.com",
            password: "Password123!",
        });
        expect(stillOnlyOne.statusCode).toBe(409);
    });
});
