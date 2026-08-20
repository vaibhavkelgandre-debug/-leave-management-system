// The forgot-password flow, including its delivery step. mailService is
// mocked rather than the SMTP transport, matching how cloudinaryService is
// mocked elsewhere in this suite — the point is to exercise the real DB and
// the real rules without needing credentials or network access. Mocking the
// service (not config/mailer.js) also means these tests keep passing
// unchanged when the provider behind it is swapped out.
//
// Note the send is fire-and-forget in passwordResetService.js (deliberately
// — see the comment there about the timing oracle), so assertions on it have
// to go through vi.waitFor rather than assuming it resolved before the HTTP
// response did.
import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import app from "../../app.js";
import pool from "../../config/db.js";
import { createUser } from "./helpers/factories.js";
import { sendPasswordResetEmail } from "../../services/mailService.js";

// The whole module is replaced, so every sender it exports has to be listed
// — an omitted one is `undefined` at its import site and only blows up if
// some other flow in this file happens to send mail. Listing all three keeps
// that from becoming a puzzle later.
vi.mock("../../services/mailService.js", () => ({
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
    sendEmployeeInviteEmail: vi.fn().mockResolvedValue(true),
    sendSalarySlipEmail: vi.fn().mockResolvedValue(true),
}));

function extractToken(link) {
    return link.split("/reset-password/")[1];
}

// The raw token only ever leaves the service inside the emailed link, so the
// mock is the one place a test can recover it — exactly the route a real
// recipient takes.
async function tokenFromEmail() {
    await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalled());
    const [args] = sendPasswordResetEmail.mock.calls.at(-1);
    return extractToken(args.resetLink);
}

async function resetRowFor(email) {
    const result = await pool.query(
        `SELECT pr.id, pr.token_hash, pr.used_at
         FROM password_resets pr
         JOIN users u ON u.id = pr.user_id
         WHERE u.email = $1`,
        [email]
    );
    return result.rows;
}

describe("Password reset flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sendPasswordResetEmail.mockResolvedValue(undefined);
    });

    it("returns the same generic response whether or not the email exists", async () => {
        await createUser({ email: "reset-user@example.com" });

        const existing = await request(app)
            .post("/api/auth/password-reset/request")
            .send({ email: "reset-user@example.com" });
        const unknown = await request(app)
            .post("/api/auth/password-reset/request")
            .send({ email: "no-such-user@example.com" });

        expect(existing.statusCode).toBe(200);
        expect(unknown.statusCode).toBe(200);
        expect(existing.body.message).toBe(unknown.body.message);
    });

    it("emails a reset link only for an existing active user", async () => {
        await createUser({ email: "has-reset-row@example.com" });

        await request(app).post("/api/auth/password-reset/request").send({ email: "has-reset-row@example.com" });
        await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1));
        expect(sendPasswordResetEmail.mock.calls[0][0]).toMatchObject({ to: "has-reset-row@example.com" });
        expect(await resetRowFor("has-reset-row@example.com")).toHaveLength(1);

        await request(app).post("/api/auth/password-reset/request").send({ email: "no-such-user@example.com" });
        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it("resets the password end to end and the token is single-use", async () => {
        const user = await createUser({ email: "reset-flow@example.com" });

        await request(app).post("/api/auth/password-reset/request").send({ email: user.email });
        const token = await tokenFromEmail();

        const confirmResponse = await request(app)
            .post("/api/auth/password-reset/confirm")
            .send({ token, password: "BrandNewPassword1!" });
        expect(confirmResponse.statusCode).toBe(200);

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({ email: user.email, password: "BrandNewPassword1!" });
        expect(loginResponse.statusCode).toBe(200);

        const reuseResponse = await request(app)
            .post("/api/auth/password-reset/confirm")
            .send({ token, password: "AnotherPassword1!" });
        expect(reuseResponse.statusCode).toBe(401);
    });

    it("rejects an invalid token", async () => {
        const response = await request(app)
            .post("/api/auth/password-reset/confirm")
            .send({ token: "not-a-real-token", password: "SomePassword1!" });

        expect(response.statusCode).toBe(401);
    });

    describe("resend cooldown", () => {
        it("ignores a repeat request inside the cooldown, leaving the issued token untouched", async () => {
            const user = await createUser({ email: "reset-throttle@example.com" });

            await request(app).post("/api/auth/password-reset/request").send({ email: user.email });
            await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1));
            const [issued] = await resetRowFor(user.email);

            const second = await request(app).post("/api/auth/password-reset/request").send({ email: user.email });

            // Same generic response — a throttled caller must not be able to
            // tell they were throttled, or it leaks that the account exists.
            expect(second.statusCode).toBe(200);
            expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

            // Asserting the hash is unchanged, not just the row count: the
            // upsert would replace the token in place without adding a row.
            const rows = await resetRowFor(user.email);
            expect(rows).toHaveLength(1);
            expect(rows[0].token_hash).toBe(issued.token_hash);
        });

        it("leaves the first link working after a throttled repeat request", async () => {
            const user = await createUser({ email: "reset-throttle-keeps@example.com" });

            await request(app).post("/api/auth/password-reset/request").send({ email: user.email });
            const token = await tokenFromEmail();

            // Under the old check-then-invalidate-then-insert flow this second
            // call would have killed the token the user already has.
            await request(app).post("/api/auth/password-reset/request").send({ email: user.email });

            const confirmResponse = await request(app)
                .post("/api/auth/password-reset/confirm")
                .send({ token, password: "StillWorks1!" });
            expect(confirmResponse.statusCode).toBe(200);
        });

        it("never answers 409 for concurrent requests — that would leak that the account exists", async () => {
            const user = await createUser({ email: "reset-concurrent@example.com" });

            // Both requests race the same partial unique index
            // (uq_password_resets_active_user). Before issuePasswordReset was
            // made a single ON CONFLICT statement, the loser raised 23505,
            // which errorHandler.js turns into a 409 — a clean signal that the
            // address is registered, since an unknown one always gets 200.
            const responses = await Promise.all([
                request(app).post("/api/auth/password-reset/request").send({ email: user.email }),
                request(app).post("/api/auth/password-reset/request").send({ email: user.email }),
            ]);

            for (const response of responses) {
                expect(response.statusCode).toBe(200);
            }
            expect(await resetRowFor(user.email)).toHaveLength(1);
        });
    });

    // Exercised at the repository level with cooldownSeconds: 0 because the
    // service's real cooldown is 15 minutes — the ON CONFLICT DO UPDATE
    // branch (reissuing once the window has passed, replacing a still-live
    // token in place) is otherwise unreachable from an HTTP test, and a
    // regression there would only surface in production.
    it("reissues in place once the cooldown has passed, killing the previous token", async () => {
        const { issuePasswordReset } = await import("../../repositories/passwordResetRepository.js");
        const user = await createUser({ email: "reset-reissue@example.com" });
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const first = await issuePasswordReset({
            userId: user.id,
            tokenHash: "hash-one",
            expiresAt,
            cooldownSeconds: 0,
        });
        const second = await issuePasswordReset({
            userId: user.id,
            tokenHash: "hash-two",
            expiresAt,
            cooldownSeconds: 0,
        });

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();

        // Same row, new token — the partial unique index still holds, and the
        // first token's hash is gone so its link no longer resolves.
        const rows = await resetRowFor(user.email);
        expect(rows).toHaveLength(1);
        expect(rows[0].token_hash).toBe("hash-two");
        expect(rows[0].used_at).toBeNull();
    });

    describe("delivery failures stay invisible to the caller", () => {
        it("returns the same response as an unknown email when the send fails", async () => {
            const user = await createUser({ email: "reset-mail-fails@example.com" });
            sendPasswordResetEmail.mockRejectedValue(new Error("SMTP connection refused"));

            const failed = await request(app).post("/api/auth/password-reset/request").send({ email: user.email });
            const unknown = await request(app)
                .post("/api/auth/password-reset/request")
                .send({ email: "no-such-user@example.com" });

            // A 500 here for a real account (while an unknown one still got a
            // 200) would turn any mail outage into an account-enumeration
            // oracle — see the comment in passwordResetService.js.
            expect(failed.statusCode).toBe(200);
            expect(failed.statusCode).toBe(unknown.statusCode);
            expect(failed.body.message).toBe(unknown.body.message);

            // The rejection must be consumed by the service's own .catch,
            // not surface as an unhandled rejection.
            await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1));
        });
    });
});
