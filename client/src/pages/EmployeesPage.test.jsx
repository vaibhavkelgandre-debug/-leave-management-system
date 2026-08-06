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

    it("hides the invite form until 'Add Employee' is clicked", async () => {
        userService.getUsers.mockResolvedValue([]);
        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
        await screen.findByText("Employees");

        expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /add employee/i }));
        expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
    });

    it("shows the manager field only when the role is Employee", async () => {
        userService.getUsers.mockResolvedValue([makeUser({ role: ROLES.MANAGER })]);
        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
        await screen.findByText("Employees");
        await userEvent.click(screen.getByRole("button", { name: /add employee/i }));

        expect(screen.getByLabelText(/manager/i)).toBeInTheDocument();

        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.MANAGER);
        expect(screen.queryByLabelText(/manager/i)).not.toBeInTheDocument();

        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.EMPLOYEE);
        expect(screen.getByLabelText(/manager/i)).toBeInTheDocument();
    });

    it("submits the invite and shows the returned invite link", async () => {
        const manager = makeUser({ id: "mgr-1", role: ROLES.MANAGER });
        userService.getUsers.mockResolvedValue([manager]);
        userService.inviteEmployee.mockResolvedValue({
            user: makeUser({ id: "new-1" }),
            inviteLink: "http://localhost:5173/invite/abc123",
        });

        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
        await screen.findByText("Employees");
        await userEvent.click(screen.getByRole("button", { name: /add employee/i }));

        await userEvent.type(screen.getByLabelText(/first name/i), "New");
        await userEvent.type(screen.getByLabelText(/last name/i), "Hire");
        await userEvent.type(screen.getByLabelText(/email/i), "new@example.com");
        await userEvent.selectOptions(screen.getByLabelText(/manager/i), "mgr-1");
        await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));

        expect(userService.inviteEmployee).toHaveBeenCalledWith(
            expect.objectContaining({ firstName: "New", lastName: "Hire", email: "new@example.com", managerId: "mgr-1" })
        );
        expect(await screen.findByText(/abc123/)).toBeInTheDocument();
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
