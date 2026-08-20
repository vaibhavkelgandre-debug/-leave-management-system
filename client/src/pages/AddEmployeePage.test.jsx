import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { AddEmployeePage } from "./AddEmployeePage.jsx";
import * as userService from "../services/userService.js";
import { makeUser } from "../tests/fixtures/users.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/userService.js");

const hrAuthValue = makeAuthValue({ user: { id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN } });

describe("AddEmployeePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userService.getUserOptions.mockResolvedValue([makeUser({ id: "hr-viewer", role: ROLES.HR_ADMIN })]);
    });

    it("renders the invite form directly on the page, not behind a modal", async () => {
        renderWithProviders(<AddEmployeePage />, { authValue: hrAuthValue });

        expect(await screen.findByLabelText(/first name/i)).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Where "back" points depends on the role: All Employees is
    // SUPER_ADMIN-only now, so sending an HR admin there would bounce them to
    // /403 on the way out of an invite they just completed.
    it("sends an HR admin back to My Team", async () => {
        renderWithProviders(<AddEmployeePage />, { authValue: hrAuthValue });
        await screen.findByLabelText(/first name/i);

        expect(screen.getByRole("link", { name: /back to my team/i })).toHaveAttribute("href", "/dashboard/team");
    });

    it("sends SUPER_ADMIN back to All Employees", async () => {
        renderWithProviders(<AddEmployeePage />, {
            authValue: makeAuthValue({ user: { id: "super-1", first_name: "Sam", role: ROLES.SUPER_ADMIN } }),
        });
        await screen.findByLabelText(/first name/i);

        expect(screen.getByRole("link", { name: /back to all employees/i })).toHaveAttribute(
            "href",
            "/dashboard/employees"
        );
    });

    it("shows the generated invite link right on the page after a successful invite", async () => {
        userService.inviteEmployee.mockResolvedValue({
            user: makeUser({ id: "new-1" }),
            inviteLink: "http://localhost:5173/invite/abc123",
        });

        renderWithProviders(<AddEmployeePage />, { authValue: hrAuthValue });
        await screen.findByLabelText(/first name/i);

        await userEvent.type(screen.getByLabelText(/first name/i), "New");
        await userEvent.type(screen.getByLabelText(/last name/i), "Hire");
        await userEvent.type(screen.getByLabelText(/email/i), "new@example.com");
        await userEvent.selectOptions(screen.getByLabelText(/role/i), ROLES.HR_ADMIN);
        await userEvent.click(screen.getByRole("button", { name: /^invite$/i }));

        expect(await screen.findByText(/abc123/)).toBeInTheDocument();
    });
});
