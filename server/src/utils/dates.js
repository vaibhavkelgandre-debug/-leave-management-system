// Pure "YYYY-MM-DD" date-key helpers shared by the working-day calculator and
// anything else that needs to walk a date range. Deliberately avoid
// `new Date(string)`/`toISOString()`, both of which go through UTC and would
// shift the date by a day for a server running anywhere east of Greenwich —
// mirrors client/src/utils/dates.js exactly (the two packages don't share
// code, so this is a deliberate small duplication rather than a dependency).

// Builds the "YYYY-MM-DD" key from local date parts.
// Input: a 4-digit year, a 0-based month index, and a day-of-month.
// Output: a zero-padded "YYYY-MM-DD" string. No failure mode — always succeeds.
export function toDateKey(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Adds (or subtracts) whole days to a "YYYY-MM-DD" key.
// Input: a "YYYY-MM-DD" string and an integer day offset (may be negative).
// Output: a new "YYYY-MM-DD" string, with month/year rollover handled by
// letting the Date constructor normalize an out-of-range day. No failure mode.
export function addDaysToDateKey(value, days) {
    const [year, month, day] = value.split("-").map(Number);
    const shifted = new Date(year, month - 1, day + days);
    return toDateKey(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

// Every "YYYY-MM-DD" key from start to end, inclusive.
// Input: two "YYYY-MM-DD" strings. Output: an array of date-key strings.
// Plain string comparison is safe here because the format is always
// zero-padded, so it sorts chronologically. If `end` is missing or before
// `start`, the range collapses to just `[start]` rather than throwing —
// callers that need to reject a backwards range validate that separately
// (see leaveRequestValidator.js), this helper just never returns garbage.
export function eachDateKeyInRange(start, end) {
    const last = end && end >= start ? end : start;
    const keys = [];

    for (let cursor = start; cursor <= last; cursor = addDaysToDateKey(cursor, 1)) {
        keys.push(cursor);
    }

    return keys;
}

// Today as a "YYYY-MM-DD" key, for comparing against stored date-only columns
// (e.g. "is this delegation active today", "has this leave already started").
export function todayDateKey() {
    const now = new Date();
    return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

// True if the given "YYYY-MM-DD" key falls on a Saturday or Sunday.
// Constructed from local date parts (not parsed as a UTC string) for the same
// reason as every other helper in this file.
export function isWeekend(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
}
