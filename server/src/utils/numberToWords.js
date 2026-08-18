// Converts a rupee amount to words using the Indian numbering system
// (thousand / lakh / crore, not the western thousand / million / billion
// grouping) — for the payslip PDF's "Amount In Words" line. No library for
// this exists in the app's dependencies; the algorithm is small enough that
// pulling one in wasn't worth it (see rules.md's note on the doc-viewer
// library that *was* worth reconsidering, for the contrast).
const ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

// 0-99.
function twoDigitsToWords(value) {
    if (value < 20) return ONES[value];
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return TENS[tens] + (ones ? ` ${ONES[ones]}` : "");
}

// 0-999 — used directly for the hundreds group, and reused for the crore
// group since crore values can themselves run into the hundreds (e.g. "123
// Crore") even though every group below it is capped at two digits under
// the Indian numbering system.
function threeDigitsToWords(value) {
    const hundreds = Math.floor(value / 100);
    const rest = value % 100;
    const hundredsWords = hundreds ? `${ONES[hundreds]} Hundred` : "";
    const restWords = rest ? twoDigitsToWords(rest) : "";
    return [hundredsWords, restWords].filter(Boolean).join(" ");
}

// Input: a rupee amount (numeric or numeric string, as every salary_slips
// figure arrives from Postgres — see db.js's NUMERIC handling). Output: e.g.
// "Indian Rupee Seventy-Seven Thousand Only" for 77000. Rounds to the
// nearest rupee first — a payslip's net pay is already rounded to 2 decimal
// places at calculation time (salarySlipService.js's round2), so this only
// ever drops paise, never meaningfully changes the figure.
export function numberToWordsIndian(amount) {
    const rounded = Math.round(Number(amount));
    if (rounded === 0) return "Indian Rupee Zero Only";

    const crore = Math.floor(rounded / 10000000);
    const lakh = Math.floor((rounded % 10000000) / 100000);
    const thousand = Math.floor((rounded % 100000) / 1000);
    const hundred = rounded % 1000;

    const groups = [
        crore ? `${threeDigitsToWords(crore)} Crore` : "",
        lakh ? `${twoDigitsToWords(lakh)} Lakh` : "",
        thousand ? `${twoDigitsToWords(thousand)} Thousand` : "",
        hundred ? threeDigitsToWords(hundred) : "",
    ].filter(Boolean);

    return `Indian Rupee ${groups.join(" ")} Only`;
}
