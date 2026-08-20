import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { HrReportsPage } from "./HrReportsPage.jsx";
import * as leaveRequestService from "../services/leaveRequestService.js";
import * as userService from "../services/userService.js";
import * as leaveTypeService from "../services/leaveTypeService.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/leaveRequestService.js");
vi.mock("../services/userService.js");
vi.mock("../services/leaveTypeService.js");

function makeRequest(overrides = {}) {
    return {
        id: "req-1",
        employee_first_name: "Asha",
        employee_last_name: "Employee",
        employee_role: "EMPLOYEE",
        leave_type_name: "Annual Leave",
        status: "SUBMITTED",
        start_date: "2099-01-06",
        end_date: "2099-01-06",
        working_days: "1.0",
        reason: "Trip",
        ...overrides,
    };
}

function renderPage() {
    return renderWithProviders(<HrReportsPage />, {
        authValue: makeAuthValue({ user: { id: "hr-1", role: ROLES.HR_ADMIN } }),
    });
}

// The browse endpoint is paginated: `{ requests, total }` rather than a bare
// array, with `limit`/`offset` sent alongside the filters.
function page(requests, total = requests.length) {
    return { requests, total };
}

const FIRST_PAGE = { limit: 25, offset: 0 };

describe("HrReportsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaveRequestService.getFilteredLeaveRequests.mockResolvedValue(page([]));
        // A different name than makeRequest()'s "Asha Employee" — otherwise
        // this dropdown option and the rendered request row would be
        // textually indistinguishable to a plain screen.getByText query.
        userService.getUserOptions.mockResolvedValue([
            { id: "emp-1", first_name: "Rahul", last_name: "Singh", role: "EMPLOYEE", email: "rahul@example.com" },
        ]);
        leaveTypeService.getLeaveTypes.mockResolvedValue([{ id: "lt-1", name: "Annual Leave" }]);
    });

    describe("Browse Requests tab", () => {
        it("loads with no filters applied", async () => {
            leaveRequestService.getFilteredLeaveRequests.mockResolvedValue(page([makeRequest()]));
            renderPage();

            expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenCalledWith(FIRST_PAGE);
        });

        it("re-fetches with the selected employee once filters are applied", async () => {
            renderPage();
            const employeeInput = await screen.findByLabelText(/^employee$/i);

            await userEvent.click(employeeInput);
            await userEvent.click(screen.getByRole("button", { name: /rahul singh/i }));
            await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));

            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenLastCalledWith({
                employeeId: "emp-1",
                ...FIRST_PAGE,
            });
        });

        it("filters the employee dropdown as the search text narrows it down", async () => {
            userService.getUserOptions.mockResolvedValue([
                { id: "emp-1", first_name: "Rahul", last_name: "Singh", role: "EMPLOYEE", email: "rahul@example.com" },
                { id: "emp-2", first_name: "Priya", last_name: "Manager", role: "MANAGER", email: "priya@example.com" },
            ]);
            renderPage();
            const employeeInput = await screen.findByLabelText(/^employee$/i);

            await userEvent.click(employeeInput);
            expect(screen.getByRole("button", { name: /rahul singh/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /priya manager/i })).toBeInTheDocument();

            await userEvent.type(employeeInput, "pri");
            expect(screen.queryByRole("button", { name: /rahul singh/i })).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: /priya manager/i })).toBeInTheDocument();
        });

        it("shows each result's role and email so same-named employees are distinguishable", async () => {
            userService.getUserOptions.mockResolvedValue([
                { id: "emp-1", first_name: "John", last_name: "Smith", role: "EMPLOYEE", email: "john.smith@example.com" },
                { id: "emp-2", first_name: "John", last_name: "Smith", role: "MANAGER", email: "john.smith2@example.com" },
            ]);
            renderPage();
            const employeeInput = await screen.findByLabelText(/^employee$/i);

            await userEvent.click(employeeInput);

            const firstResult = screen.getByRole("button", {
                name: /john smith.*employee.*john\.smith@example\.com/is,
            });
            const secondResult = screen.getByRole("button", {
                name: /john smith.*manager.*john\.smith2@example\.com/is,
            });
            expect(firstResult).toBeInTheDocument();
            expect(secondResult).toBeInTheDocument();
            expect(firstResult).not.toBe(secondResult);
        });

        it("shows a read-only list — no approve/reject/override actions", async () => {
            leaveRequestService.getFilteredLeaveRequests.mockResolvedValue(page([makeRequest()]));
            renderPage();

            await screen.findByText("Asha Employee");
            expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: /^details$/i })).toBeInTheDocument();
        });

        // Every browse result is one page now — the unfiltered default used to
        // be "every request in this HR admin's branch", thousands of rows at
        // NFR-7 scale.
        it("pages through results, showing the server's total", async () => {
            const rows = Array.from({ length: 25 }, (_, index) =>
                makeRequest({ id: `r${index}`, employee_first_name: `Emp${index}` })
            );
            leaveRequestService.getFilteredLeaveRequests.mockResolvedValue(page(rows, 60));
            renderPage();

            expect(await screen.findByText(/showing 1–25 of 60/i)).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

            await userEvent.click(screen.getByRole("button", { name: /next/i }));

            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenLastCalledWith({ limit: 25, offset: 25 });
            expect(await screen.findByText(/showing 26–50 of 60/i)).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /previous/i })).toBeEnabled();
        });

        it("hides the pager when everything fits on one page", async () => {
            leaveRequestService.getFilteredLeaveRequests.mockResolvedValue(page([makeRequest()], 1));
            renderPage();

            await screen.findByText("Asha Employee");
            expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
            expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();
        });

        // A narrower filter can have fewer rows than the offset the previous
        // result set was on — staying there would render an empty table that
        // reads as "no matches".
        it("returns to the first page when filters are applied or cleared", async () => {
            leaveRequestService.getFilteredLeaveRequests.mockResolvedValue(page([makeRequest()], 60));
            renderPage();
            await screen.findByText("Asha Employee");

            await userEvent.click(screen.getByRole("button", { name: /next/i }));
            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenLastCalledWith({ limit: 25, offset: 25 });

            const employeeInput = await screen.findByLabelText(/^employee$/i);
            await userEvent.click(employeeInput);
            await userEvent.click(screen.getByRole("button", { name: /rahul singh/i }));
            await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));

            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenLastCalledWith({
                employeeId: "emp-1",
                ...FIRST_PAGE,
            });
        });

        it("clearing filters resets and re-fetches with none applied", async () => {
            renderPage();
            const employeeInput = await screen.findByLabelText(/^employee$/i);

            await userEvent.click(employeeInput);
            await userEvent.click(screen.getByRole("button", { name: /rahul singh/i }));
            await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
            await userEvent.click(screen.getByRole("button", { name: /^clear$/i }));

            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenLastCalledWith(FIRST_PAGE);
        });
    });

    describe("Leave Report tab", () => {
        async function openReportTab() {
            renderPage();
            await userEvent.click(screen.getByRole("tab", { name: /leave report/i }));
        }

        it("shows the per-employee report after generating for a period", async () => {
            leaveRequestService.getLeaveTakenReport.mockResolvedValue([
                { employee_id: "emp-1", employee_first_name: "Asha", employee_last_name: "Employee", employee_role: "EMPLOYEE", request_count: 2, total_days_taken: "3" },
            ]);
            await openReportTab();

            await userEvent.type(screen.getByLabelText(/from/i), "2031-01-01");
            await userEvent.type(screen.getByLabelText(/^to$/i), "2031-01-31");
            await userEvent.click(screen.getByRole("button", { name: /generate report/i }));

            expect(leaveRequestService.getLeaveTakenReport).toHaveBeenCalledWith({
                startDate: "2031-01-01",
                endDate: "2031-01-31",
            });
            expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
            expect(screen.getByText("3 days")).toBeInTheDocument();
            expect(screen.getByText("2 requests")).toBeInTheDocument();
        });

        it("shows an empty-state message when nobody took leave in the period", async () => {
            leaveRequestService.getLeaveTakenReport.mockResolvedValue([]);
            await openReportTab();

            await userEvent.type(screen.getByLabelText(/from/i), "2031-01-01");
            await userEvent.type(screen.getByLabelText(/^to$/i), "2031-01-31");
            await userEvent.click(screen.getByRole("button", { name: /generate report/i }));

            expect(await screen.findByText(/nobody had an approved leave request/i)).toBeInTheDocument();
        });

        it("points the CSV download link at the entered period", async () => {
            leaveRequestService.getLeaveTakenReportCsvUrl.mockReturnValue(
                "http://localhost:5001/api/leave-requests/report/csv?startDate=2031-01-01&endDate=2031-01-31"
            );
            await openReportTab();

            await userEvent.type(screen.getByLabelText(/from/i), "2031-01-01");
            await userEvent.type(screen.getByLabelText(/^to$/i), "2031-01-31");

            expect(screen.getByRole("link", { name: /download csv/i })).toHaveAttribute(
                "href",
                "http://localhost:5001/api/leave-requests/report/csv?startDate=2031-01-01&endDate=2031-01-31"
            );
        });

        it("disables generating a report until both dates are filled in", async () => {
            await openReportTab();
            expect(screen.getByRole("button", { name: /generate report/i })).toBeDisabled();
        });

        it("resets the period and results when Clear is clicked", async () => {
            leaveRequestService.getLeaveTakenReport.mockResolvedValue([
                { employee_id: "emp-1", employee_first_name: "Asha", employee_last_name: "Employee", employee_role: "EMPLOYEE", request_count: 1, total_days_taken: "1" },
            ]);
            await openReportTab();

            await userEvent.type(screen.getByLabelText(/from/i), "2031-01-01");
            await userEvent.type(screen.getByLabelText(/^to$/i), "2031-01-31");
            await userEvent.click(screen.getByRole("button", { name: /generate report/i }));
            await screen.findByText("Asha Employee");

            await userEvent.click(screen.getByRole("button", { name: /^clear$/i }));

            expect(screen.getByLabelText(/from/i)).toHaveValue("");
            expect(screen.queryByText("Asha Employee")).not.toBeInTheDocument();
        });

        it("generates a report immediately for a quick-range preset, without a separate Generate click", async () => {
            leaveRequestService.getLeaveTakenReport.mockResolvedValue([]);
            await openReportTab();

            await userEvent.click(screen.getByRole("button", { name: /^this year$/i }));

            const currentYear = new Date().getFullYear();
            await waitFor(() =>
                expect(leaveRequestService.getLeaveTakenReport).toHaveBeenCalledWith({
                    startDate: `${currentYear}-01-01`,
                    endDate: `${currentYear}-12-31`,
                })
            );
            expect(screen.getByLabelText(/from/i)).toHaveValue(`${currentYear}-01-01`);
        });
    });
});
