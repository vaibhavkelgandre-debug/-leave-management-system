import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { ROLES } from "../../constants/roles.js";

function renderSidebar(props = {}) {
    return renderWithProviders(
        <Sidebar collapsed={false} onToggleCollapse={vi.fn()} mobileOpen={false} onCloseMobile={vi.fn()} {...props} />,
        { authValue: makeAuthValue({ user: { id: "1", role: ROLES.EMPLOYEE } }) }
    );
}

describe("Sidebar", () => {
    it("renders the nav links via NavBar", () => {
        renderSidebar();
        expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    });

    it("calls onToggleCollapse when the collapse button is clicked", async () => {
        const onToggleCollapse = vi.fn();
        renderSidebar({ onToggleCollapse });

        await userEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));

        expect(onToggleCollapse).toHaveBeenCalled();
    });

    it("calls onCloseMobile when the mobile close button is clicked", async () => {
        const onCloseMobile = vi.fn();
        renderSidebar({ onCloseMobile, mobileOpen: true });

        await userEvent.click(screen.getByRole("button", { name: /close menu/i }));

        expect(onCloseMobile).toHaveBeenCalled();
    });

    it("centers the logo row when collapsed — it's the only visible child at that width, since the mobile close button is lg:hidden", () => {
        renderSidebar({ collapsed: true });
        const logoLink = screen.getByRole("link", { name: "L" });

        expect(logoLink.parentElement.className).toContain("lg:justify-center");
    });

    it("doesn't force centering when expanded — the logo lockup naturally left-aligns beside the (still-hidden-on-desktop) close button", () => {
        renderSidebar({ collapsed: false });
        const logoLink = screen.getByRole("link", { name: /LMS/i });

        expect(logoLink.parentElement.className).not.toContain("lg:justify-center");
    });
});
