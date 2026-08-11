import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { LeaveTypesPage } from "./LeaveTypesPage.jsx";
import * as leaveTypeService from "../services/leaveTypeService.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/leaveTypeService.js");

function makeLeaveType(overrides = {}) {
    return {
        id: "lt-1",
        name: "Sick Leave",
        annual_entitlement: "10",
        accrual_type: "UPFRONT",
        allow_negative_balance: false,
        requires_document: true,
        is_active: true,
        ...overrides,
    };
}

function renderPage() {
    return renderWithProviders(<LeaveTypesPage />, {
        authValue: makeAuthValue({ user: { id: "hr-1", role: ROLES.HR_ADMIN } }),
    });
}

describe("LeaveTypesPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("lists leave types once loaded", async () => {
        leaveTypeService.getLeaveTypes.mockResolvedValue([makeLeaveType()]);
        renderPage();

        expect(await screen.findByText("Sick Leave")).toBeInTheDocument();
    });

    it("opens a blank create form from Add Leave Type", async () => {
        leaveTypeService.getLeaveTypes.mockResolvedValue([]);
        renderPage();
        await screen.findByText(/no leave types yet/i);

        await userEvent.click(screen.getByRole("button", { name: /add leave type/i }));

        const dialog = screen.getByRole("dialog", { name: /new leave type/i });
        expect(within(dialog).getByLabelText(/name/i)).toHaveValue("");
        expect(within(dialog).getByRole("button", { name: /^create$/i })).toBeInTheDocument();
    });

    it("opens the edit form pre-filled with the row's own values", async () => {
        leaveTypeService.getLeaveTypes.mockResolvedValue([makeLeaveType()]);
        renderPage();
        await screen.findByText("Sick Leave");

        await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));

        const dialog = screen.getByRole("dialog", { name: /edit leave type/i });
        expect(within(dialog).getByLabelText(/name/i)).toHaveValue("Sick Leave");
        expect(within(dialog).getByLabelText(/annual entitlement/i)).toHaveValue(10);
        expect(within(dialog).getByLabelText(/supporting document required/i)).toBeChecked();
        expect(within(dialog).getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("submits the edited fields via updateLeaveType, then reloads", async () => {
        const leaveType = makeLeaveType();
        leaveTypeService.getLeaveTypes.mockResolvedValue([leaveType]);
        leaveTypeService.updateLeaveType.mockResolvedValue({ ...leaveType, name: "Medical Leave" });
        renderPage();
        await screen.findByText("Sick Leave");

        await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
        const dialog = screen.getByRole("dialog", { name: /edit leave type/i });
        const nameInput = within(dialog).getByLabelText(/name/i);
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, "Medical Leave");
        await userEvent.click(within(dialog).getByRole("button", { name: /save changes/i }));

        expect(leaveTypeService.updateLeaveType).toHaveBeenCalledWith("lt-1", {
            name: "Medical Leave",
            annualEntitlement: 10,
            accrualType: "UPFRONT",
            allowNegativeBalance: false,
            requiresDocument: true,
        });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("still lets HR toggle status independently of editing", async () => {
        leaveTypeService.getLeaveTypes.mockResolvedValue([makeLeaveType()]);
        leaveTypeService.updateLeaveTypeStatus.mockResolvedValue(makeLeaveType({ is_active: false }));
        renderPage();
        await screen.findByText("Sick Leave");

        await userEvent.click(screen.getByRole("button", { name: /deactivate/i }));

        expect(leaveTypeService.updateLeaveTypeStatus).toHaveBeenCalledWith("lt-1", false);
    });
});
