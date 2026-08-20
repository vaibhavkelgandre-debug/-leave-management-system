import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { PayrollRunForm } from "./PayrollRunForm.jsx";
import * as salarySlipService from "../../services/salarySlipService.js";

vi.mock("../../services/salarySlipService.js");

const previewResponse = {
    summary: { total: 2, ok: 1, skipped: 1 },
    rows: [
        {
            employeeId: "u1",
            employeeName: "Asha Employee",
            status: "ok",
            skipReason: null,
            computed: { lopDays: 0, totalLeaveDays: 0, payableDays: 31, netPay: 45200 },
        },
        {
            employeeId: "u2",
            employeeName: "Rohit Peer",
            status: "skipped",
            skipReason: "No salary structure assigned",
            computed: null,
        },
    ],
};

async function calculate() {
    // fireEvent.change (not userEvent.type) for the month input — jsdom's
    // constraint validation doesn't reliably treat a keystroke-built value
    // as a valid month.
    fireEvent.change(screen.getByLabelText(/pay period/i), { target: { value: "2026-03" } });
    await userEvent.click(screen.getByRole("button", { name: /^calculate$/i }));
}

describe("PayrollRunForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calculates payroll for the chosen period and shows a status per employee", async () => {
        salarySlipService.calculatePayroll.mockResolvedValue(previewResponse);
        renderWithProviders(<PayrollRunForm onSaved={vi.fn()} />);

        await calculate();

        expect(salarySlipService.calculatePayroll).toHaveBeenCalledWith("2026-03", {
            role: undefined,
            profileStatus: undefined,
        });
        expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
        expect(screen.getByText("No salary structure assigned")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /approve and generate 1 payslip/i })).toBeInTheDocument();
    });

    // Three row states now, not two: an employee who already holds a payslip
    // for the period is a normal outcome of re-running it, badged distinctly
    // from a genuine problem (no structure, unverified profile, nothing
    // payable) so a finished month doesn't read as a broken run.
    it("badges an already-paid employee separately from a skipped one, and says so in the summary", async () => {
        salarySlipService.calculatePayroll.mockResolvedValue({
            summary: { total: 3, ok: 1, skipped: 1, alreadyGenerated: 1 },
            rows: [
                ...previewResponse.rows,
                {
                    employeeId: "u3",
                    employeeName: "Meera Paid",
                    status: "already_generated",
                    skipReason: "Already received a payslip for this period — void the existing slip first to re-run",
                    computed: null,
                },
            ],
        });
        renderWithProviders(<PayrollRunForm onSaved={vi.fn()} />);

        await calculate();

        expect(await screen.findByText("Already received")).toBeInTheDocument();
        // The row explains what to do about it; the summary line explains why
        // "1 of 3 payroll-ready" isn't a failure.
        expect(screen.getByText(/void the existing slip first/i)).toBeInTheDocument();
        expect(screen.getByText(/1 already received a payslip for this period\./i)).toBeInTheDocument();
        // Only the real problem row gets the amber "Skipped" badge.
        expect(screen.getAllByText("Skipped")).toHaveLength(1);
    });

    it("sends the chosen role and profile-status filters when calculating", async () => {
        salarySlipService.calculatePayroll.mockResolvedValue(previewResponse);
        renderWithProviders(<PayrollRunForm onSaved={vi.fn()} />);

        await userEvent.selectOptions(screen.getByLabelText(/^role$/i), "EMPLOYEE");
        await userEvent.selectOptions(screen.getByLabelText(/profile verification status/i), "VERIFIED");
        await calculate();

        expect(salarySlipService.calculatePayroll).toHaveBeenCalledWith("2026-03", {
            role: "EMPLOYEE",
            profileStatus: "VERIFIED",
        });
    });

    it("approves the period, reporting committed and skipped counts with a reason per skipped employee", async () => {
        salarySlipService.calculatePayroll.mockResolvedValue(previewResponse);
        salarySlipService.confirmPayroll.mockResolvedValue({
            committed: [{ id: "s1" }],
            skipped: [
                {
                    employeeId: "u2",
                    employeeName: "Rohit Peer",
                    skipReason: "Already generated for this period — void the existing slip first",
                },
            ],
        });
        const onSaved = vi.fn();
        renderWithProviders(<PayrollRunForm onSaved={onSaved} />);

        await calculate();
        await screen.findByText("Asha Employee");
        await userEvent.click(screen.getByRole("button", { name: /approve and generate 1 payslip/i }));

        expect(salarySlipService.confirmPayroll).toHaveBeenCalledWith("2026-03", {
            role: undefined,
            profileStatus: undefined,
        });
        expect(await screen.findByText(/generated 1 payslip/i)).toBeInTheDocument();
        expect(screen.getByText(/1 employee skipped/i)).toBeInTheDocument();
        expect(screen.getByText(/Rohit Peer: Already generated for this period/i)).toBeInTheDocument();
        expect(onSaved).toHaveBeenCalled();
    });

    it("surfaces an error message when calculation fails", async () => {
        salarySlipService.calculatePayroll.mockRejectedValue({
            response: { data: { message: "Only HR can calculate payroll" } },
        });
        renderWithProviders(<PayrollRunForm onSaved={vi.fn()} />);

        await calculate();

        expect(await screen.findByRole("alert")).toHaveTextContent("Only HR can calculate payroll");
    });
});
