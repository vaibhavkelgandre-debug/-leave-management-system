import { useAuth } from "../hooks/useAuth.js";
import { ROLES } from "../constants/roles.js";
import { RoleBadge } from "../components/ui/Badge.jsx";
import { MyLeaveSummary } from "../components/dashboard/MyLeaveSummary.jsx";
import { TeamOverviewSummary } from "../components/dashboard/TeamOverviewSummary.jsx";
import { DelegationStatus } from "../components/dashboard/DelegationStatus.jsx";

export function DashboardPage() {
    const { user, hasAnyRole } = useAuth();
    // Team overview is meaningful for anyone who can see a team-scoped
    // request list at all (leaveRequestService.listTeamLeaveRequests scopes
    // it server-side); delegation status only applies to managers, since
    // HR can't nominate a delegate.
    const isManagerOrHr = hasAnyRole([ROLES.MANAGER, ROLES.HR_ADMIN]);
    const isManager = hasAnyRole([ROLES.MANAGER]);

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user.first_name}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                Role <RoleBadge role={user.role} />
            </p>

            <div className="mt-6 space-y-4">
                {isManager && <DelegationStatus />}
                {isManagerOrHr && <TeamOverviewSummary />}
                <MyLeaveSummary />
            </div>
        </div>
    );
}
