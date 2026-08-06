import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import { createRootHr } from "./helpers/factories.js";

const REG_CODE = process.env.HR_REGISTRATION_CODE;

describe("POST /api/auth/register/hr", () => {
    it("creates the first HR admin as the tree root", async () => {
        const response = await request(app).post("/api/auth/register/hr").send({
            registrationCode: REG_CODE,
            firstName: "Root",
            lastName: "Admin",
            email: "root@example.com",
            password: "Password123!",
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.manager_id).toBeNull();
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

    it("never assigns a manager to a second HR admin, even if one is passed", async () => {
        await createRootHr({ email: "root3@example.com" });

        const response = await request(app).post("/api/auth/register/hr").send({
            registrationCode: REG_CODE,
            firstName: "Second",
            lastName: "Admin",
            email: "second@example.com",
            password: "Password123!",
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.data.user.manager_id).toBeNull();
    });
});
