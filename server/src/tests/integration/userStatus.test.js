import { describe, it, expect } from "vitest";
import { createRootHr, createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("PATCH /api/users/:id/status", () => {
    it("lets HR deactivate an active employee they created, immediately invalidating their session", async () => {
        const hr = await createRootHr({ email: "hr-status@example.com" });
        const employee = await createUser({ email: "deactivate-me@example.com", managerId: hr.id, invitedBy: hr.id });

        const hrAgent = await loginAs(hr);
        const employeeAgent = await loginAs(employee);

        const response = await hrAgent.patch(`/api/users/${employee.id}/status`).send({ status: "INACTIVE" });
        expect(response.statusCode).toBe(200);
        expect(response.body.data.status).toBe("INACTIVE");

        const meResponse = await employeeAgent.get("/api/auth/me");
        expect(meResponse.statusCode).toBe(401);
    });

    it("lets HR reactivate a previously deactivated employee they created", async () => {
        const hr = await createRootHr({ email: "hr-reactivate@example.com" });
        const employee = await createUser({ email: "reactivate-me@example.com", managerId: hr.id, invitedBy: hr.id });
        const hrAgent = await loginAs(hr);

        await hrAgent.patch(`/api/users/${employee.id}/status`).send({ status: "INACTIVE" });
        const response = await hrAgent.patch(`/api/users/${employee.id}/status`).send({ status: "ACTIVE" });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.status).toBe("ACTIVE");
    });

    it("rejects an HR admin who didn't create this employee from changing their status", async () => {
        const creatorHr = await createRootHr({ email: "hr-status-creator@example.com" });
        const otherHr = await createRootHr({ email: "hr-status-other@example.com" });
        const employee = await createUser({
            email: "status-not-mine@example.com",
            managerId: creatorHr.id,
            invitedBy: creatorHr.id,
        });
        const otherAgent = await loginAs(otherHr);

        const response = await otherAgent.patch(`/api/users/${employee.id}/status`).send({ status: "INACTIVE" });

        expect(response.statusCode).toBe(403);
    });

    it("rejects any HR admin from changing the status of an account with no recorded creator", async () => {
        const hr = await createRootHr({ email: "hr-status-noone@example.com" });
        // No `invitedBy` — mirrors a root account or any pre-existing row
        // with no invitation record at all.
        const employee = await createUser({ email: "status-orphan@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.patch(`/api/users/${employee.id}/status`).send({ status: "INACTIVE" });

        expect(response.statusCode).toBe(403);
    });

    it("rejects HR deactivating their own account", async () => {
        const hr = await createRootHr({ email: "hr-self-deactivate@example.com" });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.patch(`/api/users/${hr.id}/status`).send({ status: "INACTIVE" });

        expect(response.statusCode).toBe(400);
    });

    it("rejects a non-HR user changing status", async () => {
        const hr = await createRootHr({ email: "hr-status2@example.com" });
        const manager = await createUser({ email: "mgr-status@example.com", role: "MANAGER", managerId: hr.id });
        const employee = await createUser({ email: "emp-status@example.com", managerId: manager.id });
        const managerAgent = await loginAs(manager);

        const response = await managerAgent.patch(`/api/users/${employee.id}/status`).send({ status: "INACTIVE" });

        expect(response.statusCode).toBe(403);
    });
});
