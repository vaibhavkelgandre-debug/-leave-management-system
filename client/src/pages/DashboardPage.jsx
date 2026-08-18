import { useAuth } from "../hooks/useAuth.js";
import { ROLES } from "../constants/roles.js";
import { RoleBadge } from "../components/ui/Badge.jsx";
import { MyLeaveSummary } from "../components/dashboard/MyLeaveSummary.jsx";
import { TeamOverviewSummary } from "../components/dashboard/TeamOverviewSummary.jsx";
import { DelegationStatus } from "../components/dashboard/DelegationStatus.jsx";
import { DelegateStatus } from "../components/dashboard/DelegateStatus.jsx";

export function DashboardPage() {
    const { user, hasAnyRole } = useAuth();
    // Team overview is meaningful for anyone who can see a team-scoped
    // request list at all (leaveRequestService.listTeamLeaveRequests scopes
    // it server-side); DelegationStatus (nominating someone) only applies to
    // managers, since HR can't nominate a delegate — but DelegateStatus (the
    // flip side, being nominated) isn't role-gated at all: a plain EMPLOYEE
    // can be someone's delegate just as easily as a manager can.
    const isManagerOrHr = hasAnyRole([ROLES.MANAGER, ROLES.HR_ADMIN, ROLES.SUPER_ADMIN]);
    const isManager = hasAnyRole([ROLES.MANAGER]);

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user.first_name}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                Role <RoleBadge role={user.role} />
            </p>
            {(user.manager || user.hr) && (
                <p className="mt-1 text-sm text-slate-500">
                    {user.manager && (
                        <>
                            Reports to <span className="font-medium text-slate-700">{user.manager.first_name} {user.manager.last_name}</span>
                        </>
                    )}
                    {user.manager && user.hr && user.hr.id !== user.manager.id && " · "}
                    {user.hr && user.hr.id !== user.manager?.id && (
                        <>
                            HR: <span className="font-medium text-slate-700">{user.hr.first_name} {user.hr.last_name}</span>
                        </>
                    )}
                </p>
            )}

            <div className="mt-6 space-y-4">
                {isManager && <DelegationStatus />}
                <DelegateStatus />
                {isManagerOrHr && <TeamOverviewSummary />}
                <MyLeaveSummary />
            </div>
        </div>
    );
}
