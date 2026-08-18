// Dashboard tile: the current user's own leave at a glance — condensed
// balances plus a snapshot of their requests. Shown to every role, since
// everyone (including managers and HR) has their own leave to track.
import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Clock } from "lucide-react";
import { getMyBalances } from "../../services/leaveBalanceService.js";
import { getMyLeaveRequests } from "../../services/leaveRequestService.js";
import { Card } from "../ui/Card.jsx";
import { StatusBadge } from "../ui/Badge.jsx";
import { LEAVE_BALANCE_ACCENTS } from "../../constants/leaveBalanceAccents.js";
import { formatDateRange, todayDateKey } from "../../utils/dates.js";

const captionClasses = "text-[11px] font-medium tracking-wide text-slate-400 uppercase";

export function MyLeaveSummary() {
    const [balances, setBalances] = useState(null);
    const [requests, setRequests] = useState(null);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getMyBalances({}), getMyLeaveRequests()])
            .then(([balanceData, requestData]) => {
                if (cancelled) return;
                setBalances(balanceData);
                setRequests(requestData);
            })
            .catch(() => {
                if (cancelled) return;
                setBalances([]);
                setRequests([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (balances === null || requests === null) {
        return (
            <Card className="p-6">
                <p role="status" className="text-sm text-slate-500">
                    Loading…
                </p>
            </Card>
        );
    }

    const today = todayDateKey();
    const pendingCount = requests.filter((request) => request.status === "SUBMITTED").length;

    // Soonest future approved leave, if any.
    const upcoming = requests
        .filter((request) => request.status === "APPROVED" && request.start_date > today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

    // Most recent time someone else decided one of this user's requests —
    // withdrawn/cancelled are self-initiated, so they don't count as a
    // "decision" worth surfacing here.
    const lastDecision = requests
        .filter((request) => (request.status === "APPROVED" || request.status === "REJECTED") && request.decided_at)
        .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0];

    return (
        <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900">My leave</h2>

            {balances.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {balances.map((balance, index) => {
                        const accent = LEAVE_BALANCE_ACCENTS[index % LEAVE_BALANCE_ACCENTS.length];
                        return (
                            <span
                                key={balance.id}
                                className={`rounded-lg px-3 py-2 text-xs text-slate-600 ${accent.bg}`}
                            >
                                <span className={`font-semibold ${accent.text}`}>
                                    {Number(balance.days_remaining)}
                                </span>{" "}
                                {balance.leave_type_name}
                            </span>
                        );
                    })}
                </div>
            ) : (
                <p className="mt-3 text-sm text-slate-500">No leave types have been set up yet.</p>
            )}

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
                <div className="flex items-center gap-2.5">
                    <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            pendingCount > 0 ? "bg-amber-100" : "bg-emerald-100"
                        }`}
                    >
                        {pendingCount > 0 ? (
                            <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                        ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        )}
                    </span>
                    <p className="text-slate-600">
                        {pendingCount > 0 ? (
                            <>
                                <span className="font-semibold text-slate-900">{pendingCount}</span>{" "}
                                request{pendingCount === 1 ? "" : "s"} waiting on a decision.
                            </>
                        ) : (
                            "No requests waiting on a decision."
                        )}
                    </p>
                </div>

                {upcoming && (
                    <div>
                        <p className={captionClasses}>Next leave</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-slate-600">
                            <CalendarClock className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
                            {upcoming.leave_type_name}, {formatDateRange(upcoming.start_date, upcoming.end_date)}
                        </p>
                    </div>
                )}

                {lastDecision && (
                    <div>
                        <p className={captionClasses}>Last decision</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-slate-600">
                            <StatusBadge status={lastDecision.status} />
                            <span>
                                {lastDecision.leave_type_name} ({formatDateRange(lastDecision.start_date, lastDecision.end_date)})
                                {lastDecision.decision_comment && ` — "${lastDecision.decision_comment}"`}
                            </span>
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}
