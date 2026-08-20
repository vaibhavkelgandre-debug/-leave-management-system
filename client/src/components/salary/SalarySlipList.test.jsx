import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { SalarySlipList } from "./SalarySlipList.jsx";
import * as salarySlipService from "../../services/salarySlipService.js";

vi.mock("../../services/salarySlipService.js", async () => {
    const actual = await vi.importActual("../../services/salarySlipService.js");
    return {
        ...actual,
        getSalarySlipPdfUrl: vi.fn((id) => `http://localhost/api/salary-slips/${id}/pdf`),
        voidSalarySlip: vi.fn(),
    };
});

const slip = {
    id: "s1",
    pay_period: "2026-03",
    employee_first_name: "Asha",
    employee_last_name: "Employee",
    basic_pay: "30000",
    hra: "12000",
    pf_employee_contribution: "1800",
    esic: "0",
    special_allowance: "5000",
    lop_days: "0",
    lop_deduction: "0",
    total_leave_days: "0",
    payable_days: "31",
    income_tax: "0",
    net_pay: "45200",
    status: "ACTIVE",
};

describe("SalarySlipList", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a message when there are no slips", () => {
        renderWithProviders(<SalarySlipList slips={[]} />);
        expect(screen.getByText("No salary slips yet.")).toBeInTheDocument();
    });

    it("links View to the full-page in-app viewer, alongside the existing Download link", () => {
        renderWithProviders(<SalarySlipList slips={[slip]} />);

        // Download is untouched — still a real link with `download`, forcing
        // a save via the default `attachment` disposition.
        const downloadLink = screen.getByRole("link", { name: /download payslip/i });
        expect(downloadLink).toHaveAttribute("href", "http://localhost/api/salary-slips/s1/pdf");
        expect(downloadLink).toHaveAttribute("download");

        // View links to DocumentViewerPage.jsx (a full page, not a modal —
        // see rules.md), which itself asks for the `inline`-disposition
        // variant so the PDF renders instead of downloading.
        expect(screen.getByRole("link", { name: /view payslip/i })).toHaveAttribute(
            "href",
            "/dashboard/documents/preview?salarySlipId=s1&payPeriod=2026-03"
        );
    });

    it("doesn't show a Void control unless canVoid is set", () => {
        renderWithProviders(<SalarySlipList slips={[slip]} />);
        expect(screen.queryByRole("button", { name: /^void$/i })).not.toBeInTheDocument();
    });

    it("shows a VOIDED badge and hides the Void control for an already-voided slip", () => {
        renderWithProviders(<SalarySlipList slips={[{ ...slip, status: "VOIDED", void_reason: "Wrong month" }]} canVoid />);

        expect(screen.getByText("VOIDED")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^void$/i })).not.toBeInTheDocument();
    });

    it("voids a slip with an optional reason and notifies the caller", async () => {
        salarySlipService.voidSalarySlip.mockResolvedValue({ ...slip, status: "VOIDED" });
        const onVoided = vi.fn();
        renderWithProviders(<SalarySlipList slips={[slip]} canVoid onVoided={onVoided} />);

        await userEvent.click(screen.getByRole("button", { name: /^void$/i }));
        await userEvent.type(screen.getByPlaceholderText(/reason for voiding/i), "Wrong month");
        await userEvent.click(screen.getByRole("button", { name: /confirm void/i }));

        expect(salarySlipService.voidSalarySlip).toHaveBeenCalledWith("s1", "Wrong month");
        expect(onVoided).toHaveBeenCalled();
    });

    it("lets HR cancel out of the void prompt without calling the service", async () => {
        renderWithProviders(<SalarySlipList slips={[slip]} canVoid />);

        await userEvent.click(screen.getByRole("button", { name: /^void$/i }));
        await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

        expect(screen.queryByPlaceholderText(/reason for voiding/i)).not.toBeInTheDocument();
        expect(salarySlipService.voidSalarySlip).not.toHaveBeenCalled();
    });

    it("surfaces an error message if voiding fails", async () => {
        salarySlipService.voidSalarySlip.mockRejectedValue({
            response: { data: { message: "Only HR can void a salary slip" } },
        });
        renderWithProviders(<SalarySlipList slips={[slip]} canVoid />);

        await userEvent.click(screen.getByRole("button", { name: /^void$/i }));
        await userEvent.click(screen.getByRole("button", { name: /confirm void/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Only HR can void a salary slip");
    });
});
