import { describe, it, expect } from "vitest";
import { createRootHr, createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("GET /api/users (role-scoped visibility)", () => {
    it("scopes results by role and never leaks password_hash", async () => {
        const hr = await createRootHr({ email: "hr-scope@example.com" });
        const m1 = await createUser({ email: "m1@example.com", role: "MANAGER", managerId: hr.id });
        const m2 = await createUser({ email: "m2@example.com", role: "MANAGER", managerId: hr.id });
        const e1 = await createUser({ email: "e1@example.com", managerId: m1.id });
        await createUser({ email: "e2@example.com", managerId: m1.id });
        const e3 = await createUser({ email: "e3@example.com", managerId: m2.id });

        const hrAgent = await loginAs(hr);
        const hrResponse = await hrAgent.get("/api/users");
        expect(hrResponse.statusCode).toBe(200);
        expect(hrResponse.body.success).toBe(true);
        expect(hrResponse.body.data.length).toBe(6);
        expect(JSON.stringify(hrResponse.body)).not.toContain("password_hash");

        const m1Agent = await loginAs(m1);
        const m1Response = await m1Agent.get("/api/users");
        const m1Emails = m1Response.body.data.map((u) => u.email);
        expect(m1Emails).toContain(e1.email);
        expect(m1Emails).not.toContain(e3.email);

        const e1Agent = await loginAs(e1);
        const e1Response = await e1Agent.get("/api/users");
        expect(e1Response.body.data.length).toBe(1);
        expect(e1Response.body.data[0].email).toBe(e1.email);
    });
});
