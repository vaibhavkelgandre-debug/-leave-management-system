import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import { createRootHr, createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

function extractToken(inviteLink) {
    return inviteLink.split("/invite/")[1];
}

describe("Invitation flow (FR-001)", () => {
    it("invites, verifies, accepts, then logs in", async () => {
        const hr = await createRootHr({ email: "hr@example.com" });
        const hrAgent = await loginAs(hr);

        const inviteResponse = await hrAgent.post("/api/users/invite").send({
            firstName: "New",
            lastName: "Hire",
            email: "newhire@example.com",
            role: "EMPLOYEE",
            managerId: hr.id,
        });

        expect(inviteResponse.statusCode).toBe(201);
        const { inviteLink } = inviteResponse.body.data;
        const token = extractToken(inviteLink);

        const verifyResponse = await request(app)
            .post("/api/auth/invitations/verify")
            .send({ token });

        expect(verifyResponse.statusCode).toBe(200);
        expect(verifyResponse.body.data.email).toBe("newhire@example.com");

        const acceptResponse = await request(app)
            .post("/api/auth/invitations/accept")
            .send({ token, password: "NewPassword123!" });

        expect(acceptResponse.statusCode).toBe(200);
        expect(acceptResponse.body.data.user.status).toBe("ACTIVE");

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({ email: "newhire@example.com", password: "NewPassword123!" });

        expect(loginResponse.statusCode).toBe(200);

        const reuseResponse = await request(app)
            .post("/api/auth/invitations/accept")
            .send({ token, password: "AnotherPassword1!" });

        expect(reuseResponse.statusCode).toBe(401);
    });

    it("rejects invite from a non-HR user", async () => {
        const hr = await createRootHr({ email: "hr2@example.com" });
        const employee = await createUser({ email: "plainemployee@example.com", managerId: hr.id });
        const employeeAgent = await loginAs(employee);

        const response = await employeeAgent.post("/api/users/invite").send({
            firstName: "New",
            lastName: "Hire",
            email: "shouldnotexist@example.com",
            role: "EMPLOYEE",
            managerId: hr.id,
        });

        expect(response.statusCode).toBe(403);
    });

    it("rejects inviting an HR_ADMIN with a managerId", async () => {
        const hr = await createRootHr({ email: "hr3@example.com" });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.post("/api/users/invite").send({
            firstName: "Second",
            lastName: "Hr",
            email: "secondhr@example.com",
            role: "HR_ADMIN",
            managerId: hr.id,
        });

        expect(response.statusCode).toBe(422);
    });

    it("allows inviting an HR_ADMIN with no manager at all", async () => {
        const hr = await createRootHr({ email: "hr4@example.com" });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.post("/api/users/invite").send({
            firstName: "Second",
            lastName: "Hr",
            email: "secondhr2@example.com",
            role: "HR_ADMIN",
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.data.user.manager_id).toBeNull();
    });

    it("rejects inviting a MANAGER whose manager is another MANAGER, not HR", async () => {
        const hr = await createRootHr({ email: "hr5@example.com" });
        const otherManager = await createUser({ email: "othermgr@example.com", role: "MANAGER", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.post("/api/users/invite").send({
            firstName: "New",
            lastName: "Manager",
            email: "newmanager@example.com",
            role: "MANAGER",
            managerId: otherManager.id,
        });

        expect(response.statusCode).toBe(400);
    });

    it("rejects inviting an EMPLOYEE whose manager is another EMPLOYEE", async () => {
        const hr = await createRootHr({ email: "hr6@example.com" });
        const otherEmployee = await createUser({ email: "otheremployee@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.post("/api/users/invite").send({
            firstName: "New",
            lastName: "Employee",
            email: "newemployee@example.com",
            role: "EMPLOYEE",
            managerId: otherEmployee.id,
        });

        expect(response.statusCode).toBe(400);
    });
});
