import { useAuth } from "../hooks/useAuth.js";
import { ROLES } from "../constants/roles.js";

export function DashboardPage() {
    const { user } = useAuth();

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user.first_name}</h1>
            <p className="mt-1 text-sm text-slate-500">Role: {user.role}</p>

            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                {user.role === ROLES.EMPLOYEE && (
                    <p className="text-sm text-slate-600">Your leave balance and requests will appear here.</p>
                )}
                {user.role === ROLES.MANAGER && (
                    <p className="text-sm text-slate-600">Pending approvals for your team will appear here.</p>
                )}
                {user.role === ROLES.HR_ADMIN && (
                    <p className="text-sm text-slate-600">Company-wide leave overview will appear here.</p>
                )}
            </div>
        </div>
    );
}
