// Dashboard tile: what a manager (or HR) can act on right now — pending
// approvals, who's on leave today from their scope, and team headcount.
// getTeamLeaveRequests() is already scoped server-side (direct reports for a
// manager, everyone for HR), so this component doesn't need to know which
// role it's rendering for.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { getTeamLeaveRequests } from "../../services/leaveRequestService.js";
import { getMyTeam } from "../../services/userService.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { todayDateKey } from "../../utils/dates.js";

export function TeamOverviewSummary() {
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
    const pending = requests.filter((request) => request.status === "SUBMITTED");
    const onLeaveToday = requests.filter(
        (request) => request.status === "APPROVED" && request.start_date <= today && request.end_date >= today
    );

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Team overview</h2>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    {teamSize} {teamSize === 1 ? "person" : "people"}
                </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-700">
                    {pending.length > 0
                        ? `${pending.length} request${pending.length === 1 ? "" : "s"} waiting for your decision.`
                        : "No requests waiting for a decision."}
                </p>
                {pending.length > 0 && (
                    <Button as={Link} to="/dashboard/approvals" size="sm">
                        Review
                    </Button>
                )}
            </div>

            <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-700">On leave today</h3>
                {onLeaveToday.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                        {onLeaveToday.map((request) => (
                            <li key={request.id}>
                                {request.employee_first_name} {request.employee_last_name} — {request.leave_type_name}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-2 text-sm text-slate-500">Nobody's out today.</p>
                )}
            </div>
        </Card>
    );
}
