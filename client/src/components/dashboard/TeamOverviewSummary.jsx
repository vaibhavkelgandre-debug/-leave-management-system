// Dashboard tile: what a manager (or HR) can act on right now — pending
// approvals count + review link, who's on approved leave today, team
// headcount. getTeamLeaveRequests() is already scoped server-side (direct
// reports for a manager, everyone for HR), so this component doesn't need
// to know which role it's rendering for.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock, Users } from "lucide-react";
import { getTeamLeaveRequests } from "../../services/leaveRequestService.js";
import { getMyTeam } from "../../services/userService.js";
import { useAuth } from "../../hooks/useAuth.js";
import { canDecideDirectly } from "../../utils/leaveRequestAuthz.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { Avatar } from "../ui/Avatar.jsx";
import { Badge, RoleBadge } from "../ui/Badge.jsx";
import { formatDateRange, todayDateKey } from "../../utils/dates.js";

export function TeamOverviewSummary() {
    const { user } = useAuth();
    const [requests, setRequests] = useState(null);
    const [teamSize, setTeamSize] = useState(null);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getTeamLeaveRequests(), getMyTeam()])
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
    }, []);

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
    const onLeaveToday = requests.filter(
        (request) => request.status === "APPROVED" && request.start_date <= today && request.end_date >= today
    );

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Team overview</h2>
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
                </h3>
                {onLeaveToday.length > 0 ? (
                    <ul className="mt-2 space-y-2.5">
                        {onLeaveToday.map((request) => {
                            const workingDays = Number(request.working_days);
                            const isHalfDay = request.start_half_day || request.end_half_day;
                            return (
                                <li key={request.id} className="flex flex-wrap items-center gap-2.5">
                                    <Avatar
                                        firstName={request.employee_first_name}
                                        lastName={request.employee_last_name}
                                        size="sm"
                                    />
                                    <span className="shrink-0 text-sm font-medium text-slate-700">
                                        {request.employee_first_name} {request.employee_last_name}
                                    </span>
                                    <RoleBadge role={request.employee_role} />
                                    <span className="shrink-0 text-xs text-slate-500">{request.employee_email}</span>
                                    <span className="shrink-0 text-xs text-slate-400">·</span>
                                    <span className="shrink-0 text-xs text-slate-500">
                                        {formatDateRange(request.start_date, request.end_date)} · {workingDays} day
                                        {workingDays === 1 ? "" : "s"}
                                        {isHalfDay && " (half day)"}
                                    </span>
                                    <Badge className="ml-auto shrink-0 bg-indigo-100 text-indigo-700">
                                        {request.leave_type_name}
                                    </Badge>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="mt-2 text-sm text-slate-500">Nobody's out today.</p>
                )}
            </div>
        </Card>
    );
}
