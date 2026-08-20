// Dashboard tile: what a manager (or HR, or the super admin) can act on right
// now — pending approvals count + review link, who's on approved leave today
// as a table, headcount.
//
// One deliberate role branch, and only one: which endpoint feeds it.
// `getTeamLeaveRequests()` is scoped server-side to what the caller can *act*
// on — direct reports for a manager, their own branch for HR, and (because
// SUPER_ADMIN's HR scope is its direct-report HR admins only) almost nobody
// for the super admin, who would otherwise see an empty "on leave today" for
// a company full of people out. `getMyTeam()` is already whole-company for
// them (a transitive subtree walk from the root), so the headcount and the
// leave list would disagree without this. SUPER_ADMIN therefore reads the
// company-wide list it alone is allowed to fetch (GET /leave-requests/all).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock, Users } from "lucide-react";
import { getAllLeaveRequests, getTeamLeaveRequests } from "../../services/leaveRequestService.js";
import { getMyTeam } from "../../services/userService.js";
import { useAuth } from "../../hooks/useAuth.js";
import { ROLES } from "../../constants/roles.js";
import { canDecideDirectly } from "../../utils/leaveRequestAuthz.js";
import { OnLeaveTodayTable } from "./OnLeaveTodayTable.jsx";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { todayDateKey } from "../../utils/dates.js";

export function TeamOverviewSummary() {
    const { user, hasAnyRole } = useAuth();
    const isSuperAdmin = hasAnyRole([ROLES.SUPER_ADMIN]);
    const [requests, setRequests] = useState(null);
    const [teamSize, setTeamSize] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const fetchRequests = isSuperAdmin ? getAllLeaveRequests : getTeamLeaveRequests;
        Promise.all([fetchRequests(), getMyTeam()])
            .then(([requestData, team]) => {
                if (cancelled) return;
                setRequests(requestData);
                setTeamSize(team.length);
            })
            .catch(() => {
                if (cancelled) return;
                setRequests([]);
                setTeamSize(0);
            });

        return () => {
            cancelled = true;
        };
    }, [isSuperAdmin]);

    if (requests === null) {
        return (
            <Card className="p-6">
                <p role="status" className="text-sm text-slate-500">
                    Loading…
                </p>
            </Card>
        );
    }

    const today = todayDateKey();
    // "Waiting for your decision" only counts requests this viewer can
    // actually decide on right now — for HR that's narrower than every
    // SUBMITTED row in their subtree, most of which is still the actual
    // manager's call to make first (see leaveRequestAuthz.js).
    const pending = requests.filter(
        (request) => request.status === "SUBMITTED" && canDecideDirectly(request, user)
    );
    // Sorted by name rather than left in request-creation order — a table is
    // read down a column, so "who's out" should be scannable alphabetically.
    const onLeaveToday = requests
        .filter((request) => request.status === "APPROVED" && request.start_date <= today && request.end_date >= today)
        .sort((a, b) =>
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
                            pending.length > 0 ? "bg-amber-100" : "bg-emerald-100"
                        }`}
                    >
                        {pending.length > 0 ? (
                            <Clock className="h-4.5 w-4.5 text-amber-600" aria-hidden="true" />
                        ) : (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" aria-hidden="true" />
                        )}
                    </span>
                    <p className="text-sm text-slate-700">
                        {pending.length > 0 ? (
                            <>
                                <span className="font-semibold text-slate-900">{pending.length}</span>{" "}
                                request{pending.length === 1 ? "" : "s"} waiting for your decision.
                            </>
                        ) : (
                            "No requests waiting for a decision."
                        )}
                    </p>
                </div>
                {pending.length > 0 && (
                    <Button as={Link} to="/dashboard/approvals" size="sm">
                        Review
                    </Button>
                )}
            </div>

            <div className="mt-4">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    On leave today
                    {onLeaveToday.length > 0 && (
                        <span className="text-xs font-normal text-slate-500">({onLeaveToday.length})</span>
                    )}
                </h3>
                <OnLeaveTodayTable
                    requests={onLeaveToday}
                    emptyMessage={isSuperAdmin ? "Nobody in the organisation is out today." : "Nobody's out today."}
                />
            </div>
        </Card>
    );
}
