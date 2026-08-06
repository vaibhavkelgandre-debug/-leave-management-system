import request from "supertest";
import app from "../../app.js";
import { describe, it, expect } from "vitest";
import { createRootHr } from "./helpers/factories.js";
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
