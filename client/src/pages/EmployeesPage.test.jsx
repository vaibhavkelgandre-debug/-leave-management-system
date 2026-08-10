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
        await screen.findByText("Leadership");

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
        const ashaRow = within(ashaCell.closest("li"));

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

    it("marks the logged-in user's own row with a \"You\" badge, and no one else's", async () => {
        const self = makeUser({ id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN });
        const other = makeUser({ id: "emp-1", first_name: "Zara", manager_id: "hr-viewer" });
        userService.getUsers.mockResolvedValue([self, other]);

        renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
        const priyaRow = (await screen.findByText("Priya User")).closest("li");
        const zaraRow = (await screen.findByText("Zara User")).closest("li");

        expect(within(priyaRow).getByText("You")).toBeInTheDocument();
        expect(within(zaraRow).queryByText("You")).not.toBeInTheDocument();
    });

    describe("reporting-line grouping", () => {
        it("puts each manager's own reports inside their team card, not the leadership or unassigned sections", async () => {
            const hr = makeUser({ id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN });
            const manager = makeUser({ id: "mgr-a", first_name: "Amit", role: ROLES.MANAGER, manager_id: "hr-viewer" });
            const employee = makeUser({ id: "emp-1", first_name: "Zara", manager_id: "mgr-a" });
            userService.getUsers.mockResolvedValue([hr, manager, employee]);

            renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
            const zaraRow = (await screen.findByText("Zara User")).closest("li");

            // The card containing Zara's row also contains Amit's row —
            // that's what makes it "Amit's team card" rather than some
            // other grouping.
            expect(within(zaraRow.closest("ul")).getByText("Amit User")).toBeInTheDocument();
            expect(screen.queryByText("Reports directly to HR")).not.toBeInTheDocument();
        });

        it("shows an employee with no manager under \"Reports directly to HR\", labeled with who they report to", async () => {
            const hr = makeUser({ id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN });
            const employee = makeUser({ id: "emp-1", first_name: "Zara", manager_id: "hr-viewer" });
            userService.getUsers.mockResolvedValue([hr, employee]);

            renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });

            expect(await screen.findByText("Reports directly to HR")).toBeInTheDocument();
            expect(screen.getByText("Zara User")).toBeInTheDocument();
            expect(screen.getByText(/reports to priya user/i)).toBeInTheDocument();
        });

        it("doesn't show the \"Reports directly to HR\" section when nobody is in it", async () => {
            userService.getUsers.mockResolvedValue([makeUser({ id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN })]);

            renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
            await screen.findByText("Priya User");

            expect(screen.queryByText("Reports directly to HR")).not.toBeInTheDocument();
        });

        it("shows an empty-team message for a manager with nobody reporting to them yet", async () => {
            userService.getUsers.mockResolvedValue([makeUser({ id: "mgr-a", first_name: "Amit", role: ROLES.MANAGER })]);

            renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });

            expect(await screen.findByText(/no one reports to amit yet/i)).toBeInTheDocument();
        });
    });

    describe("HR reporting-line edit restriction", () => {
        it("lets the HR admin who created another HR admin change who they report to", async () => {
            const hr = makeUser({ id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN });
            const createdHr = makeUser({
                id: "hr-created",
                first_name: "Amit",
                role: ROLES.HR_ADMIN,
                manager_id: "hr-viewer",
                invited_by: "hr-viewer",
            });
            userService.getUsers.mockResolvedValue([hr, createdHr]);

            renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
            const amitRow = within((await screen.findByText("Amit User")).closest("li"));

            expect(amitRow.getByRole("button", { name: "Change manager" })).toBeInTheDocument();
        });

        it("hides the edit control from an HR admin who didn't create this HR admin", async () => {
            const hr = makeUser({ id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN });
            const otherCreator = makeUser({ id: "hr-other", first_name: "Rahul", role: ROLES.HR_ADMIN });
            const createdByOther = makeUser({
                id: "hr-created",
                first_name: "Amit",
                role: ROLES.HR_ADMIN,
                manager_id: "hr-other",
                invited_by: "hr-other",
            });
            userService.getUsers.mockResolvedValue([hr, otherCreator, createdByOther]);

            renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
            const amitRow = within((await screen.findByText("Amit User")).closest("li"));

            expect(amitRow.queryByRole("button", { name: "Change manager" })).not.toBeInTheDocument();
        });

        it("hides the edit control for a root HR admin (no invited_by) from every HR admin, including themself", async () => {
            const hr = makeUser({ id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN });
            const rootHr = makeUser({ id: "hr-root", first_name: "Amit", role: ROLES.HR_ADMIN });
            userService.getUsers.mockResolvedValue([hr, rootHr]);

            renderWithProviders(<EmployeesPage />, { authValue: hrAuthValue });
            const amitRow = within((await screen.findByText("Amit User")).closest("li"));

            expect(amitRow.queryByRole("button", { name: "Change manager" })).not.toBeInTheDocument();
        });
    });
});
