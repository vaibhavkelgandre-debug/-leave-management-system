// Dashboard tile: what a manager (or HR, or the super admin) can act on right
// now — pending approvals count + review link, who's on approved leave today
// as a table, headcount.
//
// Every one of those three is now its own count/slice endpoint, and none of
// them fetches a list to derive a number from it. Before: this tile pulled the
// caller's entire team request history (`/team`, or `/all` for the super
// admin) *and* their entire subtree of users — thousands of rows and several
// megabytes at NFR-7's "200 employees, three years" target — to render one
// count, a handful of today's rows, and one headcount. The three endpoints
// return, respectively, an integer, today's rows only, and an integer.
//
// The role branch that used to live here (super admin reads company-wide,
// everyone else reads their team) moved server-side into
// leaveRequestService.listOnLeaveToday, where the scoping rules already are —
// so this component no longer knows which role it's rendering for, except to
// title itself.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock, Users } from "lucide-react";
import { getOnLeaveToday } from "../../services/leaveRequestService.js";
import { getMyTeamSize } from "../../services/userService.js";
import { useAuth } from "../../hooks/useAuth.js";
import { usePendingApprovalsCount } from "../../hooks/usePendingApprovalsCount.js";
import { ROLES } from "../../constants/roles.js";
import { OnLeaveTodayTable } from "./OnLeaveTodayTable.jsx";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";

export function TeamOverviewSummary() {
    const { hasAnyRole } = useAuth();
    const isSuperAdmin = hasAnyRole([ROLES.SUPER_ADMIN]);
    // Shared with the sidebar's Approvals badge — same hook, same endpoint, so
    // the two can never show different numbers (they're rendered side by side).
    const pendingCount = usePendingApprovalsCount(true);
    const [onLeaveToday, setOnLeaveToday] = useState(null);
    const [teamSize, setTeamSize] = useState(null);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getOnLeaveToday(), getMyTeamSize()])
            .then(([todayRows, size]) => {
                if (cancelled) return;
                setOnLeaveToday(todayRows);
                setTeamSize(size);
            })
            .catch(() => {
                if (cancelled) return;
                setOnLeaveToday([]);
                setTeamSize(0);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (onLeaveToday === null) {
        return (
            <Card className="p-6">
                <p role="status" className="text-sm text-slate-500">
                    Loading…
                </p>
            </Card>
        );
    }

    // Sorted by name rather than by the endpoint's own newest-first order — a
    // table is read down a column, so "who's out" should scan alphabetically.
    const sortedOnLeave = [...onLeaveToday].sort((a, b) =>
        `${a.employee_first_name} ${a.employee_last_name}`.localeCompare(
            `${b.employee_first_name} ${b.employee_last_name}`
        )
    );

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                    {isSuperAdmin ? "Organisation overview" : "Team overview"}
                </h2>
                <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {teamSize} {teamSize === 1 ? "person" : "people"}
                </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                    <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            pendingCount > 0 ? "bg-amber-100" : "bg-emerald-100"
                        }`}
                    >
                        {pendingCount > 0 ? (
                            <Clock className="h-4.5 w-4.5 text-amber-600" aria-hidden="true" />
                        ) : (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" aria-hidden="true" />
                        )}
                    </span>
                    <p className="text-sm text-slate-700">
                        {pendingCount > 0 ? (
                            <>
                                <span className="font-semibold text-slate-900">{pendingCount}</span>{" "}
                                request{pendingCount === 1 ? "" : "s"} waiting for your decision.
                            </>
                        ) : (
                            "No requests waiting for a decision."
                        )}
                    </p>
                </div>
                {pendingCount > 0 && (
                    <Button as={Link} to="/dashboard/approvals" size="sm">
                        Review
                    </Button>
                )}
            </div>

            <div className="mt-4">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    On leave today
                    {sortedOnLeave.length > 0 && (
                        <span className="text-xs font-normal text-slate-500">({sortedOnLeave.length})</span>
                    )}
                </h3>
                <OnLeaveTodayTable
                    requests={sortedOnLeave}
                    emptyMessage={isSuperAdmin ? "Nobody in the organisation is out today." : "Nobody's out today."}
                />
            </div>
        </Card>
    );
}
