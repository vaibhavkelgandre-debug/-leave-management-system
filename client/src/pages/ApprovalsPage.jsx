import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { getTeamLeaveRequests } from "../services/leaveRequestService.js";
import { TeamRequestList } from "../components/leave/TeamRequestList.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { ROLES } from "../constants/roles.js";

export function ApprovalsPage() {
    const { hasAnyRole } = useAuth();
    // HR's blanket override authority (route-level requireRole("HR_ADMIN") on
    // the server for the actual override call) — this only controls whether
    // the override buttons render, the server re-checks the role regardless.
    const canOverride = hasAnyRole([ROLES.HR_ADMIN]);

    const [requests, setRequests] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    useEffect(() => {
        let cancelled = false;

        getTeamLeaveRequests()
            .then((data) => {
                if (cancelled) return;
                setRequests(data);
                setLoadError(null);
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setLoadError("Unable to load requests");
                setLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    return (
        <div>
            <PageHeader
                title="Approvals"
                description={
                    canOverride
                        ? "Every request in the company. You can override any manager's decision."
                        : "Requests from your direct reports awaiting a decision."
                }
            />

            {!loaded && (
                <p role="status" className="mt-6 text-sm text-slate-500">
                    Loading…
                </p>
            )}
            {loadError && (
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {loadError}
                </p>
            )}
            {loaded && !loadError && requests.length === 0 && (
                <p className="mt-6 text-sm text-slate-500">No requests to show.</p>
            )}
            {loaded && !loadError && requests.length > 0 && (
                <div className="mt-6">
                    <TeamRequestList requests={requests} canOverride={canOverride} onChanged={reload} />
                </div>
            )}
        </div>
    );
}
