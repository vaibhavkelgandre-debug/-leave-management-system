import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { NotificationBell } from "./NotificationBell.jsx";
import * as notificationService from "../../services/notificationService.js";

vi.mock("../../services/notificationService.js");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

function makeNotification(overrides = {}) {
    return {
        id: "n1",
        type: "LEAVE_REQUEST_DECIDED",
        entity_type: "LEAVE_REQUEST",
        entity_id: "req-1",
        message: "Your Sick Leave request was approved",
        is_read: false,
        created_at: "2030-01-05T09:00:00Z",
        ...overrides,
    };
}

describe("NotificationBell", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        notificationService.getUnreadNotificationCount.mockResolvedValue(0);
        notificationService.getNotifications.mockResolvedValue({ notifications: [], total: 0 });
        notificationService.markNotificationRead.mockResolvedValue({});
        notificationService.markAllNotificationsRead.mockResolvedValue({ updated: 0 });
    });

    it("shows no badge when there are no unread notifications", async () => {
        renderWithProviders(<NotificationBell />);
        await screen.findByRole("button", { name: /^notifications$/i });
        expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    });

    it("shows the unread count on the badge", async () => {
        notificationService.getUnreadNotificationCount.mockResolvedValue(3);
        renderWithProviders(<NotificationBell />);

        expect(await screen.findByText("3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /notifications \(3 unread\)/i })).toBeInTheDocument();
    });

    it("caps the badge at 9+ for double-digit counts", async () => {
        notificationService.getUnreadNotificationCount.mockResolvedValue(42);
        renderWithProviders(<NotificationBell />);
        expect(await screen.findByText("9+")).toBeInTheDocument();
    });

    it("shows an empty state when the dropdown is opened with nothing to show", async () => {
        renderWithProviders(<NotificationBell />);

        await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));

        expect(await screen.findByText(/you're all caught up/i)).toBeInTheDocument();
    });

    it("lists notifications when the dropdown is opened, newest first as given by the API", async () => {
        notificationService.getUnreadNotificationCount.mockResolvedValue(1);
        notificationService.getNotifications.mockResolvedValue({
            notifications: [makeNotification()],
            total: 1,
        });
        renderWithProviders(<NotificationBell />);

        await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));

        expect(await screen.findByText("Your Sick Leave request was approved")).toBeInTheDocument();
    });

    it("marks a clicked notification read and navigates to its resolved route", async () => {
        notificationService.getUnreadNotificationCount.mockResolvedValue(1);
        notificationService.getNotifications.mockResolvedValue({
            notifications: [makeNotification()],
            total: 1,
        });
        renderWithProviders(<NotificationBell />);

        await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
        await userEvent.click(await screen.findByText("Your Sick Leave request was approved"));

        expect(notificationService.markNotificationRead).toHaveBeenCalledWith("n1");
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/my-leave", { state: { selectedRequestId: "req-1" } });
    });

    it("only offers Mark all read when something is unread, and clears the list's unread styling once clicked", async () => {
        notificationService.getUnreadNotificationCount.mockResolvedValue(1);
        notificationService.getNotifications.mockResolvedValue({
            notifications: [makeNotification()],
            total: 1,
        });
        renderWithProviders(<NotificationBell />);

        await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));
        const markAllButton = await screen.findByRole("button", { name: /mark all read/i });

        await userEvent.click(markAllButton);

        expect(notificationService.markAllNotificationsRead).toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: /mark all read/i })).not.toBeInTheDocument();
    });

    it("links to the full notifications page", async () => {
        renderWithProviders(<NotificationBell />);
        await userEvent.click(await screen.findByRole("button", { name: /notifications/i }));

        expect(await screen.findByRole("link", { name: /view all/i })).toHaveAttribute(
            "href",
            "/dashboard/notifications"
        );
    });
});
