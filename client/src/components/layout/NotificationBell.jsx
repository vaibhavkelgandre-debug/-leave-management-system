// The nav bell: unread badge + a dropdown of the most recent notifications,
// each of which marks itself read and deep-links to the relevant page/modal
// on click (getNotificationRoute). Reverses TopBar.jsx's old "no
// notifications bell" decision — see rules.md for why that's a deliberate,
// explicitly re-requested change, not scope creep.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useUnreadNotificationCount } from "../../hooks/useUnreadNotificationCount.js";
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from "../../services/notificationService.js";
import { getNotificationRoute } from "../../utils/notificationRouting.js";
import { formatDateTime } from "../../utils/dates.js";

const DROPDOWN_PAGE_SIZE = 10;

export function NotificationBell() {
    const navigate = useNavigate();
    const { count, refresh } = useUnreadNotificationCount();
    const [open, setOpen] = useState(false);
    // `null` means "not fetched for the current open yet" — distinct from an
    // empty array, so loading/empty can be derived instead of tracked as a
    // separate flag that would need setting synchronously at the top of the
    // effect below (the exact shape rules.md warns against).
    const [notifications, setNotifications] = useState(null);
    const [error, setError] = useState(null);
    const menuRef = useRef(null);
    useClickOutside(menuRef, () => setOpen(false), open);
    const loading = open && notifications === null && !error;

    // Fetches the latest page fresh every time the dropdown opens rather than
    // keeping it in sync while closed — nothing needs to stay live for a
    // panel the user isn't even looking at.
    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;

        getNotifications({ limit: DROPDOWN_PAGE_SIZE })
            .then(({ notifications: data }) => {
                if (cancelled) return;
                setNotifications(data);
                setError(null);
            })
            .catch(() => {
                if (cancelled) return;
                setError("Unable to load notifications");
            });

        return () => {
            cancelled = true;
        };
    }, [open]);

    // Marks the notification read and navigates to wherever it points —
    // mark-read is best-effort (its own failure shouldn't block the
    // navigation the user actually clicked for).
    function handleSelect(notification) {
        setOpen(false);
        const { pathname, state } = getNotificationRoute(notification);
        markNotificationRead(notification.id)
            .then(refresh)
            .catch(() => {});
        navigate(pathname, state ? { state } : undefined);
    }

    async function handleMarkAllRead() {
        try {
            await markAllNotificationsRead();
            setNotifications((prev) => (prev ?? []).map((notification) => ({ ...notification, is_read: true })));
            refresh();
        } catch {
            // Non-critical UI action — the badge just won't update if this fails.
        }
    }

    return (
        <div ref={menuRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open}
                aria-haspopup="true"
                aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
                className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {count > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
                    >
                        {count > 9 ? "9+" : count}
                    </span>
                )}
            </button>

            {/* Native `hidden`, not unmounting — same reasoning as
                TopBar.jsx's UserIdentity dropdown: cheaper to toggle than to
                remount the list/fetch on every open. */}
            <div
                hidden={!open}
                className="absolute right-0 z-30 mt-1 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    {notifications?.some((notification) => !notification.is_read) && (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Mark all read
                        </button>
                    )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {loading && (
                        <p role="status" className="px-3 py-4 text-center text-sm text-slate-500">
                            Loading…
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="px-3 py-4 text-center text-sm text-red-600">
                            {error}
                        </p>
                    )}
                    {!loading && !error && notifications?.length === 0 && (
                        <p className="px-3 py-4 text-center text-sm text-slate-500">You're all caught up.</p>
                    )}
                    {!loading && !error && notifications && notifications.length > 0 && (
                        <ul className="divide-y divide-slate-100">
                            {notifications.map((notification) => (
                                <li key={notification.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(notification)}
                                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                            notification.is_read ? "text-slate-500" : "font-medium text-slate-900"
                                        }`}
                                    >
                                        <span className="block">{notification.message}</span>
                                        <span className="mt-0.5 block text-xs font-normal text-slate-400">
                                            {formatDateTime(notification.created_at)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <Link
                    to="/dashboard/notifications"
                    onClick={() => setOpen(false)}
                    className="block border-t border-slate-100 px-3 py-2 text-center text-sm font-medium text-indigo-600 hover:bg-slate-50 hover:text-indigo-700"
                >
                    View all
                </Link>
            </div>
        </div>
    );
}
