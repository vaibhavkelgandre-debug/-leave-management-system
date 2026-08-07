// The API returns DATE columns as plain "YYYY-MM-DD" strings. These helpers
// deliberately avoid `new Date(string)` and `toISOString()`, both of which go
// through UTC and shift the date by a day for anyone east of Greenwich.

// Builds the "YYYY-MM-DD" key the API uses, from local date parts.
export function toDateKey(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Renders a "YYYY-MM-DD" string for display, e.g. "Tue, 26 Jan 2027".
export function formatDateKey(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// Adds (or subtracts) whole days to a "YYYY-MM-DD" key using local date
// parts, same UTC-avoidance as the rest of this file — letting the Date
// constructor normalize an out-of-range day handles month/year rollover.
export function addDaysToDateKey(value, days) {
    const [year, month, day] = value.split("-").map(Number);
    const shifted = new Date(year, month - 1, day + days);
    return toDateKey(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

// Renders a single-day date, or a "start – end" range when the holiday spans
// more than one day.
export function formatDateRange(start, end) {
    if (!end || start === end) return formatDateKey(start);
    return `${formatDateKey(start)} – ${formatDateKey(end)}`;
}

// Renders a full timestamp (e.g. audit log `created_at`) for display, e.g.
// "26 Jan 2027, 14:05". Unlike the DATE-only helpers above, this is a real
// instant with a time component, so `new Date(value)` is safe — there's no
// midnight-in-UTC ambiguity to guard against.
export function formatDateTime(value) {
    return new Date(value).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// Today as a "YYYY-MM-DD" key, for comparing against API date strings.
export function todayDateKey() {
    const now = new Date();
    return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

// Splits a "YYYY-MM-DD" key into the parts a compact date chip needs.
export function toDateParts(value) {
    const [year, month, day] = value.split("-").map(Number);
    return {
        year,
        month,
        day,
        monthShort: new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short" }),
    };
}

// Every "YYYY-MM-DD" key from start to end inclusive. Plain string comparison
// is safe here because the format is always zero-padded, so it sorts
// chronologically. An end before the start yields just the start day.
export function eachDateKeyInRange(start, end) {
    const last = end && end >= start ? end : start;
    const keys = [];

    for (let cursor = start; cursor <= last; cursor = addDaysToDateKey(cursor, 1)) {
        keys.push(cursor);
    }

    return keys;
}
