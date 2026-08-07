// Dashboard tile: only rendered when the current manager has an active
// delegate covering approvals today — stays silent (returns null) otherwise,
// so it doesn't clutter the dashboard when there's nothing to say.
import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { getMyDelegations } from "../../services/delegationService.js";
import { Card } from "../ui/Card.jsx";
import { formatDateKey, todayDateKey } from "../../utils/dates.js";

export function DelegationStatus() {
    const [activeDelegation, setActiveDelegation] = useState(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getMyDelegations()
            .then((delegations) => {
                if (cancelled) return;
                const today = todayDateKey();
                const active = delegations.find((delegation) => delegation.start_date <= today && delegation.end_date >= today);
                setActiveDelegation(active || null);
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (!loaded || !activeDelegation) {
        return null;
    }

    return (
        <Card className="flex items-center gap-3 border-indigo-100 bg-indigo-50/50 p-4">
            <Repeat className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
            <p className="text-sm text-indigo-900">
                <strong>
                    {activeDelegation.delegate_first_name} {activeDelegation.delegate_last_name}
                </strong>{" "}
                is covering your approvals until {formatDateKey(activeDelegation.end_date)}.
            </p>
        </Card>
    );
}
