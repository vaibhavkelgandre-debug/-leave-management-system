import { useEffect, useState } from "react";
import { getMyBalances } from "../services/leaveBalanceService.js";

const currentYear = new Date().getFullYear();
// A short window around today is enough — there's no leave history before this
// system existed, and balances aren't projected far into the future.
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1];

function BalanceCard({ balance }) {
    const remaining = Number(balance.days_remaining);

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">{balance.leave_type_name}</h3>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
                {remaining}
                <span className="ml-1 text-base font-normal text-slate-500">days left</span>
            </p>
            <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                    <dt className="text-slate-500">Entitlement</dt>
                    <dd className="font-medium text-slate-700">{Number(balance.entitlement)}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-slate-500">Taken</dt>
                    <dd className="font-medium text-slate-700">{Number(balance.days_taken)}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-slate-500">Pending</dt>
                    <dd className="font-medium text-slate-700">{Number(balance.days_pending)}</dd>
                </div>
            </dl>
        </div>
    );
}

export function MyBalancesPage() {
    const [balances, setBalances] = useState([]);
    const [year, setYear] = useState(currentYear);
    // Tracks which year `balances` actually belongs to, so "loading" can be
    // derived rather than set from inside the effect.
    const [loadedYear, setLoadedYear] = useState(null);
    const [loadError, setLoadError] = useState(null);

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
    }, [year]);

    return (
        <div>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-slate-900">My Leave</h1>
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
            </div>

            <p className="mt-1 text-sm text-slate-500">
                Your leave balance for each leave type. Days remaining is entitlement minus days taken and pending.
            </p>

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
                    {balances.map((balance) => (
                        <BalanceCard key={balance.id} balance={balance} />
                    ))}
                </div>
            )}
        </div>
    );
}
