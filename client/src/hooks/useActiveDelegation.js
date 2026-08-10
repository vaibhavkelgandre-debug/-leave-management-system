import { useEffect, useState } from "react";
import { getDelegationsAsDelegate } from "../services/delegationService.js";
import { todayDateKey } from "../utils/dates.js";

// Delegations where the current user is standing in for someone else,
// filtered down to the ones active right now — shared by NavBar (to reveal
// the Approvals link for a plain employee currently covering someone) and
// DelegateStatus (the dashboard tile) so both agree on what "active" means
// without duplicating the fetch-then-filter logic.
export function useActiveDelegation() {
    const [activeDelegations, setActiveDelegations] = useState([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getDelegationsAsDelegate()
            .then((delegations) => {
                if (cancelled) return;
                const today = todayDateKey();
                setActiveDelegations(
                    delegations.filter((delegation) => delegation.start_date <= today && delegation.end_date >= today)
                );
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setActiveDelegations([]);
                setLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { activeDelegations, loaded, hasActiveDelegation: activeDelegations.length > 0 };
}
