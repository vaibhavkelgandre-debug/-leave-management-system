// Dashboard tile: the current user's own leave at a glance — pending count,
// next leave, and a leave-type picker over their own request history. Shown
// to every role, since everyone (including managers and HR) has their own
// leave to track.
//
// The balances used to render as one chip per leave type in a wrapping row.
// That was fine at two or three types and stopped working at five: the row
// wrapped onto three lines and pushed everything else below the fold, while
// still only saying "how many days are left" and nothing about what was
// actually taken. It's a `<select>` now — pick a type to see its remaining
// balance *and* that type's own history, or "All leave types" for everything
// with the most recent decision. Colour follows the type (see
// utils/leaveTypeAccents.js), so a row here is the same colour as that type's
// card on the My Leave page.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, Clock } from "lucide-react";
import { getMyBalances } from "../../services/leaveBalanceService.js";
import { getMyLeaveRequests } from "../../services/leaveRequestService.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { StatusBadge } from "../ui/Badge.jsx";
import { buildLeaveTypeAccents, accentFor } from "../../utils/leaveTypeAccents.js";
import { formatDateRange, todayDateKey } from "../../utils/dates.js";

const captionClasses = "text-[11px] font-medium tracking-wide text-slate-400 uppercase";

// "All leave types" is the default, and is a sentinel rather than an empty
// string so the <select>'s value is never falsy — an empty value would make
// "show everything" indistinguishable from "nothing selected yet".
const ALL_TYPES = "ALL";

// How many history rows to show before pointing at the full list. This is a
// dashboard tile, not the My Leave page — the point is a recent-history
// glance, and "see all" is one click away.
const HISTORY_LIMIT = 4;

export function MyLeaveSummary() {
    const [balances, setBalances] = useState(null);
    const [requests, setRequests] = useState(null);
    const [selectedTypeId, setSelectedTypeId] = useState(ALL_TYPES);

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
    const accents = buildLeaveTypeAccents(balances);
    const pendingCount = requests.filter((request) => request.status === "SUBMITTED").length;

    // Soonest future approved leave, if any.
    const upcoming = requests
        .filter((request) => request.status === "APPROVED" && request.start_date > today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

    const selectedBalance =
        selectedTypeId === ALL_TYPES ? null : balances.find((balance) => balance.leave_type_id === selectedTypeId);

    // Newest first, by start date — "my previous leaves" is read as a
    // reverse-chronological history, not in submission order.
    const history = requests
        .filter((request) => selectedTypeId === ALL_TYPES || request.leave_type_id === selectedTypeId)
        .sort((a, b) => b.start_date.localeCompare(a.start_date));

    return (
        <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">My leave</h2>
                {balances.length > 0 && (
                    <div className="flex items-center gap-2">
                        <label htmlFor="myLeaveType" className="sr-only">
                            Leave type
                        </label>
                        <select
                            id="myLeaveType"
                            value={selectedTypeId}
                            onChange={(event) => setSelectedTypeId(event.target.value)}
                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value={ALL_TYPES}>All leave types</option>
                            {balances.map((balance) => (
                                <option key={balance.leave_type_id} value={balance.leave_type_id}>
                                    {balance.leave_type_name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {balances.length === 0 && <p className="mt-3 text-sm text-slate-500">No leave types have been set up yet.</p>}

            {/* One type selected: its own balance, in that type's colour. "All"
                keeps the old at-a-glance row of every balance, which is still
                the right shape for a total — just no longer the only view. */}
            {selectedBalance ? (
                <div
                    className={`mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg px-3 py-2 ${
                        accentFor(accents, selectedBalance.leave_type_id).bg
                    }`}
                >
                    <span className={`text-xl font-semibold ${accentFor(accents, selectedBalance.leave_type_id).text}`}>
                        {Number(selectedBalance.days_remaining)}
                    </span>
                    <span className="text-sm text-slate-600">days left of {selectedBalance.leave_type_name}</span>
                    <span className="text-xs text-slate-500">
                        · {Number(selectedBalance.days_taken)} taken · {Number(selectedBalance.days_pending)} pending
                    </span>
                </div>
            ) : (
                balances.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {balances.map((balance) => {
                            const accent = accentFor(accents, balance.leave_type_id);
                            return (
                                <button
                                    key={balance.leave_type_id}
                                    type="button"
                                    onClick={() => setSelectedTypeId(balance.leave_type_id)}
                                    className={`cursor-pointer rounded-lg px-3 py-2 text-xs text-slate-600 transition hover:ring-2 hover:ring-slate-300 ${accent.bg}`}
                                >
                                    <span className={`font-semibold ${accent.text}`}>
                                        {Number(balance.days_remaining)}
                                    </span>{" "}
                                    {balance.leave_type_name}
                                </button>
                            );
                        })}
                    </div>
                )
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

                <div>
                    <p className={captionClasses}>
                        {selectedBalance ? `Previous ${selectedBalance.leave_type_name}` : "Previous requests"}
                    </p>
                    {history.length === 0 ? (
                        <p className="mt-1 text-slate-500">
                            {selectedBalance
                                ? `You haven't requested ${selectedBalance.leave_type_name} yet.`
                                : "You haven't submitted any leave requests yet."}
                        </p>
                    ) : (
                        <>
                            <ul className="mt-1.5 space-y-1.5">
                                {history.slice(0, HISTORY_LIMIT).map((request) => {
                                    const accent = accentFor(accents, request.leave_type_id);
                                    const workingDays = Number(request.working_days);
                                    return (
                                        <li
                                            key={request.id}
                                            className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-1.5 ${accent.bg}`}
                                        >
                                            {/* Type name only in the "All" view — with one type
                                                selected it's already in the heading above, and
                                                repeating it on every row is noise. */}
                                            {!selectedBalance && (
                                                <span className={`text-xs font-semibold ${accent.text}`}>
                                                    {request.leave_type_name}
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-600">
                                                {formatDateRange(request.start_date, request.end_date)}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {workingDays} {workingDays === 1 ? "day" : "days"}
                                            </span>
                                            <span className="ml-auto flex items-center gap-1.5">
                                                <StatusBadge status={request.status} />
                                            </span>
                                            {/* The decision itself, when there was one — this is
                                                the "last decisions" half of the history: a
                                                rejection without its reason is the least useful
                                                row on the page. */}
                                            {request.decision_comment && (
                                                <span className="w-full text-xs text-slate-500 italic">
                                                    “{request.decision_comment}”
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                            {history.length > HISTORY_LIMIT && (
                                <Button as={Link} to="/dashboard/my-leave" variant="secondary" size="sm" className="mt-2">
                                    See all {history.length} requests
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
}
