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
