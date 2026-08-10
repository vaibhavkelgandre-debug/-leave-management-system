import { useEffect, useState } from "react";
import { getTeamLeaveRequests } from "../services/leaveRequestService.js";

// Count of SUBMITTED (arrived, no decision yet) requests in the caller's own
// team-scoped list — the same data ApprovalsPage already fetches, just
// counted instead of rendered, so the sidebar's Approvals link can show how
// many are waiting. `enabled` skips the fetch entirely for anyone who can't
// see that link at all (most employees), instead of every page load quietly
// calling an endpoint whose result they'll never use.
export function usePendingApprovalsCount(enabled) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        // Guard the fetch, not a reset of `count` — calling setState
        // synchronously in an effect body just to null things out trips
        // eslint-plugin-react-hooks's set-state-in-effect rule (see
        // rules.md). Instead this is gated at the return statement below:
        // `enabled` flipping to false makes the hook report 0 regardless of
        // whatever `count` last held, without touching state here.
        if (!enabled) {
            return undefined;
        }

        let cancelled = false;

        getTeamLeaveRequests()
            .then((requests) => {
                if (cancelled) return;
                setCount(requests.filter((request) => request.status === "SUBMITTED").length);
            })
            .catch(() => {
                if (cancelled) return;
                setCount(0);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return enabled ? count : 0;
}
