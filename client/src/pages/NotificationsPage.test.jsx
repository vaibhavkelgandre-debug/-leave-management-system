import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../tests/renderWithProviders.jsx";
import { NotificationsPage } from "./NotificationsPage.jsx";
import * as notificationService from "../services/notificationService.js";

vi.mock("../services/notificationService.js");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

function makeNotification(overrides = {}) {
    return {
        id: "n1",
        type: "SALARY_SLIP_GENERATED",
        entity_type: "SALARY_SLIP",
        entity_id: "slip-1",
        message: "Your salary slip for August 2026 is available",
        is_read: false,
        created_at: "2030-01-05T09:00:00Z",
        ...overrides,
    };
}

describe("NotificationsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        notificationService.markNotificationRead.mockResolvedValue({});
        notificationService.markAllNotificationsRead.mockResolvedValue({ updated: 0 });
    });

    it("shows an empty state when there are no notifications", async () => {
        notificationService.getNotifications.mockResolvedValue({ notifications: [], total: 0 });
        renderWithProviders(<NotificationsPage />);

        expect(await screen.findByText(/don't have any notifications yet/i)).toBeInTheDocument();
    });

    it("lists notifications and marks one read then navigates when clicked", async () => {
        notificationService.getNotifications.mockResolvedValue({
            notifications: [makeNotification()],
            total: 1,
        });
        renderWithProviders(<NotificationsPage />);

        await userEvent.click(await screen.findByText("Your salary slip for August 2026 is available"));

        expect(notificationService.markNotificationRead).toHaveBeenCalledWith("n1");
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/salary-slips", undefined);
    });

    it("only shows Mark all read when something is unread", async () => {
        notificationService.getNotifications.mockResolvedValue({
            notifications: [makeNotification({ is_read: true })],
            total: 1,
        });
        renderWithProviders(<NotificationsPage />);

        await screen.findByText(/available/i);
        expect(screen.queryByRole("button", { name: /mark all read/i })).not.toBeInTheDocument();
    });

    it("marks everything read and reloads when Mark all read is clicked", async () => {
        notificationService.getNotifications.mockResolvedValue({
            notifications: [makeNotification()],
            total: 1,
        });
        renderWithProviders(<NotificationsPage />);

        await userEvent.click(await screen.findByRole("button", { name: /mark all read/i }));

        expect(notificationService.markAllNotificationsRead).toHaveBeenCalled();
        expect(notificationService.getNotifications).toHaveBeenCalledTimes(2);
    });

    it("paginates in pages of 20, disabling Previous on the first page and enabling Next when more remain", async () => {
        notificationService.getNotifications.mockResolvedValue({
            notifications: [makeNotification()],
            total: 45,
        });
        renderWithProviders(<NotificationsPage />);

        expect(await screen.findByText("Showing 1–20 of 45")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
        expect(screen.getByRole("button", { name: /^next$/i })).not.toBeDisabled();

        await userEvent.click(screen.getByRole("button", { name: /^next$/i }));

        expect(notificationService.getNotifications).toHaveBeenCalledWith({ limit: 20, offset: 20 });
    });
});
