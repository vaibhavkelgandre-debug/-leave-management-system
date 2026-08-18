// Renders a payslip PDF on demand from a salary_slips row — never persisted
// as a file, generated fresh on every authorized request/download, same
// "generate fresh, never store" philosophy as cloudinaryService's signed
// URLs. Uses pdfkit (pure JS, no headless-browser binary) for a small,
// fixed single-page layout — no template engine needed for this shape.
//
// Redesigned to match a reference payslip layout the user provided (an
// employee-summary block + a highlighted net-pay box, a PAN/Aadhar
// identifiers row, a two-column earnings/deductions table with running
// totals, a total-net-payable band, and an amount-in-words line) — with a
// few things the reference showed deliberately left out, since nothing in
// this app's data model backs them and adding that data was out of scope
// for this pass (confirmed with the user):
//   - No company name/logo/address — this app has no concept of "the
//     employer's own identity" anywhere, only employee data.
//   - No PF A/C Number or UAN — only PF *contribution amounts* exist, never
//     an account/UAN number. The user asked to show PAN Number and Aadhar
//     Number in that row instead, since those already exist on `users`.
//   - No Professional Tax line, and no year-to-date (YTD) columns — neither
//     has a source in the data model, and adding either was declined in
//     favor of keeping this a presentation-only change (no schema/query work).
//   - No distinct "Pay Date" — only `pay_period` ("YYYY-MM") exists, no
//     separate disbursement-date field.
// Currency is rendered as "Rs." rather than "₹": pdfkit's built-in Helvetica
// (a PDF standard-14 font, WinAnsi-encoded) has no glyph for the Indian
// Rupee sign — rendering it would need a bundled TTF font, out of scope for
// a presentation tweak.
import PDFDocument from "pdfkit";
import { formatPayPeriod } from "../utils/payPeriod.js";
import { numberToWordsIndian } from "../utils/numberToWords.js";

const PAGE_MARGIN = 50;
const COLUMN_GAP = 20;
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#cbd5e1";
const ACCENT_BG = "#f0fdf4";
const ACCENT_BORDER = "#86efac";
const ACCENT_TEXT = "#15803d";

function formatMoney(value) {
    return `Rs. ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "YYYY-MM-DD" -> "DD/MM/YYYY", matching the reference layout's date style.
// Returns "—" for a field the employee never filled in (joining_date is
// self-editable and optional at the database level).
function formatDateDDMMYYYY(value) {
    if (!value) return "—";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

// Days in the calendar month a "YYYY-MM" pay period falls in — used only to
// derive "Paid Days" (days in month minus LOP days) for display; the actual
// LOP deduction math already happened in salarySlipService.js and isn't
// recomputed here.
function daysInPayPeriod(payPeriod) {
    const [year, month] = payPeriod.split("-").map(Number);
    return new Date(year, month, 0).getDate();
}

// One "Label    Value" pair at an explicit position — every multi-column
// section below tracks its own `y` manually rather than relying on
// pdfkit's auto-flowing cursor, since that cursor is inherently
// single-column and these sections aren't.
function keyValue(doc, x, y, label, value, { labelWidth = 105, valueWidth = 140, bold = false } = {}) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, x, y, { width: labelWidth, lineBreak: false });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .fillColor(INK)
        .text(String(value ?? "—"), x + labelWidth, y, { width: valueWidth, lineBreak: false });
}

// One "Label ......... Amount" row within an earnings/deductions column —
// `topBorder` draws the divider above a running total (Gross Earnings /
// Total Deductions), matching the reference layout's ruled-off total rows.
function amountRow(doc, x, y, width, label, amount, { bold = false, topBorder = false } = {}) {
    if (topBorder) {
        doc.moveTo(x, y - 4)
            .lineTo(x + width, y - 4)
            .lineWidth(0.5)
            .strokeColor(BORDER)
            .stroke();
    }
    const font = bold ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(9).fillColor(INK).text(label, x, y, { width: width * 0.55, lineBreak: false });
    doc.font(font)
        .fontSize(9)
        .fillColor(INK)
        .text(formatMoney(amount), x, y, { width, align: "right", lineBreak: false });
}

// Input: a salary_slips row joined with the employee's name/email and (as of
// this redesign) designation/employee_code/joining_date/pan_number/
// aadhar_number (salarySlipRepository.js's SLIP_COLUMNS). Output: a Node
// Readable stream of the rendered PDF bytes.
export function renderPayslipPdf(slip) {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
    const contentWidth = doc.page.width - PAGE_MARGIN * 2;
    const columnWidth = (contentWidth - COLUMN_GAP) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + columnWidth + COLUMN_GAP;

    const basicPay = Number(slip.basic_pay);
    const hra = Number(slip.hra);
    const specialAllowance = Number(slip.special_allowance);
    const grossEarnings = basicPay + hra + specialAllowance;

    const pfEmployeeContribution = Number(slip.pf_employee_contribution);
    const esic = Number(slip.esic);
    const incomeTax = Number(slip.income_tax);
    const lopDeduction = Number(slip.lop_deduction);
    const totalDeductions = pfEmployeeContribution + esic + incomeTax + lopDeduction;

    const paidDays = daysInPayPeriod(slip.pay_period) - Number(slip.lop_days);

    // --- Title -----------------------------------------------------------
    doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text("PAYSLIP", { align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`For the Month of ${formatPayPeriod(slip.pay_period)}`, {
        align: "center",
    });
    doc.moveDown(1.5);

    // --- Employee summary (left) + net pay box (right) --------------------
    const summaryTop = doc.y;
    const rowHeight = 16;
    let y = summaryTop;
    keyValue(doc, leftX, y, "Employee Name", `${slip.employee_first_name} ${slip.employee_last_name}`);
    y += rowHeight;
    keyValue(doc, leftX, y, "Designation", slip.employee_designation);
    y += rowHeight;
    keyValue(doc, leftX, y, "Employee ID", slip.employee_code);
    y += rowHeight;
    keyValue(doc, leftX, y, "Date of Joining", formatDateDDMMYYYY(slip.employee_joining_date));
    y += rowHeight;
    keyValue(doc, leftX, y, "Pay Period", formatPayPeriod(slip.pay_period));
    const summaryBottom = y + rowHeight;

    const boxHeight = 76;
    doc.roundedRect(rightX, summaryTop - 6, columnWidth, boxHeight, 4)
        .fillColor(ACCENT_BG)
        .fill()
        .roundedRect(rightX, summaryTop - 6, columnWidth, boxHeight, 4)
        .strokeColor(ACCENT_BORDER)
        .lineWidth(1)
        .stroke();
    doc.font("Helvetica-Bold").fontSize(16).fillColor(ACCENT_TEXT).text(formatMoney(slip.net_pay), rightX + 12, summaryTop + 4, {
        width: columnWidth - 24,
    });
    doc.font("Helvetica").fontSize(8).fillColor(ACCENT_TEXT).text("Employee Net Pay", rightX + 12, summaryTop + 26, {
        width: columnWidth - 24,
    });
    keyValue(doc, rightX + 12, summaryTop + 44, "Paid Days", paidDays, { labelWidth: 70, valueWidth: 60 });
    keyValue(doc, rightX + 12, summaryTop + 60, "LOP Days", slip.lop_days, { labelWidth: 70, valueWidth: 60 });

    doc.y = Math.max(summaryBottom, summaryTop - 6 + boxHeight);
    doc.x = PAGE_MARGIN;
    doc.moveDown(1);

    // --- PAN / Aadhar identifiers row -------------------------------------
    // Stands in for the reference layout's "PF A/C Number" / "UAN" row —
    // neither of those exists in this app's data model, but PAN and Aadhar
    // already do (users.pan_number/aadhar_number), so those print instead.
    const idY = doc.y;
    keyValue(doc, leftX, idY, "PAN Number", slip.employee_pan_number, { labelWidth: 90 });
    keyValue(doc, rightX, idY, "Aadhar Number", slip.employee_aadhar_number, { labelWidth: 90 });
    doc.y = idY + rowHeight;
    doc.moveDown(0.75);

    doc.moveTo(leftX, doc.y).lineTo(leftX + contentWidth, doc.y).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.moveDown(0.75);

    // --- Earnings / Deductions table ---------------------------------------
    const tableTop = doc.y;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("EARNINGS", leftX, tableTop);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("DEDUCTIONS", rightX, tableTop);
    let rowY = tableTop + 16;

    amountRow(doc, leftX, rowY, columnWidth, "Basic", basicPay);
    amountRow(doc, rightX, rowY, columnWidth, "EPF Contribution", pfEmployeeContribution);
    rowY += rowHeight;

    amountRow(doc, leftX, rowY, columnWidth, "House Rent Allowance", hra);
    amountRow(doc, rightX, rowY, columnWidth, "ESIC", esic);
    rowY += rowHeight;

    amountRow(doc, leftX, rowY, columnWidth, "Special Allowance", specialAllowance);
    amountRow(doc, rightX, rowY, columnWidth, "Income Tax", incomeTax);
    rowY += rowHeight;

    // Loss of pay always prints, even at zero days, so an employee can see
    // it was considered and not just silently omitted some months.
    amountRow(
        doc,
        rightX,
        rowY,
        columnWidth,
        `Loss of Pay (${slip.lop_days} day${Number(slip.lop_days) === 1 ? "" : "s"})`,
        lopDeduction
    );
    rowY += rowHeight + 4;

    amountRow(doc, leftX, rowY, columnWidth, "Gross Earnings", grossEarnings, { bold: true, topBorder: true });
    amountRow(doc, rightX, rowY, columnWidth, "Total Deductions", totalDeductions, { bold: true, topBorder: true });

    doc.y = rowY + rowHeight;
    doc.x = PAGE_MARGIN;
    doc.moveDown(1);

    // --- Total net payable band ---------------------------------------------
    const bandTop = doc.y;
    const bandHeight = 40;
    doc.rect(leftX, bandTop, contentWidth, bandHeight).fillColor("#f8fafc").fill();
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("TOTAL NET PAYABLE", leftX + 12, bandTop + 8, {
        width: columnWidth,
    });
    doc.font("Helvetica").fontSize(7).fillColor(MUTED).text("Gross Earnings - Total Deductions", leftX + 12, bandTop + 24, {
        width: columnWidth,
    });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(formatMoney(slip.net_pay), leftX, bandTop + 12, {
        width: contentWidth - 12,
        align: "right",
    });
    doc.y = bandTop + bandHeight;
    doc.x = PAGE_MARGIN;
    doc.moveDown(1);

    // --- Amount in words + footer -------------------------------------------
    doc.font("Helvetica").fontSize(9).fillColor(INK).text(`Amount In Words: ${numberToWordsIndian(slip.net_pay)}`);
    doc.moveDown(1.5);
    doc.font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(
            `PF (employer contribution) of ${formatMoney(slip.pf_employer_contribution)} is a company cost and is not deducted from net pay. This document has been generated automatically and does not require a signature.`
        );

    doc.end();
    return doc;
}
