import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { TeamOverviewSummary } from "./TeamOverviewSummary.jsx";
import * as leaveRequestService from "../../services/leaveRequestService.js";
import * as userService from "../../services/userService.js";
import { todayDateKey } from "../../utils/dates.js";

vi.mock("../../services/leaveRequestService.js");
vi.mock("../../services/userService.js");

describe("TeamOverviewSummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userService.getMyTeam.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    });

    it("shows the team headcount", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText("2 people")).toBeInTheDocument();
    });

    it("offers a review link when requests are pending", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([
            { id: "r1", status: "SUBMITTED" },
            { id: "r2", status: "SUBMITTED" },
        ]);
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText("2 requests waiting for your decision.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /review/i })).toHaveAttribute("href", "/dashboard/approvals");
    });

    it("shows no review link when nothing is pending", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText("No requests waiting for a decision.")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /review/i })).not.toBeInTheDocument();
    });

    it("lists who is on approved leave today", async () => {
        const today = todayDateKey();
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([
            {
                id: "r1",
                status: "APPROVED",
                employee_first_name: "Asha",
                employee_last_name: "Employee",
                leave_type_name: "Sick Leave",
                start_date: today,
                end_date: today,
            },
            {
                id: "r2",
                status: "APPROVED",
                employee_first_name: "Rohit",
                employee_last_name: "Peer",
                leave_type_name: "Annual Leave",
                start_date: "2099-01-01",
                end_date: "2099-01-02",
            },
        ]);
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText(/asha employee — sick leave/i)).toBeInTheDocument();
        expect(screen.queryByText(/rohit peer/i)).not.toBeInTheDocument();
    });

    it("says nobody's out when no one is on approved leave today", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText(/nobody's out today/i)).toBeInTheDocument();
    });
});
