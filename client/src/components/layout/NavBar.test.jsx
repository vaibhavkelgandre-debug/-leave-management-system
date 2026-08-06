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
    it("shows the shared links but no team or HR links for an EMPLOYEE", () => {
        renderNav(ROLES.EMPLOYEE);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my leave/i })).toBeInTheDocument();
        // Everyone can see the holiday calendar — only the add/delete controls
        // inside the page are HR-only.
        expect(screen.getByRole("link", { name: /holiday calendar/i })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /my team/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /all employees/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /leave types/i })).not.toBeInTheDocument();
    });

    it("adds My Team, but no HR-only links, for a MANAGER", () => {
        renderNav(ROLES.MANAGER);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my leave/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /holiday calendar/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my team/i })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /all employees/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /leave types/i })).not.toBeInTheDocument();
    });

    it("shows all links for HR_ADMIN", () => {
        renderNav(ROLES.HR_ADMIN);
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my leave/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /my team/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /all employees/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /leave types/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /holiday calendar/i })).toBeInTheDocument();
    });
});
