import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import pool from "../../config/db.js";
import { createRootHr } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

function extractToken(inviteLink) {
    return inviteLink.split("/invite/")[1];
}

async function invite(hrAgent, email, hrId) {
    const response = await hrAgent.post("/api/users/invite").send({
        firstName: "Pending",
        lastName: "Hire",
        email,
        role: "EMPLOYEE",
        managerId: hrId,
    });
    expect(response.statusCode).toBe(201);
    return { user: response.body.data.user, token: extractToken(response.body.data.inviteLink) };
}

// Rather than waiting 24h, push the invitation's expiry into the past.
async function expireInvite(userId) {
    await pool.query(
        "UPDATE invitations SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE user_id = $1",
        [userId]
    );
}

async function listEmails(hrAgent) {
    const response = await hrAgent.get("/api/users");
    expect(response.statusCode).toBe(200);
    return response.body.data.map((u) => u.email);
}

describe("Invite expiry cleanup", () => {
    it("drops a pending employee once their invite has expired", async () => {
        const hr = await createRootHr({ email: "hr-expiry-1@example.com" });
        const hrAgent = await loginAs(hr);
        const { user } = await invite(hrAgent, "never-accepted@example.com", hr.id);

        expect(await listEmails(hrAgent)).toContain("never-accepted@example.com");

        await expireInvite(user.id);

        expect(await listEmails(hrAgent)).not.toContain("never-accepted@example.com");
    });

    it("keeps a pending employee whose invite is still within the window", async () => {
        const hr = await createRootHr({ email: "hr-expiry-2@example.com" });
        const hrAgent = await loginAs(hr);
        await invite(hrAgent, "still-pending@example.com", hr.id);

        expect(await listEmails(hrAgent)).toContain("still-pending@example.com");
    });

    it("never removes someone who already accepted, even with a stale invitation row", async () => {
        const hr = await createRootHr({ email: "hr-expiry-3@example.com" });
        const hrAgent = await loginAs(hr);
        const { user, token } = await invite(hrAgent, "accepted@example.com", hr.id);

        await request(app).post("/api/auth/invitations/accept").send({ token, password: "NewPassword123!" });

        // Force the worst case: an expired, apparently-unaccepted invitation row
        // against an account that is actually ACTIVE. The status guard must win.
        await pool.query(
            `UPDATE invitations
             SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 hour', accepted_at = NULL
             WHERE user_id = $1`,
            [user.id]
        );

        expect(await listEmails(hrAgent)).toContain("accepted@example.com");
    });

    it("frees the email so the same person can be invited again", async () => {
        const hr = await createRootHr({ email: "hr-expiry-4@example.com" });
        const hrAgent = await loginAs(hr);
        const { user } = await invite(hrAgent, "second-chance@example.com", hr.id);

        await expireInvite(user.id);
        await listEmails(hrAgent); // triggers the sweep

        // Without the delete this would fail with a unique-email conflict.
        const reinvite = await hrAgent.post("/api/users/invite").send({
            firstName: "Second",
            lastName: "Chance",
            email: "second-chance@example.com",
            role: "EMPLOYEE",
            managerId: hr.id,
        });

        expect(reinvite.statusCode).toBe(201);
    });

    it("rejects an expired invite link", async () => {
        const hr = await createRootHr({ email: "hr-expiry-5@example.com" });
        const hrAgent = await loginAs(hr);
        const { user, token } = await invite(hrAgent, "too-late@example.com", hr.id);

        await expireInvite(user.id);

        const verify = await request(app).post("/api/auth/invitations/verify").send({ token });
        expect(verify.statusCode).toBe(401);

        const accept = await request(app)
            .post("/api/auth/invitations/accept")
            .send({ token, password: "NewPassword123!" });
        expect(accept.statusCode).toBe(401);
    });
});
