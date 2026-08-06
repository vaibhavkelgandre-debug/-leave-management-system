import request from "supertest";
import app from "../../app.js";
import { describe, it, expect } from "vitest";
import { createRootHr, createUser, createLeaveType } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("Leave balances", () => {
    it("requires authentication", async () => {
        const response = await request(app).get("/api/leave-balances/me");
        expect(response.statusCode).toBe(401);
    });

    it("self-heals a balance row for a leave type created after the employee", async () => {
        const employee = await createUser({ role: "EMPLOYEE", email: "emp-balances-selfheal@example.com" });
        const leaveType = await createLeaveType({ name: "Self-Heal Leave", annualEntitlement: 8 });
        const agent = await loginAs(employee);

        const response = await agent.get("/api/leave-balances/me");

        expect(response.statusCode).toBe(200);
        const balance = response.body.data.find((b) => b.leave_type_id === leaveType.id);
        expect(balance).toBeDefined();
        expect(Number(balance.entitlement)).toBe(8);
        expect(Number(balance.days_remaining)).toBe(8);
    });

    it("backfills every active employee when HR creates a leave type via the API", async () => {
        const hr = await createRootHr({ email: "hr-balances-backfill@example.com" });
        const employee = await createUser({ role: "EMPLOYEE", email: "emp-balances-backfill@example.com" });
        const hrAgent = await loginAs(hr);

        const created = await hrAgent.post("/api/leave-types").send({
            name: "Backfilled Leave",
            annualEntitlement: 4,
            accrualType: "UPFRONT",
        });

        const response = await hrAgent.get(`/api/leave-balances/user/${employee.id}`);
        const balance = response.body.data.find((b) => b.leave_type_id === created.body.data.id);
        expect(balance).toBeDefined();
        expect(Number(balance.entitlement)).toBe(4);
    });

    it("seeds balances for a newly invited employee", async () => {
        const hr = await createRootHr({ email: "hr-balances-invite@example.com" });
        await createLeaveType({ name: "Invite Seed Leave", annualEntitlement: 5 });
        const hrAgent = await loginAs(hr);

        const inviteResponse = await hrAgent.post("/api/users/invite").send({
            firstName: "New",
            lastName: "Hire",
            email: "new-hire-balances@example.com",
            role: "EMPLOYEE",
            managerId: hr.id,
        });

        const newUserId = inviteResponse.body.data.user.id;
        const response = await hrAgent.get(`/api/leave-balances/user/${newUserId}`);
        expect(response.body.data.some((b) => Number(b.entitlement) === 5)).toBe(true);
    });

    it("lets a manager view a subordinate's balances but not an unrelated employee's", async () => {
        const managerA = await createUser({ role: "MANAGER", email: "manager-a-balances@example.com" });
        const reportA = await createUser({
            role: "EMPLOYEE",
            managerId: managerA.id,
            email: "report-a-balances@example.com",
        });
        const managerB = await createUser({ role: "MANAGER", email: "manager-b-balances@example.com" });

        const agentA = await loginAs(managerA);

        const ownReport = await agentA.get(`/api/leave-balances/user/${reportA.id}`);
        expect(ownReport.statusCode).toBe(200);

        const otherManager = await agentA.get(`/api/leave-balances/user/${managerB.id}`);
        expect(otherManager.statusCode).toBe(403);
    });
});
