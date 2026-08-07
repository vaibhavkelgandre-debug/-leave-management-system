import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { MyLeaveSummary } from "./MyLeaveSummary.jsx";
import * as leaveBalanceService from "../../services/leaveBalanceService.js";
import * as leaveRequestService from "../../services/leaveRequestService.js";

vi.mock("../../services/leaveBalanceService.js");
vi.mock("../../services/leaveRequestService.js");

describe("MyLeaveSummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows each leave type's remaining days", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([
            { id: "b1", leave_type_name: "Annual Leave", days_remaining: "8.0" },
        ]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([]);

        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText("Annual Leave")).toBeInTheDocument();
        expect(screen.getByText("8")).toBeInTheDocument();
    });

    it("counts pending requests", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            { id: "r1", status: "SUBMITTED" },
            { id: "r2", status: "SUBMITTED" },
            { id: "r3", status: "APPROVED", start_date: "2000-01-01", end_date: "2000-01-01" },
        ]);

        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText("2 requests waiting on a decision.")).toBeInTheDocument();
    });

    it("shows the soonest future approved leave", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            {
                id: "future",
                status: "APPROVED",
                leave_type_name: "Annual Leave",
                start_date: "2099-06-10",
                end_date: "2099-06-11",
            },
            {
                id: "further",
                status: "APPROVED",
                leave_type_name: "Sick Leave",
                start_date: "2099-08-01",
                end_date: "2099-08-01",
            },
        ]);

        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText(/next leave: annual leave/i)).toBeInTheDocument();
        expect(screen.queryByText(/next leave: sick leave/i)).not.toBeInTheDocument();
    });

    it("shows the manager's comment on the most recent decision", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            {
                id: "r1",
                status: "REJECTED",
                leave_type_name: "Annual Leave",
                start_date: "2020-01-06",
                end_date: "2020-01-06",
                decided_at: "2020-01-05T00:00:00.000Z",
                decision_comment: "Team is short-staffed that week",
            },
        ]);

        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText(/team is short-staffed that week/i)).toBeInTheDocument();
    });
});
