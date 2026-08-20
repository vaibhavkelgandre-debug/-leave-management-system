import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { MyLeaveSummary } from "./MyLeaveSummary.jsx";
import * as leaveBalanceService from "../../services/leaveBalanceService.js";
import * as leaveRequestService from "../../services/leaveRequestService.js";
import { todayDateKey, addDaysToDateKey } from "../../utils/dates.js";

vi.mock("../../services/leaveBalanceService.js");
vi.mock("../../services/leaveRequestService.js");

// `leave_type_id` matters to every assertion about colour or filtering — the
// accent map and the type picker are both keyed on it, never on the name
// (which is user-editable). Fixtures carry the fields a real row always has.
function balance(overrides = {}) {
    return {
        id: "b1",
        leave_type_id: "lt-1",
        leave_type_name: "Casual Leave",
        entitlement: "12",
        days_taken: "2",
        days_pending: "0",
        days_remaining: "8",
        ...overrides,
    };
}

function request(overrides = {}) {
    return {
        id: "r1",
        leave_type_id: "lt-1",
        leave_type_name: "Casual Leave",
        status: "APPROVED",
        start_date: "2030-01-10",
        end_date: "2030-01-11",
        working_days: "2.0",
        decided_at: "2030-01-05T00:00:00Z",
        decision_comment: null,
        ...overrides,
    };
}

describe("MyLeaveSummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows each balance's remaining days as a chip", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([balance()]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<MyLeaveSummary />);

        // "Casual Leave" is now on the page twice — the chip and the type
        // picker's own option — so this asserts the chip specifically.
        const chip = await screen.findByRole("button", { name: /casual leave/i });
        expect(within(chip).getByText("8")).toBeInTheDocument();
    });

    it("gives each balance chip a different accent color so leave types don't blend together", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([
            balance(),
            balance({ id: "b2", leave_type_id: "lt-2", leave_type_name: "Sick Leave", days_remaining: "10" }),
        ]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<MyLeaveSummary />);

        const casualChip = await screen.findByRole("button", { name: /casual leave/i });
        const sickChip = screen.getByRole("button", { name: /sick leave/i });

        expect(casualChip.className).not.toBe(sickChip.className);
    });

    it("counts pending requests", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            request({ id: "r1", status: "SUBMITTED" }),
            request({ id: "r2", status: "SUBMITTED" }),
        ]);
        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText("2")).toBeInTheDocument();
        expect(screen.getByText(/waiting on a decision/i)).toBeInTheDocument();
    });

    it("shows the soonest upcoming approved leave", async () => {
        const today = todayDateKey();
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            request({
                leave_type_name: "Annual Leave",
                start_date: addDaysToDateKey(today, 5),
                end_date: addDaysToDateKey(today, 6),
            }),
        ]);
        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText(/next leave/i)).toBeInTheDocument();
        expect(screen.getAllByText(/annual leave/i).length).toBeGreaterThan(0);
    });

    it("shows the most recent decision on one of the user's requests", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            request({ status: "REJECTED", leave_type_name: "Sick Leave", decision_comment: "Too many out that week" }),
        ]);
        renderWithProviders(<MyLeaveSummary />);

        expect(await screen.findByText(/too many out that week/i)).toBeInTheDocument();
    });

    // The point of the dropdown: five leave types no longer fit as a row of
    // chips, and picking one should say more than "days left" — it should show
    // that type's own history.
    it("filters the history to the chosen leave type, with that type's balance", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([
            balance(),
            balance({ id: "b2", leave_type_id: "lt-2", leave_type_name: "Sick Leave", days_remaining: "10" }),
        ]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([
            request({ id: "r1", start_date: "2030-01-10", end_date: "2030-01-11" }),
            request({
                id: "r2",
                leave_type_id: "lt-2",
                leave_type_name: "Sick Leave",
                status: "REJECTED",
                start_date: "2030-02-01",
                end_date: "2030-02-01",
                working_days: "1.0",
                decision_comment: "No cover available",
            }),
        ]);
        renderWithProviders(<MyLeaveSummary />);

        // Default "All leave types": both requests, each labelled with its type.
        await screen.findByText("Previous requests");
        expect(screen.getByText("No cover available", { exact: false })).toBeInTheDocument();
        expect(screen.getAllByText("Casual Leave").length).toBeGreaterThan(0);

        await userEvent.selectOptions(screen.getByLabelText("Leave type"), "lt-2");

        // Now scoped to Sick Leave: its balance detail, its heading, its rows.
        expect(screen.getByText("Previous Sick Leave")).toBeInTheDocument();
        expect(screen.getByText(/days left of sick leave/i)).toBeInTheDocument();
        expect(screen.getByText("No cover available", { exact: false })).toBeInTheDocument();
        // The Casual Leave request is filtered out (its only remaining mention
        // is the picker's own option).
        const history = screen.getByText("Previous Sick Leave").closest("div");
        expect(within(history).queryByText("Casual Leave")).not.toBeInTheDocument();
    });

    it("lets a balance chip pick its own type", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([
            balance(),
            balance({ id: "b2", leave_type_id: "lt-2", leave_type_name: "Sick Leave", days_remaining: "10" }),
        ]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<MyLeaveSummary />);

        await userEvent.click(await screen.findByRole("button", { name: /sick leave/i }));

        expect(screen.getByText(/days left of sick leave/i)).toBeInTheDocument();
        expect(screen.getByLabelText("Leave type")).toHaveValue("lt-2");
    });

    it("says so when the chosen type has no history yet", async () => {
        leaveBalanceService.getMyBalances.mockResolvedValue([balance()]);
        leaveRequestService.getMyLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<MyLeaveSummary />);

        await userEvent.selectOptions(await screen.findByLabelText("Leave type"), "lt-1");

        expect(screen.getByText(/haven't requested casual leave yet/i)).toBeInTheDocument();
    });
});
