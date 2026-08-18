import apiClient, { unwrap } from "./apiClient.js";

// Output: `{ notifications, total }` for the caller's own notifications,
// newest first. `unreadOnly` narrows the list to just what's still unread;
// `limit`/`offset` back pagination on NotificationsPage.
export async function getNotifications({ unreadOnly, limit, offset } = {}) {
    const response = await apiClient.get("/notifications", { params: { unreadOnly, limit, offset } });
    return unwrap(response);
}

// Backs the nav bell's badge — polled by useUnreadNotificationCount.js.
export async function getUnreadNotificationCount() {
    const response = await apiClient.get("/notifications/unread-count");
    return unwrap(response).count;
}

export async function markNotificationRead(id) {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return unwrap(response);
}

export async function markAllNotificationsRead() {
    const response = await apiClient.patch("/notifications/read-all");
    return unwrap(response);
}
