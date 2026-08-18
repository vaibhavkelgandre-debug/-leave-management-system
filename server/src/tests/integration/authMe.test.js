import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import pool from "../../config/db.js";
import { createUser, createRootHr } from "./helpers/factories.js";
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

    it("includes the caller's direct manager and nearest HR ancestor", async () => {
        const hr = await createRootHr({ email: "reporting-hr@example.com", firstName: "Priya", lastName: "HR" });
        const manager = await createUser({
            email: "reporting-manager@example.com",
            role: "MANAGER",
            managerId: hr.id,
            firstName: "Manoj",
            lastName: "Manager",
        });
        const employee = await createUser({ email: "reporting-employee@example.com", managerId: manager.id });
        const agent = await loginAs(employee);

        const response = await agent.get("/api/auth/me");

        expect(response.body.data.user.manager).toMatchObject({ id: manager.id, first_name: "Manoj" });
        expect(response.body.data.user.hr).toMatchObject({ id: hr.id, first_name: "Priya" });
    });

    it("resolves the nearest HR_ADMIN ancestor even when it isn't the direct manager", async () => {
        const rootHr = await createRootHr({ email: "root-hr@example.com" });
        const middleManager = await createUser({
            email: "middle-manager@example.com",
            role: "MANAGER",
            managerId: rootHr.id,
        });
        const employee = await createUser({ email: "deep-employee@example.com", managerId: middleManager.id });
        const agent = await loginAs(employee);

        const response = await agent.get("/api/auth/me");

        expect(response.body.data.user.manager.id).toBe(middleManager.id);
        expect(response.body.data.user.hr.id).toBe(rootHr.id);
    });

    it("returns null manager and hr for a root HR admin with nobody above them", async () => {
        const rootHr = await createRootHr({ email: "lonely-root-hr@example.com" });
        const agent = await loginAs(rootHr);

        const response = await agent.get("/api/auth/me");

        expect(response.body.data.user.manager).toBeNull();
        expect(response.body.data.user.hr).toBeNull();
    });

    it("invalidates the session once the user is deactivated", async () => {
        const user = await createUser({ email: "deactivated@example.com" });
        const agent = await loginAs(user);

        await pool.query("UPDATE users SET status = 'INACTIVE' WHERE id = $1", [user.id]);

        const response = await agent.get("/api/auth/me");
        expect(response.statusCode).toBe(401);
    });
});
