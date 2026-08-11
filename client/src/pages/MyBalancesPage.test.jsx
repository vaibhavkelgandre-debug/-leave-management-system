import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../tests/renderWithProviders.jsx";
import { MyBalancesPage } from "./MyBalancesPage.jsx";
import * as leaveBalanceService from "../services/leaveBalanceService.js";
import * as leaveRequestService from "../services/leaveRequestService.js";
import * as holidayService from "../services/holidayService.js";
import { todayDateKey } from "../utils/dates.js";

vi.mock("../services/leaveBalanceService.js");
vi.mock("../services/leaveRequestService.js");
vi.mock("../services/holidayService.js");

// Dated "today" so it's always inside the calendar's initially-visible
// month — a fixed far-future/past date would render in a month the
// calendar isn't showing until someone navigates there first.
function makeRequest(overrides = {}) {
    return {
        id: "req-1",
        leave_type_name: "Annual Leave",
        status: "APPROVED",
        start_date: todayDateKey(),
        end_date: todayDateKey(),
        working_days: "1.0",
        reason: "Trip",
        decision_comment: null,
        ...overrides,
    };
}

describe("MyBalancesPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([]);
        holidayService.getHolidays.mockResolvedValue([]);
    });

    it("renders the personal calendar alongside the request list once everything loads", async () => {
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([makeRequest()]);
        renderWithProviders(<MyBalancesPage />);

        expect(await screen.findByText("My requests")).toBeInTheDocument();
        // FullCalendar's own toolbar title (the current month/year) proves the
        // calendar actually mounted, not just the surrounding page shell.
        expect(document.querySelector(".fc-toolbar-title")).toBeInTheDocument();
    });

    it("clicking a leave request's dot on the calendar highlights its row in the list", async () => {
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([makeRequest({ id: "req-1" })]);
        renderWithProviders(<MyBalancesPage />);
        await screen.findByText("My requests");

        const dot = await screen.findByTitle(/annual leave/i);
        await userEvent.click(dot);

        // Scoped to "My requests" — the FullCalendar event itself also
        // contains an (intentionally CSS-hidden) "Annual Leave" title node,
        // which a plain screen.getByText would also match.
        const requestsSection = screen.getByText("My requests").closest("section");
        const row = within(requestsSection).getByText("Annual Leave").closest("li");
        expect(row).toHaveClass("ring-indigo-300");
    });

    it("fetches holidays for the year the calendar is currently showing", async () => {
        renderWithProviders(<MyBalancesPage />);
        await screen.findByText("My requests");

        expect(holidayService.getHolidays).toHaveBeenCalledWith({ year: new Date().getFullYear() });
    });
});
