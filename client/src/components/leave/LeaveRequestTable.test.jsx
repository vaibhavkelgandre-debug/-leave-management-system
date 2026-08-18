import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { LeaveRequestTable } from "./LeaveRequestTable.jsx";
import * as leaveRequestService from "../../services/leaveRequestService.js";
import * as leaveBalanceService from "../../services/leaveBalanceService.js";

vi.mock("../../services/leaveRequestService.js");
vi.mock("../../services/leaveBalanceService.js");

function makeRequest(overrides = {}) {
    return {
        id: "req-1",
        employee_first_name: "Asha",
        employee_last_name: "Employee",
        employee_role: "EMPLOYEE",
        leave_type_name: "Annual Leave",
        status: "SUBMITTED",
        start_date: "2099-01-06",
        end_date: "2099-01-08",
        working_days: "3.0",
        reason: "Trip",
        ...overrides,
    };
}

describe("LeaveRequestTable", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaveBalanceService.getUserBalances.mockResolvedValue([]);
        leaveRequestService.getLeaveRequestAuditTrail.mockResolvedValue([]);
    });

    it("renders one row per request with employee, role, dates, days and status", () => {
        renderWithProviders(<LeaveRequestTable requests={[makeRequest()]} />);

        expect(screen.getByRole("columnheader", { name: /employee/i })).toBeInTheDocument();
        expect(screen.getByText("Asha Employee")).toBeInTheDocument();
        expect(screen.getByText("Annual Leave")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
        expect(screen.getByText("SUBMITTED")).toBeInTheDocument();
    });

    it("shows no approve/reject/override actions, only Details", () => {
        renderWithProviders(<LeaveRequestTable requests={[makeRequest()]} />);

        expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^reject$/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^details$/i })).toBeInTheDocument();
    });

    it("opens the detail modal for the clicked row", async () => {
        renderWithProviders(<LeaveRequestTable requests={[makeRequest(), makeRequest({ id: "req-2", employee_first_name: "Rahul", employee_last_name: "Singh" })]} />);

        await userEvent.click(screen.getAllByRole("button", { name: /^details$/i })[1]);

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(leaveRequestService.getLeaveRequestAuditTrail).toHaveBeenCalledWith("req-2");
    });
});
