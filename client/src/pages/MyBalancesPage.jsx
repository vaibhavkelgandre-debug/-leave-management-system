import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { getMyBalances } from "../services/leaveBalanceService.js";
import { getMyLeaveRequests } from "../services/leaveRequestService.js";
import { getHolidays } from "../services/holidayService.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { RequestLeaveForm } from "../components/leave/RequestLeaveForm.jsx";
import { MyLeaveRequestList } from "../components/leave/MyLeaveRequestList.jsx";
import { MyLeaveCalendar } from "../components/leave/MyLeaveCalendar.jsx";
import { LeaveBalanceCard } from "../components/leave/LeaveBalanceCard.jsx";
import { LEAVE_BALANCE_ACCENTS } from "../constants/leaveBalanceAccents.js";

const currentYear = new Date().getFullYear();
// A short window around today is enough — there's no leave history before this
// system existed, and balances aren't projected far into the future.
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1];

export function MyBalancesPage() {
    // Set when arriving here right after submitting a request from
    // ApplyLeavePage (its own route, not a query param — a search-only
    // navigation wouldn't remount this page or re-run this lazy init at
    // all), so the calendar can open already showing the right month/year.
    const location = useLocation();
    const initialFocusDate = location.state?.focusDate ?? null;
    // Set when arriving here from a notification click (NotificationBell.jsx)
    // — same "router state, not a query param" reasoning as focusDate above,
    // so MyLeaveRequestList can auto-open that request's detail modal on
    // this fresh mount without a calendar click also popping it open.
    const notificationRequestId = location.state?.selectedRequestId ?? null;

    const [balances, setBalances] = useState([]);
    const [year, setYear] = useState(currentYear);
    // Tracks which year `balances` actually belongs to, so "loading" can be
    // derived rather than set from inside the effect.
    const [loadedYear, setLoadedYear] = useState(null);
    const [loadError, setLoadError] = useState(null);

    const [myRequests, setMyRequests] = useState([]);
    const [requestsLoaded, setRequestsLoaded] = useState(false);
    const [requestsError, setRequestsError] = useState(null);

    // The personal calendar (FR-022) owns its own month/year navigation,
    // independent of the balance-year selector above — holidays are fetched
    // per whichever year the calendar is currently showing.
    const [calendarYear, setCalendarYear] = useState(() =>
        initialFocusDate ? Number(initialFocusDate.slice(0, 4)) : currentYear
    );
    const [holidays, setHolidays] = useState([]);
    const [loadedHolidayYear, setLoadedHolidayYear] = useState(null);

    // Set when a leave request is clicked on the calendar, so the matching
    // row can be highlighted and scrolled into view in the list beside it —
    // also seeded from a notification click so that row starts highlighted too.
    const [selectedRequestId, setSelectedRequestId] = useState(notificationRequestId);
    // Set right after submitting a new request so the calendar can jump to
    // it — the calendar itself owns month-to-month navigation otherwise.
    const [focusDate, setFocusDate] = useState(initialFocusDate);

    const [showRequestForm, setShowRequestForm] = useState(false);
    // Beyond a handful of leave types, a full card grid pushes everything
    // else on the page below the fold — collapsed to the first 6 by default,
    // with a toggle to reveal the rest.
    const [showAllBalances, setShowAllBalances] = useState(false);

    // Bumped after a request is submitted/withdrawn/cancelled, to re-trigger
    // both fetch effects — a request always changes both the balance and the
    // request list, so they reload together.
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    const loading = loadedYear !== year;
    const holidaysLoading = loadedHolidayYear !== calendarYear;

    useEffect(() => {
        let cancelled = false;

        getMyBalances({ year })
            .then((data) => {
                if (cancelled) return;
                setBalances(data);
                setLoadError(null);
                setLoadedYear(year);
            })
            .catch(() => {
                if (cancelled) return;
                setLoadError("Unable to load your leave balances");
                setLoadedYear(year);
            });

        // Guards against an earlier year's response landing after a newer one
        // when the user switches years quickly.
        return () => {
            cancelled = true;
        };
    }, [year, reloadToken]);

    useEffect(() => {
        let cancelled = false;

        getMyLeaveRequests()
            .then((data) => {
                if (cancelled) return;
                setMyRequests(data);
                setRequestsError(null);
                setRequestsLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;
                setRequestsError("Unable to load your leave requests");
                setRequestsLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

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

    function handleSubmitted(created) {
        setShowRequestForm(false);
        setFocusDate(created.start_date);
        const createdYear = Number(created.start_date.slice(0, 4));
        if (createdYear !== calendarYear) {
            setCalendarYear(createdYear);
        }
        reload();
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold text-slate-900">My Leave</h1>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label htmlFor="year" className="text-sm font-medium text-slate-700">
                            Year
                        </label>
                        <select
                            id="year"
                            value={year}
                            onChange={(event) => setYear(Number(event.target.value))}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            {YEAR_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button icon={Plus} onClick={() => setShowRequestForm(true)}>
                        Request Leave
                    </Button>
                </div>
            </div>

            <p className="mt-1 text-sm text-slate-500">
                Your leave balance for each leave type. Days remaining is entitlement minus days taken and pending.
            </p>

            <Modal open={showRequestForm} onClose={() => setShowRequestForm(false)} title="Request leave">
                <RequestLeaveForm onSubmitted={handleSubmitted} />
            </Modal>

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

            {!loading && !loadError && balances.length === 0 && (
                <p className="mt-6 text-sm text-slate-500">
                    No leave types have been set up yet, so you have no balances for {year}.
                </p>
            )}

            {!loading && !loadError && balances.length > 0 && (
                <div className="mt-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {(showAllBalances ? balances : balances.slice(0, 6)).map((balance, index) => (
                            <LeaveBalanceCard
                                key={balance.id}
                                balance={balance}
                                accent={LEAVE_BALANCE_ACCENTS[index % LEAVE_BALANCE_ACCENTS.length]}
                            />
                        ))}
                    </div>
                    {balances.length > 6 && (
                        <div className="mt-4 flex justify-center">
                            <Button variant="secondary" size="sm" onClick={() => setShowAllBalances((prev) => !prev)}>
                                {showAllBalances ? "Show less" : `Show all ${balances.length} leave types`}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
                <section className="lg:sticky lg:top-20">
                    {holidaysLoading ? (
                        <Card className="flex items-center justify-center p-10">
                            <p role="status" className="text-sm text-slate-500">
                                Loading…
                            </p>
                        </Card>
                    ) : (
                        <MyLeaveCalendar
                            requests={myRequests}
                            holidays={holidays}
                            onActiveYearChange={setCalendarYear}
                            focusDate={focusDate}
                            selectedRequestId={selectedRequestId}
                            onSelectRequest={setSelectedRequestId}
                        />
                    )}
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-slate-900">My requests</h2>

                    {!requestsLoaded && (
                        <p role="status" className="mt-2 text-sm text-slate-500">
                            Loading…
                        </p>
                    )}
                    {requestsError && (
                        <p role="alert" className="mt-2 text-sm text-red-600">
                            {requestsError}
                        </p>
                    )}
                    {requestsLoaded && !requestsError && myRequests.length === 0 && (
                        <p className="mt-2 text-sm text-slate-500">You haven't submitted any leave requests yet.</p>
                    )}
                    {requestsLoaded && !requestsError && myRequests.length > 0 && (
                        <div className="mt-4">
                            <MyLeaveRequestList
                                requests={myRequests}
                                onChanged={reload}
                                selectedRequestId={selectedRequestId}
                                autoOpenRequestId={notificationRequestId}
                            />
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
