import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { SalarySlipsPage } from "./SalarySlipsPage.jsx";
import * as salarySlipService from "../services/salarySlipService.js";
import * as userService from "../services/userService.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/salarySlipService.js");
vi.mock("../services/userService.js");

const employeeAuthValue = makeAuthValue({ user: { id: "emp-1", first_name: "Asha", role: ROLES.EMPLOYEE } });
const hrAuthValue = makeAuthValue({ user: { id: "hr-1", first_name: "Priya", role: ROLES.HR_ADMIN } });

const slip = {
    id: "s1",
    pay_period: "2026-03",
    basic_pay: "30000",
    hra: "12000",
    pf_employee_contribution: "1800",
    pf_employer_contribution: "1800",
    esic: "0",
    special_allowance: "5000",
    lop_days: "0",
    lop_deduction: "0",
    income_tax: "0",
    net_pay: "45200",
    status: "ACTIVE",
};

async function goToTeamTab() {
    await userEvent.click(await screen.findByRole("tab", { name: /your team's slips/i }));
}

describe("SalarySlipsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        salarySlipService.getMySalarySlips.mockResolvedValue([]);
        // The team list is paginated: `{ slips, total }`, with limit/offset
        // sent alongside the filters.
        salarySlipService.getSalarySlipsForHr.mockResolvedValue({ slips: [], total: 0 });
        salarySlipService.getSalarySlipPdfUrl.mockReturnValue("http://localhost/api/salary-slips/s1/pdf");
        userService.getUserOptions.mockResolvedValue([]);
    });

    it("shows an employee their own slips without any payroll controls or tabs", async () => {
        salarySlipService.getMySalarySlips.mockResolvedValue([slip]);
        renderWithProviders(<SalarySlipsPage />, { authValue: employeeAuthValue });

        expect(await screen.findByText("2026-03")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /run payroll/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
        expect(salarySlipService.getSalarySlipsForHr).not.toHaveBeenCalled();
    });

    it("gives HR a payroll action, and their team's slips on a separate tab from their own", async () => {
        salarySlipService.getSalarySlipsForHr.mockResolvedValue({ slips: [slip], total: 1 });
        renderWithProviders(<SalarySlipsPage />, { authValue: hrAuthValue });

        expect(await screen.findByRole("link", { name: /run payroll/i })).toBeInTheDocument();
        // "Your slips" is the default tab — the team's data isn't shown yet.
        expect(screen.queryByText("2026-03")).not.toBeInTheDocument();

        await goToTeamTab();
        expect(await screen.findByText("2026-03")).toBeInTheDocument();
    });

    it("links Run payroll to its own dedicated page, not an inline form", async () => {
        renderWithProviders(<SalarySlipsPage />, { authValue: hrAuthValue });
        await screen.findByRole("tab", { name: /your team's slips/i });

        const link = screen.getByRole("link", { name: /run payroll/i });
        expect(link).toHaveAttribute("href", "/dashboard/payroll-run");
        expect(screen.queryByRole("button", { name: /^calculate$/i })).not.toBeInTheDocument();
    });

    it("lets HR void a team member's slip, refreshing the list afterward", async () => {
        salarySlipService.getSalarySlipsForHr
            .mockResolvedValueOnce({ slips: [slip], total: 1 })
            .mockResolvedValueOnce({ slips: [{ ...slip, status: "VOIDED" }], total: 1 });
        salarySlipService.voidSalarySlip.mockResolvedValue({ ...slip, status: "VOIDED" });
        renderWithProviders(<SalarySlipsPage />, { authValue: hrAuthValue });

        await goToTeamTab();
        await screen.findByText("2026-03");
        await userEvent.click(screen.getByRole("button", { name: /^void$/i }));
        await userEvent.click(screen.getByRole("button", { name: /confirm void/i }));

        expect(salarySlipService.voidSalarySlip).toHaveBeenCalledWith("s1", undefined);
        expect(await screen.findByText("VOIDED")).toBeInTheDocument();
    });

    it("pages the team list and resets to page 1 when a filter changes", async () => {
        const rows = Array.from({ length: 25 }, (_, index) => ({ ...slip, id: `s${index}` }));
        salarySlipService.getSalarySlipsForHr.mockResolvedValue({ slips: rows, total: 60 });
        renderWithProviders(<SalarySlipsPage />, { authValue: hrAuthValue });

        await goToTeamTab();
        expect(await screen.findByText(/showing 1–25 of 60/i)).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /^next$/i }));
        expect(salarySlipService.getSalarySlipsForHr).toHaveBeenLastCalledWith(
            expect.objectContaining({ limit: 25, offset: 25 })
        );

        // A narrower filter can have fewer rows than the current offset, which
        // would render an empty table that reads as "no slips".
        await userEvent.selectOptions(screen.getByLabelText(/^role$/i), ROLES.MANAGER);
        expect(salarySlipService.getSalarySlipsForHr).toHaveBeenLastCalledWith(
            expect.objectContaining({ role: ROLES.MANAGER, offset: 0 })
        );
    });

    it("hides the team pager when everything fits on one page", async () => {
        salarySlipService.getSalarySlipsForHr.mockResolvedValue({ slips: [slip], total: 1 });
        renderWithProviders(<SalarySlipsPage />, { authValue: hrAuthValue });

        await goToTeamTab();
        await screen.findByText("2026-03");
        expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument();
    });

    it("filters by pay period, sending it to the currently active tab's fetch", async () => {
        renderWithProviders(<SalarySlipsPage />, { authValue: hrAuthValue });
        await screen.findByRole("tab", { name: /your slips/i });

        // fireEvent.change (not userEvent.type) for the month input — jsdom's
        // constraint validation doesn't reliably treat a keystroke-built value
        // as a valid month.
        fireEvent.change(screen.getByLabelText(/pay period/i), { target: { value: "2026-04" } });

        await waitFor(() =>
            expect(salarySlipService.getMySalarySlips).toHaveBeenLastCalledWith({ payPeriod: "2026-04" })
        );
    });

    it("shows role and employee filters only on the team tab, narrowing the employee list by the picked role", async () => {
        userService.getUserOptions.mockResolvedValue([
            { id: "mgr-1", first_name: "Manoj", last_name: "Kumar", role: ROLES.MANAGER },
            { id: "emp-1", first_name: "Zara", last_name: "Employee", role: ROLES.EMPLOYEE },
        ]);
        renderWithProviders(<SalarySlipsPage />, { authValue: hrAuthValue });
        await screen.findByRole("tab", { name: /your slips/i });

        expect(screen.queryByLabelText(/^role$/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^employee$/i)).not.toBeInTheDocument();

        await goToTeamTab();
        expect(screen.getByLabelText(/^role$/i)).toBeInTheDocument();
        const employeeSelect = screen.getByLabelText(/^employee$/i);
        expect(employeeSelect).toBeInTheDocument();

        await userEvent.selectOptions(screen.getByLabelText(/^role$/i), ROLES.MANAGER);
        expect(screen.getByRole("option", { name: /manoj/i })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: /zara/i })).not.toBeInTheDocument();

        expect(salarySlipService.getSalarySlipsForHr).toHaveBeenLastCalledWith({
            payPeriod: undefined,
            employeeId: undefined,
            role: ROLES.MANAGER,
            limit: 25,
            offset: 0,
        });
    });
});
