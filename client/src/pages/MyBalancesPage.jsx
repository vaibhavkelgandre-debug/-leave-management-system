import { useEffect, useState } from "react";
import { CalendarHeart, Plus } from "lucide-react";
import { getMyBalances } from "../services/leaveBalanceService.js";
import { getMyLeaveRequests } from "../services/leaveRequestService.js";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { RequestLeaveForm } from "../components/leave/RequestLeaveForm.jsx";
import { MyLeaveRequestList } from "../components/leave/MyLeaveRequestList.jsx";

const currentYear = new Date().getFullYear();
// A short window around today is enough — there's no leave history before this
// system existed, and balances aren't projected far into the future.
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1];

// Cycled by card position so a row of different leave types reads as a set of
// distinct little cards rather than identical grey boxes.
const ACCENTS = [
    { bg: "bg-indigo-100", text: "text-indigo-600", bar: "bg-indigo-500" },
    { bg: "bg-emerald-100", text: "text-emerald-600", bar: "bg-emerald-500" },
    { bg: "bg-amber-100", text: "text-amber-600", bar: "bg-amber-500" },
    { bg: "bg-rose-100", text: "text-rose-600", bar: "bg-rose-500" },
    { bg: "bg-sky-100", text: "text-sky-600", bar: "bg-sky-500" },
    { bg: "bg-violet-100", text: "text-violet-600", bar: "bg-violet-500" },
];

function balanceMessage(remaining, entitlement) {
    if (entitlement === 0) return "No entitlement set for this leave type.";
    if (remaining <= 0) return "You're all out for now — plan around this one.";
    if (remaining <= entitlement * 0.25) return "Running low — worth planning ahead.";
    return "Looking healthy — plenty left to plan around.";
}

function BalanceCard({ balance, accent }) {
    const remaining = Number(balance.days_remaining);
    const entitlement = Number(balance.entitlement);
    const taken = Number(balance.days_taken);
    const pending = Number(balance.days_pending);
    const usedPercent = entitlement > 0 ? Math.min(100, Math.round(((taken + pending) / entitlement) * 100)) : 0;

    return (
        <Card className="p-5 transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-medium text-slate-500">{balance.leave_type_name}</h3>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">
                        {remaining}
                        <span className="ml-1 text-base font-normal text-slate-500">days left</span>
                    </p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accent.bg}`}>
                    <CalendarHeart className={`h-5 w-5 ${accent.text}`} aria-hidden="true" />
                </span>
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${accent.bar} transition-all`} style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{balanceMessage(remaining, entitlement)}</p>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                    <dt className="text-[11px] text-slate-500">Entitlement</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">{entitlement}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                    <dt className="text-[11px] text-slate-500">Taken</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">{taken}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                    <dt className="text-[11px] text-slate-500">Pending</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">{pending}</dd>
                </div>
            </dl>
        </Card>
    );
}

export function MyBalancesPage() {
    const [balances, setBalances] = useState([]);
    const [year, setYear] = useState(currentYear);
    // Tracks which year `balances` actually belongs to, so "loading" can be
    // derived rather than set from inside the effect.
    const [loadedYear, setLoadedYear] = useState(null);
    const [loadError, setLoadError] = useState(null);

    const [myRequests, setMyRequests] = useState([]);
    const [requestsLoaded, setRequestsLoaded] = useState(false);
    const [requestsError, setRequestsError] = useState(null);

    const [showRequestForm, setShowRequestForm] = useState(false);

    // Bumped after a request is submitted/withdrawn/cancelled, to re-trigger
    // both fetch effects — a request always changes both the balance and the
    // request list, so they reload together.
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    const loading = loadedYear !== year;

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

    function handleSubmitted() {
        setShowRequestForm(false);
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
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {balances.map((balance, index) => (
                        <BalanceCard key={balance.id} balance={balance} accent={ACCENTS[index % ACCENTS.length]} />
                    ))}
                </div>
            )}

            <section className="mt-8">
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
                        <MyLeaveRequestList requests={myRequests} onChanged={reload} />
                    </div>
                )}
            </section>
        </div>
    );
}
