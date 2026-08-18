// Shared "YYYY-MM" pay-period formatting — pulled out of
// notificationService.js once payslipPdfService.js also needed the same
// "August 2026"-style label, so the two don't carry independent copies of
// the same month-name table.
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// Input: a "YYYY-MM" pay period. Output: a human-readable "August 2026".
// No failure mode — payPeriod is already validated to this shape wherever
// it's produced (salarySlipValidator.js).
export function formatPayPeriod(payPeriod) {
    const [year, month] = payPeriod.split("-").map(Number);
    return `${MONTH_NAMES[month - 1]} ${year}`;
}
