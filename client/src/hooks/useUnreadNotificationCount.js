import { useCallback, useEffect, useState } from "react";
import { getUnreadNotificationCount } from "../services/notificationService.js";

const POLL_INTERVAL_MS = 30000;

// Polls the caller's unread notification count so the nav bell's badge
// stays roughly live without needing a websocket (none exists in this app —
// see rules.md) — fetch once on mount, then every 30s. `refresh()` lets the
// bell force an immediate update right after marking something read,
// instead of waiting up to 30s for the badge to catch up on its own.
export function useUnreadNotificationCount() {
    const [count, setCount] = useState(0);

    // `.then(setCount)`/`.catch` chained straight off the promise (not
    // routed through an intermediate async/await function) is the
    // established safe shape for setting state from inside an effect — see
    // usePendingApprovalsCount.js and every other own-data-fetching
    // component in this app.
    const refresh = useCallback(() => {
        getUnreadNotificationCount()
            .then(setCount)
            .catch(() => setCount(0));
    }, []);

    useEffect(() => {
        let cancelled = false;

        function poll() {
            getUnreadNotificationCount()
                .then((value) => {
                    if (!cancelled) setCount(value);
                })
                .catch(() => {
                    if (!cancelled) setCount(0);
                });
        }

        poll();
        const interval = setInterval(poll, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    return { count, refresh };
}
