import { describe, it, expect } from "vitest";
import { toDateKey, formatDateKey, addDaysToDateKey, formatDateRange, eachDateKeyInRange, formatDateTime } from "./dates.js";

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

describe("addDaysToDateKey", () => {
    it("adds days within the same month", () => {
        expect(addDaysToDateKey("2027-10-16", 1)).toBe("2027-10-17");
    });

    it("rolls over into the next month and year", () => {
        expect(addDaysToDateKey("2027-12-31", 1)).toBe("2028-01-01");
    });
});

describe("formatDateRange", () => {
    it("renders a single date when start and end are the same", () => {
        expect(formatDateRange("2027-01-01", "2027-01-01")).toBe(formatDateKey("2027-01-01"));
    });

    it("renders a single date when end is omitted", () => {
        expect(formatDateRange("2027-01-01")).toBe(formatDateKey("2027-01-01"));
    });

    it("renders a start – end range for a multi-day holiday", () => {
        expect(formatDateRange("2027-10-16", "2027-10-20")).toBe(
            `${formatDateKey("2027-10-16")} – ${formatDateKey("2027-10-20")}`
        );
    });
});

describe("eachDateKeyInRange", () => {
    it("returns every day of a multi-day range inclusive of both ends", () => {
        expect(eachDateKeyInRange("2027-10-16", "2027-10-20")).toEqual([
            "2027-10-16",
            "2027-10-17",
            "2027-10-18",
            "2027-10-19",
            "2027-10-20",
        ]);
    });

    it("returns just the start day for a single-day or missing-end range", () => {
        expect(eachDateKeyInRange("2027-10-16", "2027-10-16")).toEqual(["2027-10-16"]);
        expect(eachDateKeyInRange("2027-10-16")).toEqual(["2027-10-16"]);
    });

    it("spans a month boundary", () => {
        expect(eachDateKeyInRange("2027-10-30", "2027-11-02")).toEqual([
            "2027-10-30",
            "2027-10-31",
            "2027-11-01",
            "2027-11-02",
        ]);
    });
});

describe("formatDateTime", () => {
    it("includes both the date and the time", () => {
        const result = formatDateTime("2027-01-26T14:05:00Z");
        expect(result).toMatch(/2027/);
        expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
});
