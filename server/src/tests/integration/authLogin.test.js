import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import { createUser, DEFAULT_PASSWORD } from "./helpers/factories.js";

describe("POST /api/auth/login", () => {
    it("logs in with correct credentials and sets a cookie", async () => {
        const user = await createUser({ email: "employee@example.com" });

        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: user.email, password: DEFAULT_PASSWORD });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.user.email).toBe(user.email);
        expect(response.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    });

    it("rejects a wrong password with a generic message", async () => {
        const user = await createUser({ email: "employee2@example.com" });

        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: user.email, password: "WrongPassword1!" });

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toBe("Invalid email or password");
    });

    it("rejects an unknown email with the same generic message", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: "nobody@example.com", password: "WrongPassword1!" });

        expect(response.statusCode).toBe(401);
        expect(response.body.message).toBe("Invalid email or password");
    });

    it("rejects a non-active (invited) user", async () => {
        const user = await createUser({ email: "invited@example.com", status: "INVITED", password: null });

        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: user.email, password: DEFAULT_PASSWORD });

        expect(response.statusCode).toBe(401);
    });
});
