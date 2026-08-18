import { describe, it, expect } from "vitest";
import { normalizeUser } from "./authService.js";

describe("normalizeUser", () => {
    it("returns null for a null/undefined raw user", () => {
        expect(normalizeUser(null)).toBeNull();
        expect(normalizeUser(undefined)).toBeNull();
    });

    it("passes every field through, not just a fixed allowlist", () => {
        const raw = {
            id: "u1",
            first_name: "Asha",
            last_name: "Employee",
            email: "asha@example.com",
            role: "EMPLOYEE",
            manager_id: "m1",
            status: "ACTIVE",
            profile_status: "SUBMITTED",
            phone: "9876543210",
            current_address: "1 Example Street",
            pan_number: "ABCDE1234F",
        };

        expect(normalizeUser(raw)).toEqual(raw);
    });

    it("normalizes a nested role object down to its role_name string", () => {
        expect(normalizeUser({ id: "u1", role: { role_name: "MANAGER" } }).role).toBe("MANAGER");
    });

    it("keeps a plain string role as-is", () => {
        expect(normalizeUser({ id: "u1", role: "HR_ADMIN" }).role).toBe("HR_ADMIN");
    });
});
