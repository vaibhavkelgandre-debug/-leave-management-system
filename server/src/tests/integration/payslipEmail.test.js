// The delivery half of a payroll run: confirming a period emails each
// employee their own payslip as a PDF attachment. The calculation itself, the
// scoping rules and the download endpoint are covered by salarySlips.test.js
// — this file only asserts what leaves the building.
//
// mailService is mocked (not the SMTP transport), same reasoning as
// passwordReset.test.js and inviteEmail.test.js. The PDF is *not* mocked: the
// point of asserting on it here is that a real rendered attachment reaches the
// sender, which is exactly what a stub would hide.
//
// The send is fire-and-forget in salarySlipService.confirmPayroll (a payroll
// run of 200 employees can't hold HR's request open for the whole batch), so
// every assertion goes through vi.waitFor rather than assuming it finished
// before the HTTP response did — the same shape passwordReset.test.js uses.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRootHr, createUser, verifyEmployeeProfile, createSalaryStructure } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";
import { sendSalarySlipEmail } from "../../services/mailService.js";

vi.mock("../../services/mailService.js", () => ({
    sendSalarySlipEmail: vi.fn().mockResolvedValue(true),
    sendEmployeeInviteEmail: vi.fn().mockResolvedValue(true),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

// A period that has already fully ended (see assertPeriodCompleted) —
// relative to now rather than hardcoded, same helper as salarySlips.test.js.
function monthsAgo(offset) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

beforeEach(() => {
    vi.clearAllMocks();
    sendSalarySlipEmail.mockResolvedValue(true);
});

async function payrollReadyEmployee(hr, email) {
    const employee = await createUser({ email, firstName: "Asha", managerId: hr.id });
    await verifyEmployeeProfile(employee.id, hr.id);
    await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
    return employee;
}

describe("Payslip email delivery", () => {
    it("emails each employee their own payslip PDF after a confirmed run", async () => {
        const hr = await createRootHr({ email: "payslip-mail-hr@example.com" });
        await payrollReadyEmployee(hr, "payslip-mail-emp@example.com");
        const agent = await loginAs(hr);
        const payPeriod = monthsAgo(2);

        const response = await agent.post("/api/salary-slips/confirm").send({ payPeriod });
        expect(response.statusCode).toBe(200);
        expect(response.body.data.committed).toHaveLength(1);

        await vi.waitFor(() => expect(sendSalarySlipEmail).toHaveBeenCalledTimes(1));
        const [args] = sendSalarySlipEmail.mock.calls.at(-1);

        expect(args.to).toBe("payslip-mail-emp@example.com");
        expect(args.firstName).toBe("Asha");
        // "August 2026", not "2026-08" — the raw period never reaches a
        // recipient.
        expect(args.payPeriodLabel).toMatch(/^[A-Z][a-z]+ \d{4}$/);
        expect(Number(args.netPay)).toBeGreaterThan(0);
        expect(args.pdf.filename).toBe(`payslip-${payPeriod}.pdf`);
        // A real render, not a stub: %PDF- is the file signature, and a
        // truncated/failed render wouldn't carry it.
        expect(Buffer.isBuffer(args.pdf.content)).toBe(true);
        expect(args.pdf.content.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("sends one email per committed slip and none for a skipped employee", async () => {
        const hr = await createRootHr({ email: "payslip-mail-multi-hr@example.com" });
        await payrollReadyEmployee(hr, "payslip-mail-a@example.com");
        await payrollReadyEmployee(hr, "payslip-mail-b@example.com");
        // Verified but with no salary structure — skipped by the run, so
        // there's no slip to email.
        const skipped = await createUser({ email: "payslip-mail-skip@example.com", managerId: hr.id });
        await verifyEmployeeProfile(skipped.id, hr.id);
        const agent = await loginAs(hr);

        const response = await agent.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(3) });

        expect(response.body.data.committed).toHaveLength(2);
        expect(response.body.data.skipped).toHaveLength(1);
        await vi.waitFor(() => expect(sendSalarySlipEmail).toHaveBeenCalledTimes(2));
        const recipients = sendSalarySlipEmail.mock.calls.map(([args]) => args.to);
        expect(recipients).toEqual(
            expect.arrayContaining(["payslip-mail-a@example.com", "payslip-mail-b@example.com"])
        );
        expect(recipients).not.toContain("payslip-mail-skip@example.com");
    });

    // Payroll is committed before any email goes out, so a bad mailbox must
    // cost that one employee their email and nothing else — not the run, not
    // the other employees' emails, and not HR's already-sent response.
    it("keeps going when one employee's email fails", async () => {
        const hr = await createRootHr({ email: "payslip-mail-fail-hr@example.com" });
        await payrollReadyEmployee(hr, "payslip-mail-fail-a@example.com");
        await payrollReadyEmployee(hr, "payslip-mail-fail-b@example.com");
        const agent = await loginAs(hr);
        sendSalarySlipEmail.mockRejectedValueOnce(new Error("mailbox full"));

        const response = await agent.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(4) });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.committed).toHaveLength(2);
        await vi.waitFor(() => expect(sendSalarySlipEmail).toHaveBeenCalledTimes(2));
    });

    it("emails nothing when the run commits nothing", async () => {
        const hr = await createRootHr({ email: "payslip-mail-empty-hr@example.com" });
        const noStructure = await createUser({ email: "payslip-mail-empty-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(noStructure.id, hr.id);
        const agent = await loginAs(hr);

        const response = await agent.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(5) });

        expect(response.body.data.committed).toHaveLength(0);
        expect(sendSalarySlipEmail).not.toHaveBeenCalled();
    });
});
