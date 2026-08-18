import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../tests/renderWithProviders.jsx";
import { ApplyLeavePage } from "./ApplyLeavePage.jsx";
import * as leaveTypeService from "../services/leaveTypeService.js";
import * as leaveRequestService from "../services/leaveRequestService.js";
import * as leaveBalanceService from "../services/leaveBalanceService.js";

vi.mock("../services/leaveTypeService.js");
vi.mock("../services/leaveRequestService.js");
vi.mock("../services/leaveBalanceService.js");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

describe("ApplyLeavePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaveTypeService.getLeaveTypes.mockResolvedValue([{ id: "lt-1", name: "Annual Leave" }]);
        leaveBalanceService.getMyBalances.mockResolvedValue([]);
    });

    it("renders the request form directly on the page, not behind a modal", async () => {
        renderWithProviders(<ApplyLeavePage />);

        expect(await screen.findByLabelText(/leave type/i)).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("has a Cancel link back to My Leave", () => {
        renderWithProviders(<ApplyLeavePage />);
        expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute("href", "/dashboard/my-leave");
    });

    it("navigates back to My Leave with the new request's start date after submitting — so the calendar can jump to it on a fresh mount, not a same-page query flag", async () => {
        leaveRequestService.previewLeaveRequest.mockResolvedValue({ workingDays: 2 });
        leaveRequestService.submitLeaveRequest.mockResolvedValue({ id: "req-1", start_date: "2099-01-06" });
        renderWithProviders(<ApplyLeavePage />);

        await userEvent.selectOptions(await screen.findByLabelText(/leave type/i), "lt-1");
        await userEvent.type(screen.getByLabelText(/start date/i), "2099-01-06");
        await userEvent.type(screen.getByLabelText(/end date/i), "2099-01-07");
        await userEvent.type(screen.getByLabelText(/reason/i), "Trip");
        await userEvent.click(screen.getByRole("button", { name: /submit request/i }));

        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/my-leave", { state: { focusDate: "2099-01-06" } });
    });

    describe("leave balances panel", () => {
        it("shows the caller's remaining days per leave type, so they can check before requesting", async () => {
            leaveBalanceService.getMyBalances.mockResolvedValue([
                { id: "b1", leave_type_name: "Casual Leave", days_remaining: "8" },
            ]);
            renderWithProviders(<ApplyLeavePage />);

            expect(await screen.findByText("Casual Leave")).toBeInTheDocument();
            expect(screen.getByText("8 left")).toBeInTheDocument();
        });

        it("shows an empty state when no leave types exist yet", async () => {
            leaveBalanceService.getMyBalances.mockResolvedValue([]);
            renderWithProviders(<ApplyLeavePage />);

            expect(await screen.findByText(/no leave types have been set up yet/i)).toBeInTheDocument();
        });
    });
});
