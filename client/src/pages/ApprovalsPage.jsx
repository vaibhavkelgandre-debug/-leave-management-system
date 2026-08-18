import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { getAllLeaveRequests, getTeamLeaveRequests } from "../services/leaveRequestService.js";
import { getHolidays } from "../services/holidayService.js";
import { TeamRequestList } from "../components/leave/TeamRequestList.jsx";
import { TeamLeaveCalendar } from "../components/leave/TeamLeaveCalendar.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { ROLES } from "../constants/roles.js";

const currentYear = new Date().getFullYear();
const TABS = { TEAM: "team", ALL: "all" };

export function ApprovalsPage() {
    const { hasAnyRole } = useAuth();
    // Set when arriving here from a notification click (NotificationBell.jsx)
    // — router state, not a query param, same reasoning as MyBalancesPage's
    // focusDate/notificationRequestId. A notified recipient is always the
    // employee's manager or an HR ancestor within their own subtree, which
    // the default "My Team" tab already covers (see
    // notificationService.resolveManagerOrNearestHrAncestor), so this never
    // needs to switch to the "All Requests" tab.
    const location = useLocation();
    const notificationRequestId = location.state?.selectedRequestId ?? null;
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

    // The team calendar (FR-023) owns its own month/year navigation,
    // independent of which tab is active — holidays are fetched for
    // whichever year the calendar is currently showing.
    const [calendarYear, setCalendarYear] = useState(currentYear);
    const [holidays, setHolidays] = useState([]);
    const [loadedHolidayYear, setLoadedHolidayYear] = useState(null);

    // Set when a request is clicked on the calendar, so the matching row
    // can be highlighted and scrolled into view in the list beside it —
    // also seeded from a notification click so that row starts highlighted too.
    const [selectedRequestId, setSelectedRequestId] = useState(notificationRequestId);

    const loading = loadedTab !== activeTab;
    const holidaysLoading = loadedHolidayYear !== calendarYear;
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

    useEffect(() => {
        let cancelled = false;

        getHolidays({ year: calendarYear })
            .then((data) => {
                if (cancelled) return;
                setHolidays(data);
                setLoadedHolidayYear(calendarYear);
            })
            .catch(() => {
                if (cancelled) return;
                setHolidays([]);
                setLoadedHolidayYear(calendarYear);
            });

        return () => {
            cancelled = true;
        };
    }, [calendarYear, reloadToken]);

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

            {!loading && !loadError && (
                <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr] lg:items-start">
                    <section className="lg:sticky lg:top-20">
                        {holidaysLoading ? (
                            <Card className="flex items-center justify-center p-10">
                                <p role="status" className="text-sm text-slate-500">
                                    Loading…
                                </p>
                            </Card>
                        ) : (
                            <TeamLeaveCalendar
                                requests={requests}
                                holidays={holidays}
                                onActiveYearChange={setCalendarYear}
                                selectedRequestId={selectedRequestId}
                                onSelectRequest={setSelectedRequestId}
                            />
                        )}
                    </section>

                    <section>
                        {requests.length === 0 ? (
                            <p className="text-sm text-slate-500">No requests to show.</p>
                        ) : (
                            <TeamRequestList
                                requests={requests}
                                canOverride={canOverride}
                                onChanged={reload}
                                readOnly={showingAllRequests}
                                selectedRequestId={selectedRequestId}
                                autoOpenRequestId={notificationRequestId}
                            />
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
