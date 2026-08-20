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

function makeBalance(overrides = {}) {
    return {
        id: 1,
        leave_type_name: "Leave Type",
        entitlement: "10",
        days_taken: "0",
        days_pending: "0",
        days_remaining: "10",
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

        // Found by accessible name, not `title` — the calendar's hover label
        // is the app's own tooltip now, so `aria-label` is what identifies an
        // event (see HolidayCalendar.test.jsx's hover case).
        const dot = await screen.findByLabelText(/annual leave/i);
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

    it("opens the calendar on the focused request's year when arriving via ApplyLeavePage's router state", async () => {
        renderWithProviders(<MyBalancesPage />, {
            initialEntries: [{ pathname: "/", state: { focusDate: "2031-03-15" } }],
        });
        await screen.findByText("My requests");

        expect(holidayService.getHolidays).toHaveBeenCalledWith({ year: 2031 });
    });

    it("shows only 6 balance cards by default, revealing the rest via the toggle", async () => {
        const balances = Array.from({ length: 8 }, (_, index) =>
            makeBalance({ id: index + 1, leave_type_name: `Leave Type ${index + 1}` })
        );
        leaveBalanceService.getMyBalances.mockResolvedValue(balances);
        renderWithProviders(<MyBalancesPage />);

        expect(await screen.findByText("Leave Type 6")).toBeInTheDocument();
        expect(screen.queryByText("Leave Type 7")).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Show all 8 leave types" }));

        expect(screen.getByText("Leave Type 7")).toBeInTheDocument();
        expect(screen.getByText("Leave Type 8")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Show less" }));

        expect(screen.queryByText("Leave Type 7")).not.toBeInTheDocument();
    });
});
