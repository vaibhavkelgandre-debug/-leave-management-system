// A manager's own nominated delegations — read-only (no revoke endpoint
// exists; the brief only asks for nominate + act-during-window).
import { Card } from "../ui/Card.jsx";
import { formatDateRange } from "../../utils/dates.js";

export function DelegationList({ delegations }) {
    return (
        <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {delegations.map((delegation) => (
                    <li key={delegation.id} className="px-4 py-3">
                        <span className="font-semibold text-slate-900">
                            {delegation.delegate_first_name} {delegation.delegate_last_name}
                        </span>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {formatDateRange(delegation.start_date, delegation.end_date)}
                        </p>
                    </li>
                ))}
            </ul>
        </Card>
    );
}
