import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { getAllLeaveRequests, getTeamLeaveRequests } from "../services/leaveRequestService.js";
import { getHolidays } from "../services/holidayService.js";
import { TeamRequestList } from "../components/leave/TeamRequestList.jsx";
import { TeamLeaveCalendar } from "../components/leave/TeamLeaveCalendar.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { ROLES } from "../constants/roles.js";

const currentYear = new Date().getFullYear();
const TABS = { TEAM: "team", ALL: "all" };

// Same page size as the other two paginated lists (HR's browse view and
// notifications) — one convention rather than a different number per screen.
const PAGE_SIZE = 25;

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
    // Separate from `canOverride` on purpose — the two used to be the same
    // flag and are now opposite roles. The company-wide list is SUPER_ADMIN's
    // alone (GET /leave-requests/all is gated to it), while overriding a
    // decision is HR_ADMIN's alone (SUPER_ADMIN is refused outright). So an
    // HR admin gets one team-scoped list with override buttons, and
    // SUPER_ADMIN gets the extra read-only company-wide tab without them.
    //
    // An HR admin has no second tab to switch to because a team-scoped "all
    // requests" would return exactly the same rows as this one already does.
    const canSeeAllRequests = hasAnyRole([ROLES.SUPER_ADMIN]);
    const [activeTab, setActiveTab] = useState(TABS.TEAM);

    // The list and the calendar are fed by two different fetches now, because
    // they want different slices of the same data: the list wants page N
    // (newest first), the calendar wants *everything* overlapping the month
    // it's showing. One fetch can't serve both — pagination would silently
    // hide events from the calendar, and a whole month is not a page.
    const [requests, setRequests] = useState([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [calendarRequests, setCalendarRequests] = useState([]);
    // Set by the calendar itself on mount and on every month navigation.
    const [calendarRange, setCalendarRange] = useState(null);
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

    // One callback for both of the calendar's dependants: its own request
    // window, and the holiday year (holidays are fetched per year, unchanged).
    function handleCalendarRange({ year, startDate, endDate }) {
        setCalendarYear(year);
        setCalendarRange((current) =>
            current?.startDate === startDate && current?.endDate === endDate ? current : { startDate, endDate }
        );
    }

    const loading = loadedTab !== activeTab;
    const holidaysLoading = loadedHolidayYear !== calendarYear;
    const showingAllRequests = canSeeAllRequests && activeTab === TABS.ALL;

    useEffect(() => {
        let cancelled = false;
        const fetchRequests = showingAllRequests ? getAllLeaveRequests : getTeamLeaveRequests;

        fetchRequests({ limit: PAGE_SIZE, offset })
            .then((data) => {
                if (cancelled) return;
                setRequests(data.requests);
                setTotal(data.total);
                setLoadError(null);
                setLoadedTab(activeTab);
            })
            .catch(() => {
                if (cancelled) return;
                setRequests([]);
                setTotal(0);
                setLoadError("Unable to load requests");
                setLoadedTab(activeTab);
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken, activeTab, showingAllRequests, offset]);

    // The calendar's own fetch: every request overlapping the grid it's
    // currently showing, however many pages of the list that spans. Skipped
    // until the calendar has reported a range (it does so on mount).
    useEffect(() => {
        if (!calendarRange) return undefined;
        let cancelled = false;
        const fetchRequests = showingAllRequests ? getAllLeaveRequests : getTeamLeaveRequests;

        fetchRequests({ startDate: calendarRange.startDate, endDate: calendarRange.endDate })
            .then((data) => {
                if (!cancelled) setCalendarRequests(data.requests);
            })
            .catch(() => {
                if (!cancelled) setCalendarRequests([]);
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken, showingAllRequests, calendarRange]);

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

            {canSeeAllRequests && (
                <div role="tablist" aria-label="Approvals view" className="mt-6 flex gap-1 border-b border-slate-200">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === TABS.TEAM}
                        onClick={() => {
                            setOffset(0);
                            setActiveTab(TABS.TEAM);
                        }}
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
                        onClick={() => {
                            setOffset(0);
                            setActiveTab(TABS.ALL);
                        }}
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
                                requests={calendarRequests}
                                holidays={holidays}
                                onActiveRangeChange={handleCalendarRange}
                                selectedRequestId={selectedRequestId}
                                onSelectRequest={setSelectedRequestId}
                            />
                        )}
                    </section>

                    <section>
                        {requests.length === 0 ? (
                            <p className="text-sm text-slate-500">No requests to show.</p>
                        ) : (
                            <>
                                <TeamRequestList
                                    requests={requests}
                                    canOverride={canOverride}
                                    onChanged={reload}
                                    readOnly={showingAllRequests}
                                    selectedRequestId={selectedRequestId}
                                    autoOpenRequestId={notificationRequestId}
                                />
                                {/* Same "Showing X–Y of Z" + prev/next as the
                                    other paginated lists. Only the list pages —
                                    the calendar beside it always shows its whole
                                    month, so navigating pages never changes what
                                    the calendar displays. */}
                                {total > PAGE_SIZE && (
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-xs text-slate-500">
                                            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={offset === 0}
                                                onClick={() => setOffset((current) => Math.max(current - PAGE_SIZE, 0))}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={offset + PAGE_SIZE >= total}
                                                onClick={() => setOffset((current) => current + PAGE_SIZE)}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
