import request from "supertest";
import app from "../../app.js";
import { describe, it, expect } from "vitest";
import { createRootHr, createUser, DEFAULT_PASSWORD } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("GET /api/users", () => {
    it("requires authentication", async () => {
        const response = await request(app).get("/api/users");

        expect(response.statusCode).toBe(401);
    });

    it("returns envelope-wrapped users data for an authenticated caller", async () => {
        const hr = await createRootHr({ email: "hr-routes@example.com" });
        const agent = await loginAs(hr);

        const response = await agent.get("/api/users");

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });
});

describe("PATCH /api/users/me/profile", () => {
    it("updates only the allowed self-editable fields", async () => {
        const employee = await createUser({ email: "profile-update@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.patch("/api/users/me/profile").send({
            phone: "9876543210",
            currentAddress: "1 Example Street",
            panNumber: "abcde1234f",
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data).toMatchObject({
            phone: "9876543210",
            current_address: "1 Example Street",
            pan_number: "ABCDE1234F",
        });
    });

    it("ignores any smuggled role/manager/status/email fields in the body", async () => {
        const employee = await createUser({ email: "profile-smuggle@example.com" });
        const hr = await createRootHr({ email: "profile-smuggle-hr@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.patch("/api/users/me/profile").send({
            phone: "9876543210",
            role: "HR_ADMIN",
            managerId: hr.id,
            status: "INACTIVE",
            email: "hijacked@example.com",
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.role).toBe("EMPLOYEE");
        expect(response.body.data.status).toBe("ACTIVE");
        expect(response.body.data.email).toBe(employee.email);
    });
});

describe("POST /api/users/me/password", () => {
    it("rejects a wrong current password", async () => {
        const employee = await createUser({ email: "password-wrong@example.com" });
        const agent = await loginAs(employee);

        const response = await agent
            .post("/api/users/me/password")
            .send({ currentPassword: "NotTheRealPassword1!", newPassword: "NewPassword123!" });

        expect(response.statusCode).toBe(401);
    });

    it("accepts a correct current password and the new password subsequently authenticates", async () => {
        const employee = await createUser({ email: "password-change@example.com" });
        const agent = await loginAs(employee);

        const response = await agent
            .post("/api/users/me/password")
            .send({ currentPassword: DEFAULT_PASSWORD, newPassword: "NewPassword123!" });
        expect(response.statusCode).toBe(200);

        await request(app)
            .post("/api/auth/login")
            .send({ email: employee.email, password: "NewPassword123!" })
            .expect(200);
    });
});
