import { describe, it, expect } from "vitest";
import { createRootHr, createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

// Note: with the strict 3-tier hierarchy enforced below (EMPLOYEE -> MANAGER
// -> HR_ADMIN -> nobody, with no back-edges allowed), a true reporting cycle
// can no longer be constructed through the API at all — the hierarchy check
// always rejects the offending assignment before the cycle check would ever
// fire. The isUserInSubtree cycle check in reportingService stays in place
// as defense in depth, but it's no longer independently reachable here.
describe("PATCH /api/users/:id/manager (hierarchy & cycle prevention)", () => {
    it("rejects self-assignment", async () => {
        const hr = await createRootHr({ email: "hr-self@example.com" });
        const a = await createUser({ email: "self@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.patch(`/api/users/${a.id}/manager`).send({ managerId: a.id });

        expect(response.statusCode).toBe(400);
    });

    it("allows a valid re-parenting", async () => {
        const hr = await createRootHr({ email: "hr-valid@example.com" });
        const m1 = await createUser({ email: "m1-valid@example.com", role: "MANAGER", managerId: hr.id });
        const m2 = await createUser({ email: "m2-valid@example.com", role: "MANAGER", managerId: hr.id });
        const employee = await createUser({ email: "emp-valid@example.com", managerId: m1.id });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.patch(`/api/users/${employee.id}/manager`).send({ managerId: m2.id });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.manager_id).toBe(m2.id);
    });

    it("rejects assigning a manager to an HR_ADMIN account", async () => {
        const hr = await createRootHr({ email: "hr-noman@example.com" });
        const secondHr = await createUser({ email: "hr2-noman@example.com", role: "HR_ADMIN", managerId: null });
        const manager = await createUser({ email: "mgr-noman@example.com", role: "MANAGER", managerId: hr.id });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.patch(`/api/users/${secondHr.id}/manager`).send({ managerId: manager.id });

        expect(response.statusCode).toBe(400);
    });

    it("rejects assigning another MANAGER as a manager's manager", async () => {
        const hr = await createRootHr({ email: "hr-mgrmgr@example.com" });
        const m1 = await createUser({ email: "m1-mgrmgr@example.com", role: "MANAGER", managerId: hr.id });
        const m2 = await createUser({ email: "m2-mgrmgr@example.com", role: "MANAGER", managerId: hr.id });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.patch(`/api/users/${m1.id}/manager`).send({ managerId: m2.id });

        expect(response.statusCode).toBe(400);
    });

    it("rejects assigning an EMPLOYEE as another employee's manager", async () => {
        const hr = await createRootHr({ email: "hr-empemp@example.com" });
        const manager = await createUser({ email: "mgr-empemp@example.com", role: "MANAGER", managerId: hr.id });
        const e1 = await createUser({ email: "e1-empemp@example.com", managerId: manager.id });
        const e2 = await createUser({ email: "e2-empemp@example.com", managerId: manager.id });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.patch(`/api/users/${e1.id}/manager`).send({ managerId: e2.id });

        expect(response.statusCode).toBe(400);
    });
});
