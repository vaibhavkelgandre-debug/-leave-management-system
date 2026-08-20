import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { ApprovalsPage } from "./ApprovalsPage.jsx";
import * as leaveRequestService from "../services/leaveRequestService.js";
import * as holidayService from "../services/holidayService.js";
import { ROLES } from "../constants/roles.js";
import { todayDateKey } from "../utils/dates.js";

vi.mock("../services/leaveRequestService.js");
vi.mock("../services/holidayService.js");

// `employee_manager_id: "hr-1"` matches the HR_ADMIN viewer id used by every
// HR-viewing test below, so HR is genuinely the assigned manager here (the
// still-supported carve-out — see leaveRequestAuthz.js) and these tests stay
// about tab/fetch/action-visibility wiring rather than the direct-manager
// gating itself, which has its own dedicated tests in RequestActions.test.jsx.
function makeRequest(overrides = {}) {
    return {
        id: "req-1",
        employee_first_name: "Asha",
        employee_last_name: "Employee",
        employee_role: "EMPLOYEE",
        employee_manager_id: "hr-1",
        leave_type_name: "Annual Leave",
        status: "SUBMITTED",
        start_date: "2099-01-06",
        end_date: "2099-01-06",
        working_days: "1.0",
        reason: "Trip",
        ...overrides,
    };
}

// Both list endpoints are paginated (`{ requests, total }`) and take either a
// page (`limit`/`offset`, for the list) or a window (`startDate`/`endDate`, for
// the calendar) — so a single mock has to answer both shapes. `pageOf` returns
// every request for a windowed call and one page for a paged one, which is what
// the real endpoint does.
function pageOf(requests) {
    return (params = {}) =>
        Promise.resolve(
            params.startDate
                ? { requests, total: requests.length }
                : {
                      requests: requests.slice(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 25)),
                      total: requests.length,
                  }
        );
}

describe("ApprovalsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        holidayService.getHolidays.mockResolvedValue([]);
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([]));
        leaveRequestService.getAllLeaveRequests.mockImplementation(pageOf([]));
    });

    it("shows no tabs for a MANAGER, and fetches only the team-scoped list", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([makeRequest()]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "mgr-1", role: ROLES.MANAGER } }),
        });

        expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
        expect(leaveRequestService.getAllLeaveRequests).not.toHaveBeenCalled();
    });

    // HR gets no tabs any more: the company-wide list is SUPER_ADMIN's alone
    // (direct request), and a team-scoped "all requests" would have returned
    // exactly the same rows this one already does. HR keeps the override
    // authority SUPER_ADMIN doesn't have, so the two roles' views differ in
    // both directions.
    it("shows HR one team-scoped, actionable list and no tabs at all", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([makeRequest()]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "hr-1", role: ROLES.HR_ADMIN } }),
        });

        expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
        expect(leaveRequestService.getTeamLeaveRequests).toHaveBeenCalled();
        expect(leaveRequestService.getAllLeaveRequests).not.toHaveBeenCalled();
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    });

    it("defaults SUPER_ADMIN to the My Team tab", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([makeRequest()]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "super-1", role: ROLES.SUPER_ADMIN } }),
        });

        expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
        expect(leaveRequestService.getTeamLeaveRequests).toHaveBeenCalled();
        expect(leaveRequestService.getAllLeaveRequests).not.toHaveBeenCalled();
        expect(screen.getByRole("tab", { name: /my team/i })).toHaveAttribute("aria-selected", "true");
    });

    it("switches SUPER_ADMIN to the company-wide, read-only All Requests tab when clicked", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([makeRequest({ id: "team-req" })]));
        leaveRequestService.getAllLeaveRequests.mockImplementation(pageOf([makeRequest({ id: "all-req" })]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "super-1", role: ROLES.SUPER_ADMIN } }),
        });
        await screen.findByText("Asha Employee");

        await userEvent.click(screen.getByRole("tab", { name: /all requests/i }));

        expect(await screen.findByRole("tab", { name: /all requests/i })).toHaveAttribute("aria-selected", "true");
        expect(leaveRequestService.getAllLeaveRequests).toHaveBeenCalled();
        // Read-only: no action buttons for a SUBMITTED request on this tab.
        expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^reject$/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^details$/i })).toBeInTheDocument();
    });

    it("switching back to My Team re-fetches the scoped list", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([makeRequest()]));
        leaveRequestService.getAllLeaveRequests.mockImplementation(pageOf([makeRequest()]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "super-1", role: ROLES.SUPER_ADMIN } }),
        });
        await screen.findByText("Asha Employee");

        await userEvent.click(screen.getByRole("tab", { name: /all requests/i }));
        await screen.findByRole("button", { name: /^details$/i });

        await userEvent.click(screen.getByRole("tab", { name: /my team/i }));

        await screen.findByRole("tab", { name: /my team/i });
        // Two list fetches: the initial one and the one after switching back.
        expect(
            leaveRequestService.getTeamLeaveRequests.mock.calls.filter(([params]) => params?.limit).length
        ).toBe(2);
    });

    // The reason the list and the calendar are two fetches: paginating one
    // feed would have silently truncated the other.
    it("pages the list while the calendar keeps its whole month", async () => {
        const rows = Array.from({ length: 30 }, (_, index) =>
            makeRequest({ id: `req-${index}`, employee_first_name: `Emp${index}` })
        );
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf(rows));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "mgr-1", role: ROLES.MANAGER } }),
        });

        expect(await screen.findByText(/showing 1–25 of 30/i)).toBeInTheDocument();
        // Windowed call (the calendar's) asked for no page at all.
        const windowed = leaveRequestService.getTeamLeaveRequests.mock.calls.filter(([params]) => params?.startDate);
        expect(windowed.length).toBeGreaterThan(0);
        expect(windowed[0][0].limit).toBeUndefined();

        // Exact match: FullCalendar's toolbar has its own "Next month" button.
        await userEvent.click(screen.getByRole("button", { name: /^next$/i }));

        expect(await screen.findByText(/showing 26–30 of 30/i)).toBeInTheDocument();
        expect(leaveRequestService.getTeamLeaveRequests).toHaveBeenLastCalledWith({ limit: 25, offset: 25 });
    });

    it("hides the pager when everything fits on one page", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([makeRequest()]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "mgr-1", role: ROLES.MANAGER } }),
        });

        await screen.findByText("Asha Employee");
        expect(screen.queryByRole("button", { name: /^next$/i })).not.toBeInTheDocument();
        expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();
    });

    it("shows the team calendar (FR-023) alongside the list for a MANAGER", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([makeRequest()]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "mgr-1", role: ROLES.MANAGER } }),
        });

        await screen.findByText("Asha Employee");
        expect(document.querySelector(".fc-toolbar-title")).toBeInTheDocument();
        expect(holidayService.getHolidays).toHaveBeenCalledWith({ year: new Date().getFullYear() });
    });

    it("clicking a request's bar on the team calendar highlights its row in the list", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([
            makeRequest({ start_date: todayDateKey(), end_date: todayDateKey() }),
        ]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "mgr-1", role: ROLES.MANAGER } }),
        });
        await screen.findByText("Asha Employee");

        const bar = await screen.findByLabelText(/asha employee — annual leave/i);
        await userEvent.click(bar);

        // Scoped to the list card — the calendar bar itself also renders
        // "Asha · Annual Leave" as its own title text.
        const row = screen.getByRole("button", { name: /^details$/i }).closest("li");
        expect(within(row).getByText("Asha Employee")).toBeInTheDocument();
        expect(row).toHaveClass("ring-indigo-300");
    });

    // The leave bars were the last thing in the app using the browser's native
    // `title` tooltip, which rendered as a dark OS box beside the app's own
    // light tooltips on every icon button.
    it("shows the app's own tooltip when hovering a leave bar on the team calendar", async () => {
        leaveRequestService.getTeamLeaveRequests.mockImplementation(pageOf([
            makeRequest({ start_date: todayDateKey(), end_date: todayDateKey() }),
        ]));
        renderWithProviders(<ApprovalsPage />, {
            authValue: makeAuthValue({ user: { id: "mgr-1", role: ROLES.MANAGER } }),
        });
        await screen.findByText("Asha Employee");
        const bar = await screen.findByLabelText(/asha employee — annual leave/i);

        // Scoped by text, not by role alone: this page's row action buttons
        // each keep a (hidden, CSS-driven) tooltip mounted at all times, so
        // `role="tooltip"` on its own matches several.
        const leaveTooltip = () =>
            screen.queryAllByRole("tooltip").find((node) => /asha employee — annual leave/i.test(node.textContent));

        expect(bar).not.toHaveAttribute("title");
        expect(leaveTooltip()).toBeUndefined();

        await userEvent.hover(bar);

        // Everything the old native tooltip said: who, which leave type, the
        // range, and the decision status.
        await waitFor(() => expect(leaveTooltip()).toBeDefined());
        // The fixture request is SUBMITTED, so the status half reads "Pending".
        expect(leaveTooltip()).toHaveTextContent(/pending/i);

        await userEvent.unhover(bar);
        expect(leaveTooltip()).toBeUndefined();
    });
});
