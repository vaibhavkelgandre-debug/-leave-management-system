import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
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

    it("shows the manager field only when the role is Employee", async () => {
        userService.getUsers.mockResolvedValue([makeUser({ role: ROLES.MANAGER })]);
        renderPage();
        await screen.findByLabelText(/first name/i);

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
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.MANAGER);
        await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Email already in use");
        expect(screen.getByLabelText(/first name/i)).toHaveValue("New");
    });
});
