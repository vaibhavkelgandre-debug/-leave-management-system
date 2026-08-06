import { describe, it, expect } from "vitest";
import { toDateKey, formatDateKey } from "./dates.js";

describe("toDateKey", () => {
    it("zero-pads month and day", () => {
        expect(toDateKey(2027, 0, 1)).toBe("2027-01-01");
        expect(toDateKey(2027, 11, 25)).toBe("2027-12-25");
    });

    it("does not shift the date across a timezone boundary", () => {
        // A UTC-based conversion would render this as 2026-12-31 anywhere east
        // of Greenwich — the exact bug this helper exists to avoid.
        expect(toDateKey(2027, 0, 1)).toBe("2027-01-01");
    });
});

describe("formatDateKey", () => {
    it("renders the same calendar day it was given", () => {
        // Locale formatting varies by environment, so assert on the parts that
        // matter: the day number and year must not drift.
        const formatted = formatDateKey("2027-01-01");
        expect(formatted).toContain("1");
        expect(formatted).toContain("2027");
        expect(formatted).not.toContain("2026");
    });
});
