// The "View all" destination from NotificationBell.jsx's dropdown — the
// same notifications, paginated instead of capped at the dropdown's most
// recent 10, with a "Mark all read" action.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../services/notificationService.js";
import { getNotificationRoute } from "../utils/notificationRouting.js";
import { formatDateTime } from "../utils/dates.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";

const PAGE_SIZE = 20;

export function NotificationsPage() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    useEffect(() => {
        let cancelled = false;

        getNotifications({ limit: PAGE_SIZE, offset })
            .then((data) => {
                if (cancelled) return;
                setNotifications(data.notifications);
                setTotal(data.total);
                setLoadError(null);
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setLoadError("Unable to load notifications");
                setLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, [offset, reloadToken]);

    // Best-effort mark-read (its own failure shouldn't block navigating to
    // wherever the notification actually points).
    function handleSelect(notification) {
        markNotificationRead(notification.id).catch(() => {});
        const { pathname, state } = getNotificationRoute(notification);
        navigate(pathname, state ? { state } : undefined);
    }

    async function handleMarkAllRead() {
        try {
            await markAllNotificationsRead();
            reload();
        } catch {
            // Non-critical UI action — the list just stays as-is if this fails.
        }
    }

    const hasUnread = notifications.some((notification) => !notification.is_read);
    const hasPrevious = offset > 0;
    const hasNext = offset + PAGE_SIZE < total;

    return (
        <div>
            <PageHeader
                title="Notifications"
                description="Updates on leave requests, profile verification and salary slips."
                action={
                    hasUnread ? (
                        <Button icon={CheckCheck} variant="secondary" onClick={handleMarkAllRead}>
                            Mark all read
                        </Button>
                    ) : null
                }
            />

            {!loaded && (
                <p role="status" className="mt-6 text-sm text-slate-500">
                    Loading…
                </p>
            )}
            {loadError && (
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {loadError}
                </p>
            )}
            {loaded && !loadError && notifications.length === 0 && (
                <p className="mt-6 text-sm text-slate-500">You don't have any notifications yet.</p>
            )}
            {loaded && !loadError && notifications.length > 0 && (
                <Card className="mt-6 overflow-hidden">
                    <ul className="divide-y divide-slate-100">
                        {notifications.map((notification) => (
                            <li key={notification.id}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(notification)}
                                    className={`block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${
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
                </Card>
            )}

            {loaded && !loadError && total > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <span>
                        Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!hasPrevious}
                            onClick={() => setOffset((prev) => Math.max(prev - PAGE_SIZE, 0))}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!hasNext}
                            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
