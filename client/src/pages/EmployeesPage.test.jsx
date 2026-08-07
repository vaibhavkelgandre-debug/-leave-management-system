import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { EmployeesPage } from "./EmployeesPage.jsx";
import * as userService from "../services/userService.js";
import { makeUser } from "../tests/fixtures/users.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/userService.js");

const hrAuthValue = makeAuthValue({ user: { id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN } });

describe("EmployeesPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a loading state, then lists employees", async () => {
        userService.getUsers.mockResolvedValue([makeUser({ first_name: "Priya", role: ROLES.HR_ADMIN })]);
        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });

        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(await screen.findByText("Priya User")).toBeInTheDocument();
    });

    it("shows an error state when loading fails", async () => {
        userService.getUsers.mockRejectedValue(new Error("network error"));
        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load employees");
    });

    it("opens the invite form in a modal instead of navigating away", async () => {
        userService.getUsers.mockResolvedValue([]);
        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
        await screen.findByText("Employees");

        // Closed by default — nothing from the invite form renders yet.
        expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /add employee/i }));

        expect(await screen.findByRole("dialog", { name: /invite an employee/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });

    it("lets HR change an employee's manager", async () => {
        const manager = makeUser({ id: "mgr-1", first_name: "Manoj", role: ROLES.MANAGER });
        const employee = makeUser({ id: "emp-1", first_name: "Asha", manager_id: "mgr-1" });
        userService.getUsers.mockResolvedValue([manager, employee]);
        userService.updateManager.mockResolvedValue({ ...employee, manager_id: "mgr-1" });

        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
        const ashaCell = await screen.findByText("Asha User");
        const ashaRow = within(ashaCell.closest("tr"));

        await userEvent.click(ashaRow.getByRole("button", { name: "Change manager" }));
        await userEvent.selectOptions(screen.getByLabelText(/manager for asha/i), "mgr-1");
        await userEvent.click(ashaRow.getByRole("button", { name: "Save" }));

        expect(userService.updateManager).toHaveBeenCalledWith("emp-1", "mgr-1");
    });

    it("lets HR deactivate an active employee but not themselves", async () => {
        const employee = makeUser({ id: "emp-2", first_name: "Kiran", status: "ACTIVE" });
        userService.getUsers.mockResolvedValue([employee]);
        userService.updateStatus.mockResolvedValue({ ...employee, status: "INACTIVE" });

        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
        await screen.findByText("Kiran User");

        const deactivateButton = screen.getByRole("button", { name: /deactivate/i });
        expect(deactivateButton).toBeEnabled();

        await userEvent.click(deactivateButton);
        expect(userService.updateStatus).toHaveBeenCalledWith("emp-2", "INACTIVE");
    });

    it("disables the status action on the current user's own row", async () => {
        userService.getUsers.mockResolvedValue([makeUser({ id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN })]);

        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
        await screen.findByText("Priya User");

        expect(screen.getByRole("button", { name: /deactivate/i })).toBeDisabled();
    });
});
