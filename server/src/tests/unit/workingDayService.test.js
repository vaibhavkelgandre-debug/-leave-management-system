// Unit tests for the working-day calculator — pure function, no database,
// covering Deliverable #3's "working-day calculation across weekends, public
// holidays and half days" requirement directly and in isolation.
import { describe, it, expect } from "vitest";
import { calculateWorkingDays } from "../../services/workingDayService.js";

describe("calculateWorkingDays", () => {
    it("counts a plain Mon-Fri week as 5 working days", () => {
        // 2027-01-04 is a Monday.
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-08" })).toBe(5);
    });

    it("excludes weekends from a range that spans them", () => {
        // 2027-01-04 (Mon) through 2027-01-10 (Sun) = 5 weekdays + a weekend.
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-10" })).toBe(5);
    });

    it("returns 0 for a range that is entirely a weekend", () => {
        // 2027-01-09/10 is a Saturday/Sunday.
        expect(calculateWorkingDays({ startDate: "2027-01-09", endDate: "2027-01-10" })).toBe(0);
    });

    it("excludes a single-day public holiday inside the range", () => {
        const holidays = [{ start_date: "2027-01-06", end_date: "2027-01-06" }];
        // Mon-Fri minus the Wednesday holiday = 4.
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-08", holidays })).toBe(4);
    });

    it("excludes every day of a multi-day holiday range", () => {
        // A 5-day Diwali-style holiday fully inside a 10-weekday window.
        const holidays = [{ start_date: "2027-01-06", end_date: "2027-01-08" }];
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-08", holidays })).toBe(2);
    });

    it("does not double-exclude a holiday that falls on a weekend", () => {
        // 2027-01-09 is a Saturday; a holiday landing on it shouldn't
        // subtract twice, since it's already excluded as a weekend.
        const holidays = [{ start_date: "2027-01-09", end_date: "2027-01-09" }];
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-10" })).toBe(5);
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-10", holidays })).toBe(5);
    });

    it("subtracts half a day for a half-day start", () => {
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-08", startHalfDay: true })).toBe(4.5);
    });

    it("subtracts half a day for a half-day end", () => {
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-08", endHalfDay: true })).toBe(4.5);
    });

    it("subtracts a full day when both ends of a multi-day request are half days", () => {
        expect(
            calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-08", startHalfDay: true, endHalfDay: true })
        ).toBe(4);
    });

    it("treats a single-day half-day request as 0.5 days", () => {
        expect(calculateWorkingDays({ startDate: "2027-01-04", endDate: "2027-01-04", startHalfDay: true })).toBe(0.5);
    });

    it("ignores a half-day flag on a boundary date that isn't a working day", () => {
        // Starting on the Saturday itself — the half-day flag has nothing to
        // halve since that date was never counted as a working day.
        const result = calculateWorkingDays({
            startDate: "2027-01-09",
            endDate: "2027-01-11",
            startHalfDay: true,
        });
        // Only the Monday (01-11) counts; the half-day flag on Saturday is a no-op.
        expect(result).toBe(1);
    });
});
