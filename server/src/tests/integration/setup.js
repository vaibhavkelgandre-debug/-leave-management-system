import dotenv from "dotenv";
import { beforeEach, afterAll } from "vitest";

dotenv.config({ path: ".env.test", override: true });

if (process.env.NODE_ENV !== "test" || !process.env.DB_NAME?.endsWith("_test")) {
    throw new Error(
        "Refusing to run integration tests: NODE_ENV must be 'test' and DB_NAME must end with '_test'. Check server/.env.test."
    );
}

const { default: pool } = await import("../../config/db.js");

beforeEach(async () => {
    await pool.query(
        "TRUNCATE users, invitations, oauth_accounts, password_resets, leave_balances, leave_types, holidays RESTART IDENTITY CASCADE"
    );
});

afterAll(async () => {
    await pool.end();
});
