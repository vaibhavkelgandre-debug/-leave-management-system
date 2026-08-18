import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { TopBar } from "./TopBar.jsx";
import { ROLES } from "../../constants/roles.js";
import * as notificationService from "../../services/notificationService.js";

// TopBar now renders NotificationBell.jsx, which fetches its own unread
// count on mount (useUnreadNotificationCount.js) — same reasoning as every
// other component in this app that owns its own fetch (see
// TeamOverviewSummary.test.jsx), this file's tests aren't about the bell
// itself (see NotificationBell.test.jsx for that), so its calls are just
// stubbed to an empty/zero state here.
vi.mock("../../services/notificationService.js");

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
    beforeEach(() => {
        vi.clearAllMocks();
        notificationService.getUnreadNotificationCount.mockResolvedValue(0);
    });

    it("renders no page-title heading of its own — every page's own PageHeader owns that", () => {
        renderTopBar();
        expect(screen.queryByRole("heading")).not.toBeInTheDocument();
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

    it("opens a dropdown from the identity block with a Profile details link and a Change password action", async () => {
        renderTopBar();

        expect(screen.queryByRole("link", { name: /profile details/i })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /asha employee/i }));

        expect(screen.getByRole("link", { name: /profile details/i })).toHaveAttribute("href", "/dashboard/profile");

        await userEvent.click(screen.getByRole("button", { name: /change password/i }));
        expect(await screen.findByRole("dialog", { name: /change password/i })).toBeInTheDocument();
    });
});
