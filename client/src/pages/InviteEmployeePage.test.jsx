import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { InviteEmployeePage } from "./InviteEmployeePage.jsx";
import * as userService from "../services/userService.js";
import { makeUser } from "../tests/fixtures/users.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/userService.js");

const hrAuthValue = makeAuthValue({ user: { id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN } });

function renderPage() {
    return renderWithProviders(<InviteEmployeePage />, { authValue: hrAuthValue });
}

describe("InviteEmployeePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the form and a way back to the employee list", async () => {
        userService.getUsers.mockResolvedValue([]);
        renderPage();

        expect(await screen.findByLabelText(/first name/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /back to all employees/i })).toHaveAttribute(
            "href",
            "/dashboard/employees"
        );
    });

    it("asks who each role reports to, except HR admins who report to nobody", async () => {
        userService.getUsers.mockResolvedValue([makeUser({ role: ROLES.MANAGER })]);
        renderPage();
        await screen.findByLabelText(/first name/i);

        // Employee -> reports to a manager.
        expect(screen.getByLabelText("Manager")).toBeInTheDocument();

        // Manager -> reports to an HR admin instead.
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.MANAGER);
        expect(screen.getByLabelText("Reporting HR admin")).toBeInTheDocument();
        expect(screen.queryByLabelText("Manager")).not.toBeInTheDocument();

        // HR admin -> top of the tree, no reporting line at all.
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.HR_ADMIN);
        expect(screen.queryByLabelText("Reporting HR admin")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Manager")).not.toBeInTheDocument();
    });

    it("offers only HR admins as the reporting line for a new manager", async () => {
        userService.getUsers.mockResolvedValue([
            makeUser({ id: "hr-1", first_name: "Hema", role: ROLES.HR_ADMIN }),
            makeUser({ id: "mgr-1", first_name: "Manoj", role: ROLES.MANAGER }),
            makeUser({ id: "emp-1", first_name: "Asha", role: ROLES.EMPLOYEE }),
        ]);
        renderPage();
        await screen.findByLabelText(/first name/i);

        // As an employee, both the manager and the HR admin are valid choices.
        const asEmployee = screen.getByLabelText("Manager");
        expect(within(asEmployee).getByRole("option", { name: /Manoj/ })).toBeInTheDocument();
        expect(within(asEmployee).getByRole("option", { name: /Hema/ })).toBeInTheDocument();

        // As a manager, only the HR admin remains.
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.MANAGER);
        const asManager = screen.getByLabelText("Reporting HR admin");
        expect(within(asManager).getByRole("option", { name: /Hema/ })).toBeInTheDocument();
        expect(within(asManager).queryByRole("option", { name: /Manoj/ })).not.toBeInTheDocument();
    });

    it("clears an already-picked person when the role changes", async () => {
        userService.getUsers.mockResolvedValue([
            makeUser({ id: "hr-1", first_name: "Hema", role: ROLES.HR_ADMIN }),
            makeUser({ id: "mgr-1", first_name: "Manoj", role: ROLES.MANAGER }),
        ]);
        renderPage();
        await screen.findByLabelText(/first name/i);

        await userEvent.selectOptions(screen.getByLabelText("Manager"), "mgr-1");
        expect(screen.getByLabelText("Manager")).toHaveValue("mgr-1");

        // Manoj isn't a valid choice for a manager, so the selection must reset.
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.MANAGER);
        expect(screen.getByLabelText("Reporting HR admin")).toHaveValue("");
    });

    it("submits a manager with the HR admin they report to", async () => {
        userService.getUsers.mockResolvedValue([makeUser({ id: "hr-1", first_name: "Hema", role: ROLES.HR_ADMIN })]);
        userService.inviteEmployee.mockResolvedValue({
            user: makeUser({ id: "new-2" }),
            inviteLink: "http://localhost:5173/invite/mgr-link",
        });

        renderPage();
        await screen.findByLabelText(/first name/i);

        await userEvent.type(screen.getByLabelText(/first name/i), "New");
        await userEvent.type(screen.getByLabelText(/last name/i), "Manager");
        await userEvent.type(screen.getByLabelText(/email/i), "mgr@example.com");
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.MANAGER);
        await userEvent.selectOptions(screen.getByLabelText("Reporting HR admin"), "hr-1");
        await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));

        expect(userService.inviteEmployee).toHaveBeenCalledWith(
            expect.objectContaining({ role: ROLES.MANAGER, managerId: "hr-1" })
        );
    });

    it("submits the invite and shows the returned invite link", async () => {
        const manager = makeUser({ id: "mgr-1", role: ROLES.MANAGER });
        userService.getUsers.mockResolvedValue([manager]);
        userService.inviteEmployee.mockResolvedValue({
            user: makeUser({ id: "new-1" }),
            inviteLink: "http://localhost:5173/invite/abc123",
        });

        renderPage();
        await screen.findByLabelText(/first name/i);

        await userEvent.type(screen.getByLabelText(/first name/i), "New");
        await userEvent.type(screen.getByLabelText(/last name/i), "Hire");
        await userEvent.type(screen.getByLabelText(/email/i), "new@example.com");
        await userEvent.selectOptions(screen.getByLabelText(/manager/i), "mgr-1");
        await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));

        expect(userService.inviteEmployee).toHaveBeenCalledWith(
            expect.objectContaining({
                firstName: "New",
                lastName: "Hire",
                email: "new@example.com",
                managerId: "mgr-1",
            })
        );
        expect(await screen.findByText(/abc123/)).toBeInTheDocument();
    });

    it("rejects an email the browser would accept but the server won't", async () => {
        userService.getUsers.mockResolvedValue([]);
        renderPage();
        await screen.findByLabelText(/first name/i);

        await userEvent.type(screen.getByLabelText(/first name/i), "Viraj");
        await userEvent.type(screen.getByLabelText(/last name/i), "Kumar");
        // type="email" considers a dot-less domain valid; the server does not.
        await userEvent.type(screen.getByLabelText(/email/i), "viraj@123");
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.HR_ADMIN);
        await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email address");
        expect(userService.inviteEmployee).not.toHaveBeenCalled();
    });

    it("shows the server's field-level detail rather than a bare 'Validation failed'", async () => {
        userService.getUsers.mockResolvedValue([]);
        userService.inviteEmployee.mockRejectedValue({
            response: {
                status: 422,
                data: {
                    message: "Validation failed",
                    errors: [{ field: "email", message: "Enter a valid email address" }],
                },
            },
        });

        renderPage();
        await screen.findByLabelText(/first name/i);

        await userEvent.type(screen.getByLabelText(/first name/i), "Viraj");
        await userEvent.type(screen.getByLabelText(/last name/i), "Kumar");
        await userEvent.type(screen.getByLabelText(/email/i), "viraj@example.com");
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.HR_ADMIN);
        await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Enter a valid email address");
        expect(alert).not.toHaveTextContent("Validation failed");
    });

    it("surfaces a failed invite without clearing the form", async () => {
        userService.getUsers.mockResolvedValue([]);
        userService.inviteEmployee.mockRejectedValue({
            response: { data: { message: "Email already in use" } },
        });

        renderPage();
        await screen.findByLabelText(/first name/i);

        await userEvent.type(screen.getByLabelText(/first name/i), "New");
        await userEvent.type(screen.getByLabelText(/last name/i), "Hire");
        await userEvent.type(screen.getByLabelText(/email/i), "taken@example.com");
        // HR admin needs no reporting line, keeping this focused on the error path.
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.HR_ADMIN);
        await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Email already in use");
        expect(screen.getByLabelText(/first name/i)).toHaveValue("New");
    });
});
