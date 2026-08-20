import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
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

    // The bar shows initials + role only (direct request). The name is the
    // trigger's accessible name, not visible text — dropping it outright would
    // have left a screen reader with "AE Manager".
    it("shows the role badge and the initials, but not the user's name, in the bar", () => {
        renderTopBar();

        const trigger = screen.getByRole("button", { name: /asha employee/i });
        expect(trigger.textContent).not.toMatch(/Asha Employee/);
        expect(trigger.textContent).toMatch(/AE/);
        expect(within(trigger).getByText(/manager/i)).toBeInTheDocument();
    });

    it("has no brand label of its own — the sidebar already carries the mark", () => {
        renderTopBar();
        expect(screen.queryByText(/leave management system/i)).not.toBeInTheDocument();
    });

    it("logs out from inside the account menu, not from the bar itself", async () => {
        const { logout } = renderTopBar();

        // Nothing to click until the menu is open.
        expect(screen.queryByRole("button", { name: /^logout$/i })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /asha employee/i }));
        await userEvent.click(screen.getByRole("button", { name: /^logout$/i }));

        expect(logout).toHaveBeenCalled();
    });

    it("opens a dropdown from the identity block with the user's name, a Profile details link and a Change password action", async () => {
        renderTopBar();

        expect(screen.queryByRole("link", { name: /profile details/i })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /asha employee/i }));

        // The name the trigger no longer shows lives here instead.
        expect(screen.getByText("Asha Employee")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /profile details/i })).toHaveAttribute("href", "/dashboard/profile");

        await userEvent.click(screen.getByRole("button", { name: /change password/i }));
        expect(await screen.findByRole("dialog", { name: /change password/i })).toBeInTheDocument();
    });

    // Width only: the bar is sticky, so animating its height would shift every
    // page under it on focus.
    it("grows the search box while it's focused, and shrinks it back on blur", async () => {
        renderTopBar();
        const input = screen.getByPlaceholderText(/search the menu/i);
        const box = input.parentElement;

        expect(box.className).toMatch(/max-w-xs/);

        await userEvent.click(input);
        expect(box.className).toMatch(/max-w-md/);
        expect(box.className).not.toMatch(/max-w-xs/);

        await userEvent.tab();
        expect(box.className).toMatch(/max-w-xs/);
    });

    // Blurring to click a result must not collapse the box out from under the
    // pointer, so the expanded state survives a blur while there's a query.
    it("stays expanded while a query is present, even after blur", async () => {
        renderTopBar();
        const input = screen.getByPlaceholderText(/search the menu/i);

        await userEvent.type(input, "team");
        await userEvent.tab();

        expect(input.parentElement.className).toMatch(/max-w-md/);
    });
});
