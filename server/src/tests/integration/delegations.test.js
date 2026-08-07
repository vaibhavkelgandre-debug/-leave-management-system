import request from "supertest";
import app from "../../app.js";
import { describe, it, expect } from "vitest";
import { createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("Delegations", () => {
    it("requires authentication", async () => {
        const response = await request(app).get("/api/delegations/mine");
        expect(response.statusCode).toBe(401);
    });

    it("rejects a non-manager caller", async () => {
        const employee = await createUser({ email: "deleg-employee@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.get("/api/delegations/mine");
        expect(response.statusCode).toBe(403);
    });

    it("lets a manager nominate a delegate and list it back", async () => {
        const manager = await createUser({ role: "MANAGER", email: "deleg-manager@example.com" });
        const delegate = await createUser({ role: "MANAGER", email: "deleg-delegate@example.com" });
        const agent = await loginAs(manager);

        const created = await agent
            .post("/api/delegations")
            .send({ delegateId: delegate.id, startDate: "2027-06-01", endDate: "2027-06-14" });

        expect(created.statusCode).toBe(201);
        expect(created.body.data.delegate_id).toBe(delegate.id);
        expect(created.body.data.manager_id).toBe(manager.id);

        const list = await agent.get("/api/delegations/mine");
        expect(list.body.data).toHaveLength(1);
        expect(list.body.data[0].id).toBe(created.body.data.id);
    });

    it("rejects delegating to yourself", async () => {
        const manager = await createUser({ role: "MANAGER", email: "deleg-self@example.com" });
        const agent = await loginAs(manager);

        const response = await agent
            .post("/api/delegations")
            .send({ delegateId: manager.id, startDate: "2027-06-01", endDate: "2027-06-14" });

        expect(response.statusCode).toBe(400);
    });

    it("rejects a delegation that overlaps one this manager already has", async () => {
        const manager = await createUser({ role: "MANAGER", email: "deleg-overlap-manager@example.com" });
        const delegateA = await createUser({ role: "MANAGER", email: "deleg-overlap-a@example.com" });
        const delegateB = await createUser({ role: "MANAGER", email: "deleg-overlap-b@example.com" });
        const agent = await loginAs(manager);

        await agent.post("/api/delegations").send({
            delegateId: delegateA.id,
            startDate: "2027-07-01",
            endDate: "2027-07-10",
        });

        const response = await agent.post("/api/delegations").send({
            delegateId: delegateB.id,
            startDate: "2027-07-05",
            endDate: "2027-07-20",
        });

        expect(response.statusCode).toBe(409);
    });

    it("only lists the requesting manager's own delegations, not another manager's", async () => {
        const managerA = await createUser({ role: "MANAGER", email: "deleg-list-a@example.com" });
        const managerB = await createUser({ role: "MANAGER", email: "deleg-list-b@example.com" });
        const delegate = await createUser({ role: "MANAGER", email: "deleg-list-delegate@example.com" });

        const agentA = await loginAs(managerA);
        await agentA.post("/api/delegations").send({ delegateId: delegate.id, startDate: "2027-08-01", endDate: "2027-08-05" });

        const agentB = await loginAs(managerB);
        const response = await agentB.get("/api/delegations/mine");

        expect(response.body.data).toHaveLength(0);
    });
});
