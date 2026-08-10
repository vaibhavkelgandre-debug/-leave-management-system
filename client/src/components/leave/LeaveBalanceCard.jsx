// Extracted from MyBalancesPage.jsx so the dashboard home and the full
// /dashboard/my-leave page render the identical, already-tested
// entitlement/taken/pending/remaining breakdown instead of duplicating it.
import { CalendarHeart } from "lucide-react";
import { Card } from "../ui/Card.jsx";
import { ProgressBar } from "../ui/ProgressBar.jsx";

function balanceMessage(remaining, entitlement) {
    if (entitlement === 0) return "No entitlement set for this leave type.";
    if (remaining <= 0) return "You're all out for now — plan around this one.";
    if (remaining <= entitlement * 0.25) return "Running low — worth planning ahead.";
    return "Looking healthy — plenty left to plan around.";
}

export function LeaveBalanceCard({ balance, accent }) {
    const remaining = Number(balance.days_remaining);
    const entitlement = Number(balance.entitlement);
    const taken = Number(balance.days_taken);
    const pending = Number(balance.days_pending);
    const usedPercent = entitlement > 0 ? Math.min(100, Math.round(((taken + pending) / entitlement) * 100)) : 0;

    return (
        <Card className="p-5 transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-medium text-slate-500">{balance.leave_type_name}</h3>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">
                        {remaining}
                        <span className="ml-1 text-base font-normal text-slate-500">days left</span>
                    </p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accent.bg}`}>
                    <CalendarHeart className={`h-5 w-5 ${accent.text}`} aria-hidden="true" />
                </span>
            </div>

            <ProgressBar percent={usedPercent} barClassName={accent.bar} className="mt-4" />
            <p className="mt-2 text-xs text-slate-500">{balanceMessage(remaining, entitlement)}</p>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                    <dt className="text-[11px] text-slate-500">Entitlement</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">{entitlement}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                    <dt className="text-[11px] text-slate-500">Taken</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">{taken}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                    <dt className="text-[11px] text-slate-500">Pending</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">{pending}</dd>
                </div>
            </dl>
        </Card>
    );
}
