import { useEffect, useState } from "react";
import { getPendingApprovalsCount } from "../services/leaveRequestService.js";

// Count of SUBMITTED requests the caller can actually act on right now, for
// the sidebar's Approvals badge.
//
// Resolved by the server (GET /leave-requests/pending-count) rather than by
// fetching the team list and filtering it here. That earlier shape downloaded
// every request in the caller's team scope — thousands of rows, several
// megabytes at NFR-7's "200 employees and three years" target — on **every
// page load**, to display one integer. The rule itself didn't change: the
// employee's assigned manager is the caller, or a manager the caller is
// currently an active delegate for (see leaveRequestService.countPendingDecisions;
// it is the same rule canDecideDirectly applied here before).
//
// `enabled` still skips the request entirely for anyone who can't see the
// Approvals link at all, rather than every page load quietly calling an
// endpoint whose result they'll never use.
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

        getPendingApprovalsCount()
            .then((value) => {
                if (!cancelled) setCount(value);
            })
            .catch(() => {
                if (!cancelled) setCount(0);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return enabled ? count : 0;
}
