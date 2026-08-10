import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { MyLeaveSummary } from "./MyLeaveSummary.jsx";
import * as leaveBalanceService from "../../services/leaveBalanceService.js";
import * as leaveRequestService from "../../services/leaveRequestService.js";
import { todayDateKey, addDaysToDateKey } from "../../utils/dates.js";

vi.mock("../../services/leaveBalanceService.js");
vi.mock("../../services/leaveRequestService.js");

describe("MyLeaveSummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows each balance's remaining days as a chip", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([
            { id: "b1", leave_type_name: "Casual Leave", days_remaining: "8" },
        ]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText("Casual Leave")).toBeInTheDocument();
        expect(screen.getByText("8")).toBeInTheDocument();
    });

    it("counts pending requests", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            { id: "r1", status: "SUBMITTED" },
            { id: "r2", status: "SUBMITTED" },
        ]);
        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText("2 requests waiting on a decision.")).toBeInTheDocument();
    });

    it("shows the soonest upcoming approved leave", async () => {
        const today = todayDateKey();
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            {
                id: "r1",
                status: "APPROVED",
                leave_type_name: "Annual Leave",
                start_date: addDaysToDateKey(today, 5),
                end_date: addDaysToDateKey(today, 6),
            },
        ]);
        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText(/next leave: annual leave/i)).toBeInTheDocument();
    });

    it("shows the most recent decision on one of the user's requests", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            {
                id: "r1",
                status: "REJECTED",
                leave_type_name: "Sick Leave",
                start_date: "2030-01-01",
                end_date: "2030-01-01",
                decided_at: "2030-01-02T00:00:00Z",
                decision_comment: "Too many out that week",
            },
        ]);
        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText(/too many out that week/i)).toBeInTheDocument();
    });
});
