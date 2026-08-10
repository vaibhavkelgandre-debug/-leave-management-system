import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { ApprovalsPage } from "./ApprovalsPage.jsx";
import * as leaveRequestService from "../services/leaveRequestService.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/leaveRequestService.js");

function makeRequest(overrides = {}) {
    return {
        id: "req-1",
        employee_first_name: "Asha",
        employee_last_name: "Employee",
        employee_role: "EMPLOYEE",
        leave_type_name: "Annual Leave",
        status: "SUBMITTED",
        start_date: "2099-01-06",
        end_date: "2099-01-06",
        working_days: "1.0",
        reason: "Trip",
        ...overrides,
    };
}

describe("ApprovalsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows no tabs for a MANAGER, and fetches only the team-scoped list", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([makeRequest()]);
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "mgr-1", role: ROLES.MANAGER } }),
        });

        expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
        expect(leaveRequestService.getAllLeaveRequests).not.toHaveBeenCalled();
    });

    it("defaults HR to the My Team tab, actionable", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([makeRequest()]);
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "hr-1", role: ROLES.HR_ADMIN } }),
        });

        expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
        expect(leaveRequestService.getTeamLeaveRequests).toHaveBeenCalled();
        expect(leaveRequestService.getAllLeaveRequests).not.toHaveBeenCalled();
        expect(screen.getByRole("tab", { name: /my team/i })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    });

    it("switches to the company-wide, read-only All Requests tab when clicked", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([makeRequest({ id: "team-req" })]);
        leaveRequestService.getAllLeaveRequests.mockResolvedValue([makeRequest({ id: "all-req" })]);
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "hr-1", role: ROLES.HR_ADMIN } }),
        });
        await screen.findByText("Asha Employee");

        await userEvent.click(screen.getByRole("tab", { name: /all requests/i }));

        expect(await screen.findByRole("tab", { name: /all requests/i })).toHaveAttribute("aria-selected", "true");
        expect(leaveRequestService.getAllLeaveRequests).toHaveBeenCalled();
        // Read-only: no action buttons for a SUBMITTED request on this tab,
        // even though the same status would show Approve/Reject on My Team.
        expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^reject$/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^details$/i })).toBeInTheDocument();
    });

    it("switching back to My Team re-fetches the scoped list and restores actions", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([makeRequest()]);
        leaveRequestService.getAllLeaveRequests.mockResolvedValue([makeRequest()]);
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "hr-1", role: ROLES.HR_ADMIN } }),
        });
        await screen.findByText("Asha Employee");

        await userEvent.click(screen.getByRole("tab", { name: /all requests/i }));
        await screen.findByRole("button", { name: /^details$/i });
        expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("tab", { name: /my team/i }));

        expect(await screen.findByRole("button", { name: /^approve$/i })).toBeInTheDocument();
        expect(leaveRequestService.getTeamLeaveRequests).toHaveBeenCalledTimes(2);
    });
});
