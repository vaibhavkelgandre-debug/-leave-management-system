import { describe, it, expect } from "vitest";
import { isValidEmail, validateLoginForm } from "./validation.js";

describe("isValidEmail", () => {
    it("accepts well-formed emails", () => {
        expect(isValidEmail("a@b.com")).toBe(true);
        expect(isValidEmail("first.last@example.co.uk")).toBe(true);
    });

    it("rejects malformed emails", () => {
        expect(isValidEmail("not-an-email")).toBe(false);
        expect(isValidEmail("missing@domain")).toBe(false);
        expect(isValidEmail("@nodomain.com")).toBe(false);
        expect(isValidEmail("")).toBe(false);
    });
});

describe("validateLoginForm", () => {
    it("returns errors for empty fields", () => {
        const errors = validateLoginForm({ email: "", password: "" });
        expect(errors.email).toBeTruthy();
        expect(errors.password).toBeTruthy();
    });

    it("flags an invalid email format", () => {
        const errors = validateLoginForm({ email: "nope", password: "something" });
        expect(errors.email).toBeTruthy();
        expect(errors.password).toBeUndefined();
    });

    it("returns no errors for valid input", () => {
        const errors = validateLoginForm({ email: "a@b.com", password: "secret" });
        expect(Object.keys(errors)).toHaveLength(0);
    });
});
