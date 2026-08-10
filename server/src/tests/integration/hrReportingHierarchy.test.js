// An HR_ADMIN can now have a manager — specifically whichever HR admin
// created them (see reportingService.js and userService.changeManager) —
// so a chain like A invites B (B reports to A), B invites C (C reports to
// B or A) can form. Editing who a given HR admin reports to is restricted
// to whoever created that HR admin in the first place.
import request from "supertest";
import app from "../../app.js";
import { describe, it, expect } from "vitest";
import { createRootHr, createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("HR reporting hierarchy", () => {
    it("lets the creating HR admin change who their created HR admin reports to", async () => {
        const hrA = await createRootHr({ email: "hier-hrA@example.com" });
        const hrB = await createUser({ email: "hier-hrB@example.com", role: "HR_ADMIN", managerId: hrA.id, invitedBy: hrA.id });
        const hrC = await createRootHr({ email: "hier-hrC@example.com" });

        const hrAAgent = await loginAs(hrA);
        const response = await hrAAgent.patch(`/api/users/${hrB.id}/manager`).send({ managerId: hrC.id });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.manager_id).toBe(hrC.id);
    });

    it("rejects a different HR admin (not the creator) trying to change who a created HR admin reports to", async () => {
        const hrA = await createRootHr({ email: "hier-nonCreatorA@example.com" });
        const hrB = await createUser({
            email: "hier-nonCreatorB@example.com",
            role: "HR_ADMIN",
            managerId: hrA.id,
            invitedBy: hrA.id,
        });
        const otherHr = await createRootHr({ email: "hier-nonCreatorOther@example.com" });

        const otherHrAgent = await loginAs(otherHr);
        const response = await otherHrAgent.patch(`/api/users/${hrB.id}/manager`).send({ managerId: otherHr.id });

        expect(response.statusCode).toBe(403);
    });

    it("rejects any HR admin trying to change a root HR admin's manager — nobody created them", async () => {
        const rootHr = await createRootHr({ email: "hier-root@example.com" });
        const anotherRootHr = await createRootHr({ email: "hier-root-other@example.com" });

        const anotherAgent = await loginAs(anotherRootHr);
        const response = await anotherAgent
            .patch(`/api/users/${rootHr.id}/manager`)
            .send({ managerId: anotherRootHr.id });

        expect(response.statusCode).toBe(403);
    });

    it("still detects a cycle within an HR chain (C is already under B, so B can't be re-parented to C)", async () => {
        const hrA = await createRootHr({ email: "hier-cycleA@example.com" });
        const hrB = await createUser({
            email: "hier-cycleB@example.com",
            role: "HR_ADMIN",
            managerId: hrA.id,
            invitedBy: hrA.id,
        });
        const hrC = await createUser({
            email: "hier-cycleC@example.com",
            role: "HR_ADMIN",
            managerId: hrB.id,
            invitedBy: hrB.id,
        });

        const hrAAgent = await loginAs(hrA);
        const response = await hrAAgent.patch(`/api/users/${hrB.id}/manager`).send({ managerId: hrC.id });

        expect(response.statusCode).toBe(409);
    });

    it("shows the invited HR admin's manager_id set to the inviter right after accepting the invite", async () => {
        const hrA = await createRootHr({ email: "hier-postinvite@example.com" });
        const hrAAgent = await loginAs(hrA);

        const inviteResponse = await hrAAgent.post("/api/users/invite").send({
            firstName: "Second",
            lastName: "Hr",
            email: "hier-postinvite-b@example.com",
            role: "HR_ADMIN",
            managerId: hrA.id,
        });

        expect(inviteResponse.statusCode).toBe(201);
        expect(inviteResponse.body.data.user.manager_id).toBe(hrA.id);

        const getResponse = await hrAAgent.get(`/api/users/${inviteResponse.body.data.user.id}`);
        expect(getResponse.body.data.manager_id).toBe(hrA.id);
    });
});
