import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
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

describe("HrReportsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaveRequestService.getFilteredLeaveRequests.mockResolvedValue([]);
        // A different name than makeRequest()'s "Asha Employee" — otherwise
        // this dropdown option and the rendered request row would be
        // textually indistinguishable to a plain screen.getByText query.
        userService.getUsers.mockResolvedValue([{ id: "emp-1", first_name: "Rahul", last_name: "Singh" }]);
        leaveTypeService.getLeaveTypes.mockResolvedValue([{ id: "lt-1", name: "Annual Leave" }]);
    });

    describe("Browse Requests tab", () => {
        it("loads with no filters applied", async () => {
            leaveRequestService.getFilteredLeaveRequests.mockResolvedValue([makeRequest()]);
            renderPage();

            expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenCalledWith({});
        });

        it("re-fetches with the selected employee once filters are applied", async () => {
            renderPage();
            await screen.findByLabelText(/employee/i);

            await userEvent.selectOptions(screen.getByLabelText(/^employee$/i), "emp-1");
            await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));

            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenLastCalledWith({ employeeId: "emp-1" });
        });

        it("shows a read-only list — no approve/reject/override actions", async () => {
            leaveRequestService.getFilteredLeaveRequests.mockResolvedValue([makeRequest()]);
            renderPage();

            await screen.findByText("Asha Employee");
            expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: /^details$/i })).toBeInTheDocument();
        });

        it("clearing filters resets and re-fetches with none applied", async () => {
            renderPage();
            await screen.findByLabelText(/employee/i);

            await userEvent.selectOptions(screen.getByLabelText(/^employee$/i), "emp-1");
            await userEvent.click(screen.getByRole("button", { name: /apply filters/i }));
            await userEvent.click(screen.getByRole("button", { name: /^clear$/i }));

            expect(leaveRequestService.getFilteredLeaveRequests).toHaveBeenLastCalledWith({});
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
    });
});
