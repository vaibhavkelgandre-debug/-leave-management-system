import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { NavBar } from "./NavBar.jsx";
import { ROLES } from "../../constants/roles.js";
import * as delegationService from "../../services/delegationService.js";
import * as leaveRequestService from "../../services/leaveRequestService.js";
import { todayDateKey, addDaysToDateKey } from "../../utils/dates.js";

vi.mock("../../services/delegationService.js");
vi.mock("../../services/leaveRequestService.js");

function renderNav(role) {
    return renderWithProviders(<NavBar />, {
        authValue: makeAuthValue({ user: { id: "1", role } }),
    });
}

function makeRequest(status) {
    return { id: `req-${Math.random()}`, status };
}

describe("NavBar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: nobody has delegated to the rendered user, and no pending
        // requests — most tests below aren't about either.
        delegationService.getDelegationsAsDelegate.mockResolvedValue([]);
        leaveRequestService.getTeamLeaveRequests.mockResolvedValue([]);
    });

    it("shows the shared links but no team or HR links for an EMPLOYEE", async () => {
        renderNav(ROLES.EMPLOYEE);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my leave/i })).toBeInTheDocument();
        // Everyone can see the leave calendar — only the add/delete controls
        // inside the page are HR-only.
        expect(screen.getByRole("link", { name: /leave calendar/i })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /my team/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /all employees/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /leave types/i })).not.toBeInTheDocument();

        // Wait for the delegation check to resolve before asserting its absence.
        await waitFor(() => expect(delegationService.getDelegationsAsDelegate).toHaveBeenCalled());
        expect(screen.queryByRole("link", { name: /approvals/i })).not.toBeInTheDocument();
    });

    it("reveals Approvals for a plain EMPLOYEE currently covering someone as an active delegate", async () => {
        const today = todayDateKey();
        delegationService.getDelegationsAsDelegate.mockResolvedValue([
            {
                id: "d1",
                manager_first_name: "Priya",
                manager_last_name: "Manager",
                start_date: addDaysToDateKey(today, -2),
                end_date: addDaysToDateKey(today, 5),
            },
        ]);
        renderNav(ROLES.EMPLOYEE);

        expect(await screen.findByRole("link", { name: /approvals/i })).toBeInTheDocument();
        // Still no manager/HR-only links — the delegation only reveals Approvals.
        expect(screen.queryByRole("link", { name: /my team/i })).not.toBeInTheDocument();
    });

    it("adds My Team, but no HR-only links, for a MANAGER", () => {
        renderNav(ROLES.MANAGER);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my leave/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /leave calendar/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my team/i })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /all employees/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /leave types/i })).not.toBeInTheDocument();
    });

    it("groups My Team/Approvals/Delegations under a 'Manager' heading, same treatment as HR Admin's group", () => {
        renderNav(ROLES.MANAGER);
        expect(screen.getByText("Manager")).toBeInTheDocument();
    });

    it("shows no 'Manager' heading for a plain EMPLOYEE with no active delegation", async () => {
        renderNav(ROLES.EMPLOYEE);
        await waitFor(() => expect(delegationService.getDelegationsAsDelegate).toHaveBeenCalled());
        expect(screen.queryByText("Manager")).not.toBeInTheDocument();
    });

    it("shows all links for HR_ADMIN", () => {
        renderNav(ROLES.HR_ADMIN);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my leave/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my team/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /all employees/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /leave types/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /leave calendar/i })).toBeInTheDocument();
    });

    it("always shows Apply Leave regardless of role", () => {
        renderNav(ROLES.EMPLOYEE);
        expect(screen.getByRole("link", { name: /apply leave/i })).toBeInTheDocument();
    });

    it("highlights only My Leave, not Apply Leave, on the My Leave route — they're separate pages now, not a shared path with a query flag", () => {
        renderWithProviders(<NavBar />, {
            route: "/dashboard/my-leave",
            authValue: makeAuthValue({ user: { id: "1", role: ROLES.EMPLOYEE } }),
        });

        expect(screen.getByRole("link", { name: /^my leave$/i }).className).toContain("bg-indigo-50");
        expect(screen.getByRole("link", { name: /apply leave/i }).className).not.toContain("bg-indigo-50");
    });

    it("highlights only Apply Leave, not My Leave, on the Apply Leave route", () => {
        renderWithProviders(<NavBar />, {
            route: "/dashboard/apply-leave",
            authValue: makeAuthValue({ user: { id: "1", role: ROLES.EMPLOYEE } }),
        });

        expect(screen.getByRole("link", { name: /apply leave/i }).className).toContain("bg-indigo-50");
        expect(screen.getByRole("link", { name: /^my leave$/i }).className).not.toContain("bg-indigo-50");
    });

    describe("hover tooltip", () => {
        it("shows nothing on hover when the sidebar is expanded — the label is already visible as text", async () => {
            renderNav(ROLES.EMPLOYEE);

            await userEvent.hover(screen.getByRole("link", { name: /apply leave/i }));

            expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
        });

        it("shows just the item's short label on hover when collapsed, never the longer description", async () => {
            renderWithProviders(<NavBar collapsed />, {
                authValue: makeAuthValue({ user: { id: "1", role: ROLES.EMPLOYEE } }),
            });

            await userEvent.hover(screen.getByRole("link", { name: /apply leave/i }));

            const tooltip = await screen.findByRole("tooltip");
            expect(tooltip).toHaveTextContent("Apply Leave");
            expect(tooltip).not.toHaveTextContent(/submit a new leave request/i);
        });
    });

    describe("pending-approvals badge", () => {
        it("shows no badge on Approvals when there's nothing pending", async () => {
            renderNav(ROLES.MANAGER);
            await waitFor(() => expect(leaveRequestService.getTeamLeaveRequests).toHaveBeenCalled());
            expect(screen.queryByLabelText(/pending/i)).not.toBeInTheDocument();
        });

        it("counts only SUBMITTED requests, not decided ones, for a MANAGER", async () => {
            leaveRequestService.getTeamLeaveRequests.mockResolvedValue([
                makeRequest("SUBMITTED"),
                makeRequest("SUBMITTED"),
                makeRequest("APPROVED"),
                makeRequest("REJECTED"),
            ]);
            renderNav(ROLES.MANAGER);

            expect(await screen.findByLabelText("2 pending")).toBeInTheDocument();
        });

        it("never fetches the team list for a plain EMPLOYEE with no active delegation", async () => {
            renderNav(ROLES.EMPLOYEE);
            await waitFor(() => expect(delegationService.getDelegationsAsDelegate).toHaveBeenCalled());
            expect(leaveRequestService.getTeamLeaveRequests).not.toHaveBeenCalled();
        });

        it("shows the badge for a delegate-employee once their active delegation reveals Approvals", async () => {
            const today = todayDateKey();
            delegationService.getDelegationsAsDelegate.mockResolvedValue([
                {
                    id: "d1",
                    manager_first_name: "Priya",
                    manager_last_name: "Manager",
                    start_date: addDaysToDateKey(today, -1),
                    end_date: addDaysToDateKey(today, 1),
                },
            ]);
            leaveRequestService.getTeamLeaveRequests.mockResolvedValue([makeRequest("SUBMITTED")]);
            renderNav(ROLES.EMPLOYEE);

            expect(await screen.findByLabelText("1 pending")).toBeInTheDocument();
        });
    });
});
