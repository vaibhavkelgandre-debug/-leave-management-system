// Minimal CSV formatting — no library needed for the one report (FR-024)
// that uses this. RFC 4180-style quoting: a field is wrapped in double
// quotes (and any double quote inside it doubled) only if it actually
// contains a comma, quote, or newline, so plain values stay readable
// unquoted in the output.
function csvField(value) {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

// Input: `columns` as `[{ key, header }]` (order controls column order) and
// `rows` as plain objects keyed by `column.key`. Output: a complete CSV
// string, header row included, CRLF line endings per RFC 4180.
export function toCsv(columns, rows) {
    const headerLine = columns.map((column) => csvField(column.header)).join(",");
    const dataLines = rows.map((row) => columns.map((column) => csvField(row[column.key])).join(","));
    return [headerLine, ...dataLines].join("\r\n");
}
