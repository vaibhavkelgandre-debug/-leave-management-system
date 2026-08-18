// Thin HTTP glue for notifications — every handler just pulls from `req`,
// calls one notificationService function, and reports success/failure. All
// business logic (recipient resolution, ownership checks) lives in the
// service, not here — same layering as every other controller in this app.
import * as notificationService from "../services/notificationService.js";
import { sendSuccess } from "../utils/apiResponse.js";

// Input: `req.query` (already validated/coerced by
// validateQuery(listNotificationsQuerySchema)). Output: the caller's own
// notifications, newest first, plus a total count for pagination.
export async function list(req, res, next) {
    try {
        const result = await notificationService.listNotifications(req.user, req.query);
        sendSuccess(res, 200, "Notifications retrieved", result);
    } catch (error) {
        next(error);
    }
}

// Backs the nav bell's badge count.
export async function unreadCount(req, res, next) {
    try {
        const count = await notificationService.getUnreadCount(req.user);
        sendSuccess(res, 200, "Unread count retrieved", { count });
    } catch (error) {
        next(error);
    }
}

// Marks one notification read. `req.user.id` is who the service checks
// ownership against — a client can never mark someone else's notification
// read, regardless of what id is in the URL.
export async function markRead(req, res, next) {
    try {
        const notification = await notificationService.markAsRead(req.user, req.params.id);
        sendSuccess(res, 200, "Notification marked as read", { notification });
    } catch (error) {
        next(error);
    }
}

export async function markAllRead(req, res, next) {
    try {
        const result = await notificationService.markAllAsRead(req.user);
        sendSuccess(res, 200, "All notifications marked as read", result);
    } catch (error) {
        next(error);
    }
}
