import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { TeamOverviewSummary } from "./TeamOverviewSummary.jsx";
import * as leaveRequestService from "../../services/leaveRequestService.js";
import * as userService from "../../services/userService.js";
import { todayDateKey } from "../../utils/dates.js";
import { ROLES } from "../../constants/roles.js";

vi.mock("../../services/leaveRequestService.js");
vi.mock("../../services/userService.js");

// Three focused endpoints now, none of them a list this tile counts itself:
// a pending *count*, today's rows only, and a team *size*. See
// TeamOverviewSummary.jsx's header for what it used to download instead.
describe("TeamOverviewSummary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userService.getMyTeamSize.mockResolvedValue(2);
        leaveRequestService.getPendingApprovalsCount.mockResolvedValue(0);
        leaveRequestService.getOnLeaveToday.mockResolvedValue([]);
    });

    it("shows the team headcount", async () => {
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText("2 people")).toBeInTheDocument();
    });

    it("offers a review link when requests are pending", async () => {
        leaveRequestService.getPendingApprovalsCount.mockResolvedValue(2);
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText("2")).toBeInTheDocument();
        expect(screen.getByText(/waiting for your decision/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /review/i })).toHaveAttribute("href", "/dashboard/approvals");
    });

    it("shows no review link when nothing is pending", async () => {
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText("No requests waiting for a decision.")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /review/i })).not.toBeInTheDocument();
    });

    it("lists who is on approved leave today", async () => {
        const today = todayDateKey();
        // The endpoint already returns only today's approved rows, so this is
        // exactly what the tile receives — no client-side status/date filter
        // left to exercise here (that rule lives in
        // leaveRequestService.listOnLeaveToday, covered server-side).
        leaveRequestService.getOnLeaveToday.mockResolvedValue([
            {
                id: "r1",
                status: "APPROVED",
                employee_first_name: "Asha",
                employee_last_name: "Employee",
                employee_role: "EMPLOYEE",
                employee_email: "asha@example.com",
                leave_type_name: "Sick Leave",
                start_date: today,
                end_date: today,
                working_days: "1.0",
                start_half_day: true,
            },
        ]);
        renderWithProviders(<TeamOverviewSummary />);

        // A table now, not a list of wrapped chips — so the assertions are
        // column headers plus one row's cells, and "Employee" appears twice on
        // the page (a column header and a role badge), which is exactly why
        // this is scoped to the row.
        const nameCell = await screen.findByText("Asha Employee");
        for (const header of ["Employee", "Role", "Leave type", "Dates", "Days"]) {
            expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
        }

        const row = within(nameCell.closest("tr"));
        expect(row.getByText("asha@example.com")).toBeInTheDocument();
        expect(row.getByText("AE")).toBeInTheDocument();
        expect(row.getByText("Employee")).toBeInTheDocument();
        expect(row.getByText("Sick Leave")).toBeInTheDocument();
        // Split across elements ("1 day" + a smaller "(half day)"), so this
        // reads the row's own text rather than matching a single node.
        expect(nameCell.closest("tr").textContent).toMatch(/1 day \(half day\)/);

    });

    it("sorts the people who are out today by name", async () => {
        const today = todayDateKey();
        const onLeave = (id, firstName) => ({
            id,
            status: "APPROVED",
            employee_first_name: firstName,
            employee_last_name: "Out",
            employee_role: "EMPLOYEE",
            employee_email: `${firstName.toLowerCase()}@example.com`,
            leave_type_name: "Annual Leave",
            start_date: today,
            end_date: today,
            working_days: "1.0",
        });
        leaveRequestService.getOnLeaveToday.mockResolvedValue([
            onLeave("r1", "Zara"),
            onLeave("r2", "Asha"),
            onLeave("r3", "Meera"),
        ]);
        renderWithProviders(<TeamOverviewSummary />);

        await screen.findByText("Asha Out");
        // getAllByText returns matches in document order, which for rows of a
        // table is top-to-bottom — the exact-name regex keeps the avatar
        // initials and the email in the same cell out of it.
        const names = screen.getAllByText(/^(Asha|Meera|Zara) Out$/).map((node) => node.textContent);
        expect(names).toEqual(["Asha Out", "Meera Out", "Zara Out"]);
    });

    // The company-wide-vs-team decision moved into
    // leaveRequestService.listOnLeaveToday (asserted server-side in
    // leaveRequests.test.js) — one endpoint serves both now, so all that's
    // role-dependent here is the title.
    it("titles itself for the organisation for SUPER_ADMIN, and for the team otherwise", async () => {
        const { unmount } = renderWithProviders(<TeamOverviewSummary />, {
            authValue: makeAuthValue({ user: { id: "super-1", role: ROLES.SUPER_ADMIN } }),
        });

        expect(await screen.findByText("Organisation overview")).toBeInTheDocument();
        unmount();

        renderWithProviders(<TeamOverviewSummary />, {
            authValue: makeAuthValue({ user: { id: "hr-1", role: ROLES.HR_ADMIN } }),
        });

        expect(await screen.findByText("Team overview")).toBeInTheDocument();
    });

    // The regression this whole change exists to prevent: the tile must never
    // go back to fetching a request list (or a full subtree of users) to derive
    // a count from it.
    it("never fetches a request list or the full team roster", async () => {
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText(/nobody's out today/i)).toBeInTheDocument();
        expect(leaveRequestService.getTeamLeaveRequests).not.toHaveBeenCalled();
        expect(leaveRequestService.getAllLeaveRequests).not.toHaveBeenCalled();
        expect(userService.getMyTeam).not.toHaveBeenCalled();
        expect(leaveRequestService.getOnLeaveToday).toHaveBeenCalled();
        expect(leaveRequestService.getPendingApprovalsCount).toHaveBeenCalled();
        expect(userService.getMyTeamSize).toHaveBeenCalled();
    });

    it("says nobody's out when no one is on approved leave today", async () => {
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText(/nobody's out today/i)).toBeInTheDocument();
    });
});
