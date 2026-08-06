import request from "supertest";
import app from "../../app.js";
import { describe, it, expect } from "vitest";
import { createRootHr, createUser, createLeaveType } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("Leave types", () => {
    it("requires authentication", async () => {
        const response = await request(app).get("/api/leave-types");
        expect(response.statusCode).toBe(401);
    });

    it("lets HR create a leave type", async () => {
        const hr = await createRootHr({ email: "hr-leavetypes-create@example.com" });
        const agent = await loginAs(hr);

        const response = await agent.post("/api/leave-types").send({
            name: "Annual Leave",
            annualEntitlement: 12,
            accrualType: "UPFRONT",
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe("Annual Leave");
        expect(response.body.data.is_active).toBe(true);
    });

    it("rejects creation from a non-HR caller", async () => {
        const employee = await createUser({ role: "EMPLOYEE", email: "emp-leavetypes-create@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.post("/api/leave-types").send({
            name: "Sick Leave",
            annualEntitlement: 10,
            accrualType: "UPFRONT",
        });

        expect(response.statusCode).toBe(403);
    });

    it("rejects a duplicate name (case-insensitive)", async () => {
        const hr = await createRootHr({ email: "hr-leavetypes-dup@example.com" });
        const agent = await loginAs(hr);

        await agent.post("/api/leave-types").send({
            name: "Casual Leave",
            annualEntitlement: 6,
            accrualType: "UPFRONT",
        });

        const response = await agent.post("/api/leave-types").send({
            name: "casual leave",
            annualEntitlement: 6,
            accrualType: "UPFRONT",
        });

        expect(response.statusCode).toBe(409);
    });

    it("rejects an entitlement that isn't a multiple of 0.5", async () => {
        const hr = await createRootHr({ email: "hr-leavetypes-invalid@example.com" });
        const agent = await loginAs(hr);

        const response = await agent.post("/api/leave-types").send({
            name: "Odd Leave",
            annualEntitlement: 5.3,
            accrualType: "UPFRONT",
        });

        expect(response.statusCode).toBe(422);
    });

    it("hides inactive leave types from non-HR callers but shows them to HR with includeInactive", async () => {
        const hr = await createRootHr({ email: "hr-leavetypes-status@example.com" });
        const hrAgent = await loginAs(hr);
        const employee = await createUser({ role: "EMPLOYEE", email: "emp-leavetypes-status@example.com" });
        const employeeAgent = await loginAs(employee);

        const leaveType = await createLeaveType({ name: "Deprecated Leave" });
        await hrAgent.patch(`/api/leave-types/${leaveType.id}/status`).send({ isActive: false });

        const asEmployee = await employeeAgent.get("/api/leave-types");
        expect(asEmployee.body.data.find((lt) => lt.id === leaveType.id)).toBeUndefined();

        const asHr = await hrAgent.get("/api/leave-types?includeInactive=true");
        expect(asHr.body.data.find((lt) => lt.id === leaveType.id)).toBeDefined();
    });
});
