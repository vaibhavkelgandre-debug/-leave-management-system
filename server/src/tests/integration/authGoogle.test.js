import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUser } from "./helpers/factories.js";

let mockPayload;

vi.mock("google-auth-library", () => {
    return {
        OAuth2Client: vi.fn().mockImplementation(function OAuth2Client() {
            return {
                verifyIdToken: vi.fn().mockImplementation(() => {
                    if (!mockPayload) {
                        throw new Error("invalid token");
                    }
                    return { getPayload: () => mockPayload };
                }),
            };
        }),
    };
});

const { default: app } = await import("../../app.js");
const { default: pool } = await import("../../config/db.js");

beforeEach(() => {
    mockPayload = null;
});

describe("POST /api/auth/google", () => {
    it("logs in an existing active user and links their Google account", async () => {
        const user = await createUser({ email: "googleuser@example.com" });
        mockPayload = { sub: "google-sub-1", email: user.email, email_verified: true };

        const response = await request(app).post("/api/auth/google").send({ idToken: "fake-token" });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.user.email).toBe(user.email);

        const linked = await pool.query("SELECT * FROM oauth_accounts WHERE user_id = $1", [user.id]);
        expect(linked.rows.length).toBe(1);
    });

    it("rejects an email with no matching account", async () => {
        mockPayload = { sub: "google-sub-2", email: "unknown@example.com", email_verified: true };

        const response = await request(app).post("/api/auth/google").send({ idToken: "fake-token" });

        expect(response.statusCode).toBe(403);

        const linked = await pool.query("SELECT * FROM oauth_accounts");
        expect(linked.rows.length).toBe(0);
    });

    it("rejects an unverified email", async () => {
        const user = await createUser({ email: "unverified@example.com" });
        mockPayload = { sub: "google-sub-3", email: user.email, email_verified: false };

        const response = await request(app).post("/api/auth/google").send({ idToken: "fake-token" });

        expect(response.statusCode).toBe(401);
    });
});
