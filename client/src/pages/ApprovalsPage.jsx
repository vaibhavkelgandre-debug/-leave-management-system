import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { getAllLeaveRequests, getTeamLeaveRequests } from "../services/leaveRequestService.js";
import { TeamRequestList } from "../components/leave/TeamRequestList.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { ROLES } from "../constants/roles.js";

const TABS = { TEAM: "team", ALL: "all" };

export function ApprovalsPage() {
    const { hasAnyRole } = useAuth();
    // HR's override authority is scoped to their own reporting subtree, not
    // the whole company (each HR_ADMIN is the root of their own separate
    // branch) — this only controls whether the override buttons render, the
    // server re-checks the actual scope regardless.
    const canOverride = hasAnyRole([ROLES.HR_ADMIN]);
    // Only HR gets a choice at all — a manager/delegate's "team" list was
    // already everything they can see, so there's no separate "all" view
    // for them to switch to.
    const [activeTab, setActiveTab] = useState(TABS.TEAM);

    const [requests, setRequests] = useState([]);
    // Tracks which tab `requests` belongs to, so "loading" can be derived
    // rather than set from inside the effect.
    const [loadedTab, setLoadedTab] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    const loading = loadedTab !== activeTab;
    const showingAllRequests = canOverride && activeTab === TABS.ALL;

    useEffect(() => {
        let cancelled = false;
        const fetchRequests = showingAllRequests ? getAllLeaveRequests : getTeamLeaveRequests;

        fetchRequests()
            .then((data) => {
                if (cancelled) return;
                setRequests(data);
                setLoadError(null);
                setLoadedTab(activeTab);
            })
            .catch(() => {
                if (cancelled) return;
                setRequests([]);
                setLoadError("Unable to load requests");
                setLoadedTab(activeTab);
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken, activeTab, showingAllRequests]);

    return (
        <div>
            <PageHeader
                title="Approvals"
                description={
                    showingAllRequests
                        ? "Every request in the company, for context — switch to My Team to act on one."
                        : canOverride
                          ? "Requests from your own reporting line awaiting a decision, or already decided within it awaiting an override."
                          : "Requests from your direct reports — and anyone you're currently covering for as a delegate — awaiting a decision."
                }
            />

            {canOverride && (
                <div role="tablist" aria-label="Approvals view" className="mt-6 flex gap-1 border-b border-slate-200">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === TABS.TEAM}
                        onClick={() => setActiveTab(TABS.TEAM)}
                        className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                            activeTab === TABS.TEAM
                                ? "border-indigo-600 text-indigo-700"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        My Team
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === TABS.ALL}
                        onClick={() => setActiveTab(TABS.ALL)}
                        className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                            activeTab === TABS.ALL
                                ? "border-indigo-600 text-indigo-700"
                                : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        All Requests
                    </button>
                </div>
            )}

            {loading && (
                <p role="status" className="mt-6 text-sm text-slate-500">
                    Loading…
                </p>
            )}
            {loadError && (
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {loadError}
                </p>
            )}
            {!loading && !loadError && requests.length === 0 && (
                <p className="mt-6 text-sm text-slate-500">No requests to show.</p>
            )}
            {!loading && !loadError && requests.length > 0 && (
                <div className="mt-6">
                    <TeamRequestList
                        requests={requests}
                        canOverride={canOverride}
                        onChanged={reload}
                        readOnly={showingAllRequests}
                    />
                </div>
            )}
        </div>
    );
}
