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

        expect(await screen.findByText("2")).toBeInTheDocument();
        expect(screen.getByText(/waiting for your decision/i)).toBeInTheDocument();
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
                employee_role: "EMPLOYEE",
                employee_email: "asha@example.com",
                leave_type_name: "Sick Leave",
                start_date: today,
                end_date: today,
                working_days: "1.0",
                start_half_day: true,
            },
            {
                id: "r2",
                status: "APPROVED",
                employee_first_name: "Rohit",
                employee_last_name: "Peer",
                employee_role: "MANAGER",
                employee_email: "rohit@example.com",
                leave_type_name: "Annual Leave",
                start_date: "2099-01-01",
                end_date: "2099-01-02",
                working_days: "2.0",
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

        expect(screen.queryByText(/rohit peer/i)).not.toBeInTheDocument();
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
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([
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

    // SUPER_ADMIN's HR scope is its direct-report HR admins only, so the
    // team-scoped list would show it an almost-empty "on leave today" beside a
    // whole-company headcount. It reads the company-wide list instead — the
    // one GET /leave-requests/all is now gated to.
    it("reads the company-wide list for SUPER_ADMIN, and the team list for everyone else", async () => {
        const today = todayDateKey();
        leaveRequestService.getAllLeaveRequests.mockResolvedValue([
            {
                id: "r9",
                status: "APPROVED",
                employee_first_name: "Deep",
                employee_last_name: "Branch",
                employee_role: "EMPLOYEE",
                employee_email: "deep@example.com",
                leave_type_name: "Casual Leave",
                start_date: today,
                end_date: today,
                working_days: "1.0",
            },
        ]);
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([]);

        const { unmount } = renderWithProviders(<TeamOverviewSummary />, {
            authValue: makeAuthValue({ user: { id: "super-1", role: ROLES.SUPER_ADMIN } }),
        });

        expect(await screen.findByText("Deep Branch")).toBeInTheDocument();
        expect(screen.getByText("Organisation overview")).toBeInTheDocument();
        expect(leaveRequestService.getAllLeaveRequests).toHaveBeenCalled();
        expect(leaveRequestService.getTeamLeaveRequests).not.toHaveBeenCalled();
        unmount();

        vi.clearAllMocks();
        userService.getMyTeam.mockResolvedValue([]);
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<TeamOverviewSummary />, {
            authValue: makeAuthValue({ user: { id: "hr-1", role: ROLES.HR_ADMIN } }),
        });

        expect(await screen.findByText("Team overview")).toBeInTheDocument();
        expect(leaveRequestService.getTeamLeaveRequests).toHaveBeenCalled();
        expect(leaveRequestService.getAllLeaveRequests).not.toHaveBeenCalled();
    });

    it("says nobody's out when no one is on approved leave today", async () => {
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([]);
        renderWithProviders(<TeamOverviewSummary />);

        expect(await screen.findByText(/nobody's out today/i)).toBeInTheDocument();
    });
});
