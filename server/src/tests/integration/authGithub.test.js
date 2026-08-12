import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUser } from "./helpers/factories.js";

let mockTokenOk;
let mockUser;
let mockEmails;

function jsonResponse(ok, body) {
    return { ok, json: async () => body };
}

vi.stubGlobal(
    "fetch",
    vi.fn((url) => {
        if (url === "https://github.com/login/oauth/access_token") {
            return Promise.resolve(
                mockTokenOk ? jsonResponse(true, { access_token: "fake-access-token" }) : jsonResponse(false, {})
            );
        }
        if (url === "https://api.github.com/user") {
            return Promise.resolve(jsonResponse(true, mockUser));
        }
        if (url === "https://api.github.com/user/emails") {
            return Promise.resolve(jsonResponse(true, mockEmails));
        }
        throw new Error(`Unexpected fetch call: ${url}`);
    })
);

const { default: app } = await import("../../app.js");
const { default: pool } = await import("../../config/db.js");

beforeEach(() => {
    mockTokenOk = true;
    mockUser = { id: 1 };
    mockEmails = [];
});

describe("POST /api/auth/github", () => {
    it("logs in an existing active user and links their GitHub account", async () => {
        const user = await createUser({ email: "githubuser@example.com" });
        mockUser = { id: 101 };
        mockEmails = [{ email: user.email, primary: true, verified: true }];

        const response = await request(app).post("/api/auth/github").send({ code: "fake-code" });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.user.email).toBe(user.email);

        const linked = await pool.query("SELECT * FROM oauth_accounts WHERE user_id = $1", [user.id]);
        expect(linked.rows.length).toBe(1);
        expect(linked.rows[0].provider).toBe("GITHUB");
    });

    it("rejects an email with no matching account", async () => {
        mockUser = { id: 102 };
        mockEmails = [{ email: "unknown@example.com", primary: true, verified: true }];

        const response = await request(app).post("/api/auth/github").send({ code: "fake-code" });

        expect(response.statusCode).toBe(403);

        const linked = await pool.query("SELECT * FROM oauth_accounts");
        expect(linked.rows.length).toBe(0);
    });

    it("rejects when there is no verified primary email", async () => {
        const user = await createUser({ email: "unverifiedgithub@example.com" });
        mockUser = { id: 103 };
        mockEmails = [{ email: user.email, primary: true, verified: false }];

        const response = await request(app).post("/api/auth/github").send({ code: "fake-code" });

        expect(response.statusCode).toBe(401);
    });

    it("rejects a failed code exchange", async () => {
        mockTokenOk = false;

        const response = await request(app).post("/api/auth/github").send({ code: "bad-code" });

        expect(response.statusCode).toBe(401);
    });
});
