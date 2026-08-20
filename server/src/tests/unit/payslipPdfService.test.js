// Unit tests for the payslip PDF renderer — a pure function of a slip row
// (no database), collecting its rendered stream to confirm it actually
// produces well-formed PDF bytes rather than throwing partway through
// (easy to get subtly wrong with pdfkit's manual x/y-positioned two-column
// layout — see payslipPdfService.js's own header comment). The real HTTP
// round trip (Content-Type/Content-Disposition, both dispositions) is
// covered by salarySlips.test.js; this only checks the renderer in isolation.
import { describe, it, expect } from "vitest";
import { renderPayslipPdf } from "../../services/payslipPdfService.js";

function collectStream(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}

const baseSlip = {
    pay_period: "2027-05",
    employee_first_name: "Asha",
    employee_last_name: "Employee",
    employee_email: "asha@example.com",
    employee_designation: "Software Engineer",
    employee_code: "EMP-001",
    employee_joining_date: "2020-06-30",
    employee_pan_number: "ABCDE1234F",
    employee_aadhar_number: "123456789012",
    basic_pay: "30000.00",
    hra: "12000.00",
    special_allowance: "5000.00",
    pf_employee_contribution: "1800.00",
    pf_employer_contribution: "1800.00",
    esic: "0.00",
    income_tax: "0.00",
    lop_days: "0.0",
    lop_deduction: "0.00",
    total_leave_days: "0.0",
    payable_days: "31.0",
    net_pay: "45200.00",
};

describe("renderPayslipPdf", () => {
    it("renders a well-formed PDF for a complete slip", async () => {
        const buffer = await collectStream(renderPayslipPdf(baseSlip));
        expect(buffer.length).toBeGreaterThan(0);
        expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });

    it("still renders when optional profile fields were never filled in", async () => {
        const slip = {
            ...baseSlip,
            employee_designation: null,
            employee_code: null,
            employee_joining_date: null,
            employee_pan_number: null,
            employee_aadhar_number: null,
        };
        const buffer = await collectStream(renderPayslipPdf(slip));
        expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });

    it("still renders when the employee took loss-of-pay days", async () => {
        const slip = {
            ...baseSlip,
            lop_days: "1.5",
            lop_deduction: "2250.00",
            total_leave_days: "1.5",
            payable_days: "29.5",
            net_pay: "42950.00",
        };
        const buffer = await collectStream(renderPayslipPdf(slip));
        expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });

    it("still renders when the employee joined partway through the period (fewer payable days than the month)", async () => {
        const slip = {
            ...baseSlip,
            employee_joining_date: "2027-05-16",
            total_leave_days: "0.0",
            payable_days: "16.0",
        };
        const buffer = await collectStream(renderPayslipPdf(slip));
        expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });
});
