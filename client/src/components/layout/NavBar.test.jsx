import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { NavBar } from "./NavBar.jsx";
import { ROLES } from "../../constants/roles.js";

function renderNav(role) {
    return renderWithProviders(<NavBar />, {
        authValue: makeAuthValue({ user: { id: "1", role } }),
    });
}

describe("NavBar", () => {
    it("shows only Dashboard for an EMPLOYEE", () => {
        renderNav(ROLES.EMPLOYEE);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /my team/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /all employees/i })).not.toBeInTheDocument();
    });

    it("shows Dashboard and My Team, but not All Employees, for a MANAGER", () => {
        renderNav(ROLES.MANAGER);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my team/i })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /all employees/i })).not.toBeInTheDocument();
    });

    it("shows all links for HR_ADMIN", () => {
        renderNav(ROLES.HR_ADMIN);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my team/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /all employees/i })).toBeInTheDocument();
    });
});
