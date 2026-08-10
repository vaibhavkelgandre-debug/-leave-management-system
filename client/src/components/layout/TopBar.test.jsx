import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { TopBar } from "./TopBar.jsx";
import { ROLES } from "../../constants/roles.js";

function renderTopBar(overrides = {}) {
    const logout = vi.fn().mockResolvedValue();
    const authValue = makeAuthValue({
        user: { id: "1", first_name: "Asha", last_name: "Employee", role: ROLES.MANAGER },
        logout,
        ...overrides,
    });
    renderWithProviders(<TopBar onOpenMobileMenu={vi.fn()} />, { authValue });
    return { logout };
}

describe("TopBar", () => {
    it("shows the current page's title", () => {
        renderTopBar();
        expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });

    it("filters nav items as the user types in the search box", async () => {
        renderTopBar();

        await userEvent.type(screen.getByPlaceholderText(/search the menu/i), "team");

        expect(await screen.findByRole("link", { name: /my team/i })).toBeInTheDocument();
    });

    it("shows the logged-in user's name and role", () => {
        renderTopBar();
        expect(screen.getByText("Asha Employee")).toBeInTheDocument();
        expect(screen.getByText(/manager/i)).toBeInTheDocument();
    });

    it("logs out when Logout is clicked", async () => {
        const { logout } = renderTopBar();

        await userEvent.click(screen.getByRole("button", { name: /logout/i }));

        expect(logout).toHaveBeenCalled();
    });
});
