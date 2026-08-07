// Module 3 (FR-013): computes how many working days a leave request actually
// consumes, excluding weekends and public holidays and accounting for
// half-day flags. Pure and DB-free — the caller fetches the relevant holidays
// once and passes them in — so this is unit-testable on its own and reusable
// by both the `/preview` endpoint and the real submit flow, guaranteeing the
// number an employee previews is exactly the number that gets charged.
import { eachDateKeyInRange, isWeekend } from "../utils/dates.js";

// Input: `startDate`/`endDate` ("YYYY-MM-DD"), `startHalfDay`/`endHalfDay`
// (booleans), and `holidays` (an array of `{ start_date, end_date }` rows,
// e.g. straight from holidayRepository — any holiday that fully or partially
// overlaps the request range should be included by the caller).
// Output: a number (in 0.5 increments), which may be 0 or negative if the
// entire range falls on weekends/holidays — the caller decides whether that's
// an error (submission requires > 0; a preview can just show 0).
export function calculateWorkingDays({ startDate, endDate, startHalfDay = false, endHalfDay = false, holidays = [] }) {
    // Expand every holiday range into individual dates once, up front, so
    // checking "is this date a holiday" below is a single Set lookup instead
    // of a per-day loop over every holiday's range.
    const holidayDates = new Set(holidays.flatMap((holiday) => eachDateKeyInRange(holiday.start_date, holiday.end_date)));

    const datesInRange = eachDateKeyInRange(startDate, endDate);
    const workingDates = datesInRange.filter((date) => !isWeekend(date) && !holidayDates.has(date));

    let workingDays = workingDates.length;

    // A half-day flag only has an effect if that boundary date is itself a
    // working day — a half-day flag on a date that's already excluded
    // (weekend/holiday) has nothing to halve. On a single-day request the
    // caller shouldn't set both flags at once (leaveRequestValidator.js
    // rejects that combination) since it would zero the request out; this
    // function applies each flag independently regardless, rather than
    // silently guessing which one the caller meant.
    if (startHalfDay && workingDates.includes(startDate)) {
        workingDays -= 0.5;
    }
    if (endHalfDay && workingDates.includes(endDate)) {
        workingDays -= 0.5;
    }

    return workingDays;
}
