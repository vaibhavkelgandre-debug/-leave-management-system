// Dashboard tile: the flip side of DelegationStatus.jsx — tells a user
// they've been nominated as someone else's delegate, since nothing else
// does (createDelegation never asks the delegate, and there's no email/push
// notification system in this app). Shown to every role, unlike
// DelegationStatus which is manager-only — the nominee can just as easily
// be a plain EMPLOYEE.
import { Repeat } from "lucide-react";
import { useActiveDelegation } from "../../hooks/useActiveDelegation.js";
import { Card } from "../ui/Card.jsx";
import { formatDateKey } from "../../utils/dates.js";

export function DelegateStatus() {
    const { activeDelegations, loaded } = useActiveDelegation();

    if (!loaded || activeDelegations.length === 0) {
        return null;
    }

    return (
        <Card className="flex flex-col gap-2 border-amber-100 bg-amber-50/50 p-4">
            {activeDelegations.map((delegation) => (
                <div key={delegation.id} className="flex items-center gap-3">
                    <Repeat className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                    <p className="text-sm text-amber-900">
                        You're covering{" "}
                        <strong>
                            {delegation.manager_first_name} {delegation.manager_last_name}
                        </strong>
                        's approvals until {formatDateKey(delegation.end_date)}.
                    </p>
                </div>
            ))}
        </Card>
    );
}
