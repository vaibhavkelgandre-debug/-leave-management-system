// FR-024: HR-only. Two tabs — "Browse Requests" (every filter resolved
// server-side: employeeId/leaveTypeId/status/date-range, never a client-side
// array filter over an already-fetched list) and "Leave Report" (leave taken
// per employee over a period, with a CSV download).
import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import {
    getFilteredLeaveRequests,
    getLeaveTakenReport,
    getLeaveTakenReportCsvUrl,
} from "../services/leaveRequestService.js";
import { getUserOptions } from "../services/userService.js";
import { getLeaveTypes } from "../services/leaveTypeService.js";
import { LeaveRequestTable } from "../components/leave/LeaveRequestTable.jsx";
import { Avatar } from "../components/ui/Avatar.jsx";
import { Badge, RoleBadge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { SearchSelect } from "../components/ui/SearchSelect.jsx";

const TABS = { BROWSE: "browse", REPORT: "report" };
const STATUS_OPTIONS = ["SUBMITTED", "APPROVED", "REJECTED", "WITHDRAWN", "CANCELLED"];
const emptyFilters = { employeeId: "", leaveTypeId: "", status: "", startDate: "", endDate: "" };

// Matches NotificationsPage's own page size — one browse-table convention
// rather than a different number per screen. The endpoint caps it at 100.
const PAGE_SIZE = 25;

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-xs font-medium text-slate-700";

function BrowseRequestsTab() {
    const [users, setUsers] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [filters, setFilters] = useState(emptyFilters);
    const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
    const [requests, setRequests] = useState([]);
    // Browse results are paginated (the unfiltered default is every request in
    // this HR admin's branch — thousands of rows at NFR-7 scale). `total` is
    // the server's count for the *same* filters, which is what makes
    // "showing 1–25 of N" and the next-page guard honest rather than a guess
    // from the page's own length.
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    // Tracks which `appliedFilters` object `requests` belongs to (reference
    // equality, not a deep compare — every call to setAppliedFilters passes
    // a fresh object), so "loading" can be derived rather than set from
    // inside the effect.
    const [loadedFilters, setLoadedFilters] = useState(null);
    const [error, setError] = useState(null);

    const loading = loadedFilters !== appliedFilters;

    // SearchSelect needs {value,label} pairs rather than raw user rows —
    // built once per `users` fetch, not recomputed on every keystroke. Role
    // badge + email ride along as `badge`/`sublabel` so two people who share
    // a name (common past a few hundred employees) are still distinguishable
    // in the dropdown — email is the one field guaranteed unique per person.
    const employeeOptions = useMemo(
        () =>
            users.map((user) => ({
                value: user.id,
                label: `${user.first_name} ${user.last_name}`,
                sublabel: user.email,
                badge: <RoleBadge role={user.role} />,
            })),
        [users]
    );

    useEffect(() => {
        getUserOptions()
            .then(setUsers)
            .catch(() => setUsers([]));
        getLeaveTypes({ includeInactive: true })
            .then(setLeaveTypes)
            .catch(() => setLeaveTypes([]));
    }, []);

    useEffect(() => {
        let cancelled = false;

        // Strips empty-string filters rather than sending them — an empty
        // employeeId/leaveTypeId would otherwise fail the server's UUID
        // validation instead of being treated as "no filter".
        const activeFilters = Object.fromEntries(
            Object.entries(appliedFilters).filter(([, value]) => value !== "")
        );

        getFilteredLeaveRequests({ ...activeFilters, limit: PAGE_SIZE, offset })
            .then((data) => {
                if (cancelled) return;
                setRequests(data.requests);
                setTotal(data.total);
                setError(null);
                setLoadedFilters(appliedFilters);
            })
            .catch(() => {
                if (cancelled) return;
                setRequests([]);
                setTotal(0);
                setError("Unable to load requests");
                setLoadedFilters(appliedFilters);
            });

        return () => {
            cancelled = true;
        };
    }, [appliedFilters, offset]);

    function handleFilterChange(event) {
        const { name, value } = event.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    }

    function handleApply(event) {
        event.preventDefault();
        // Back to page 1: a narrower filter can easily have fewer rows than
        // the offset the previous result set was on, which would render an
        // empty table that looks like "no matches".
        setOffset(0);
        setAppliedFilters(filters);
    }

    function handleClear() {
        setOffset(0);
        setFilters(emptyFilters);
        setAppliedFilters(emptyFilters);
    }

    return (
        <div>
            <Card className="p-4">
                <form onSubmit={handleApply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                        <label htmlFor="employeeId" className={labelClasses}>
                            Employee
                        </label>
                        <SearchSelect
                            id="employeeId"
                            aria-label="Filter by employee"
                            options={employeeOptions}
                            value={filters.employeeId}
                            onChange={(employeeId) => setFilters((prev) => ({ ...prev, employeeId }))}
                            placeholder="Everyone"
                        />
                    </div>

                    <div>
                        <label htmlFor="leaveTypeId" className={labelClasses}>
                            Leave type
                        </label>
                        <select
                            id="leaveTypeId"
                            name="leaveTypeId"
                            value={filters.leaveTypeId}
                            onChange={handleFilterChange}
                            className={inputClasses}
                        >
                            <option value="">Any leave type</option>
                            {leaveTypes.map((leaveType) => (
                                <option key={leaveType.id} value={leaveType.id}>
                                    {leaveType.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="status" className={labelClasses}>
                            Status
                        </label>
                        <select
                            id="status"
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className={inputClasses}
                        >
                            <option value="">Any status</option>
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="startDate" className={labelClasses}>
                            From
                        </label>
                        <input
                            id="startDate"
                            name="startDate"
                            type="date"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label htmlFor="endDate" className={labelClasses}>
                            To
                        </label>
                        <input
                            id="endDate"
                            name="endDate"
                            type="date"
                            min={filters.startDate || undefined}
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            className={inputClasses}
                        />
                    </div>

                    <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
                        <Button type="submit" icon={Search} size="sm">
                            Apply filters
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={handleClear}>
                            Clear
                        </Button>
                    </div>
                </form>
            </Card>

            <div className="mt-6">
                {loading && (
                    <p role="status" className="text-sm text-slate-500">
                        Loading…
                    </p>
                )}
                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}
                {!loading && !error && requests.length === 0 && (
                    <p className="text-sm text-slate-500">No requests match these filters.</p>
                )}
                {!loading && !error && requests.length > 0 && (
                    <>
                        <LeaveRequestTable requests={requests} />
                        {/* Same "Showing X–Y of Z" + prev/next shape as
                            NotificationsPage — the app's one pagination
                            control, so a second list doesn't invent a second
                            idiom. Hidden entirely when everything fits on one
                            page: a lone disabled pair of buttons is noise. */}
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
            </div>
        </div>
    );
}

// "This month"/"Last month"/"This year" — the three ranges HR reaches for
// most often, so a report can be pulled in one click instead of typing both
// dates by hand every time. Pure so it's trivial to test independent of the
// component's own state.
function computePresetRange(preset, today = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (preset === "thisMonth") {
        return {
            startDate: toKey(new Date(today.getFullYear(), today.getMonth(), 1)),
            endDate: toKey(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
        };
    }
    if (preset === "lastMonth") {
        return {
            startDate: toKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
            endDate: toKey(new Date(today.getFullYear(), today.getMonth(), 0)),
        };
    }
    // thisYear
    return { startDate: `${today.getFullYear()}-01-01`, endDate: `${today.getFullYear()}-12-31` };
}

const PRESETS = [
    { key: "thisMonth", label: "This month" },
    { key: "lastMonth", label: "Last month" },
    { key: "thisYear", label: "This year" },
];

function LeaveReportTab() {
    const emptyPeriod = { startDate: "", endDate: "" };
    const [period, setPeriod] = useState(emptyPeriod);
    const [rows, setRows] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const hasValidPeriod = Boolean(period.startDate && period.endDate && period.endDate >= period.startDate);

    function handleChange(event) {
        const { name, value } = event.target;
        setPeriod((prev) => ({ ...prev, [name]: value }));
        setRows(null);
    }

    async function generateReport(targetPeriod) {
        setLoading(true);
        setError(null);
        try {
            const data = await getLeaveTakenReport(targetPeriod);
            setRows(data);
        } catch {
            setError("Unable to generate the report");
        } finally {
            setLoading(false);
        }
    }

    function handleGenerate(event) {
        event.preventDefault();
        if (!hasValidPeriod) return;
        generateReport(period);
    }

    // One click sets the range *and* runs the report — the whole point of a
    // preset is skipping the extra "now press Generate" step.
    function applyPreset(preset) {
        const range = computePresetRange(preset);
        setPeriod(range);
        generateReport(range);
    }

    function handleClear() {
        setPeriod(emptyPeriod);
        setRows(null);
        setError(null);
    }

    const totalDays = (rows ?? []).reduce((sum, row) => sum + Number(row.total_days_taken), 0);

    return (
        <div>
            <Card className="p-4">
                <form onSubmit={handleGenerate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div>
                        <label htmlFor="report-startDate" className={labelClasses}>
                            From
                        </label>
                        <input
                            id="report-startDate"
                            name="startDate"
                            type="date"
                            value={period.startDate}
                            onChange={handleChange}
                            required
                            className={inputClasses}
                        />
                    </div>
                    <div>
                        <label htmlFor="report-endDate" className={labelClasses}>
                            To
                        </label>
                        <input
                            id="report-endDate"
                            name="endDate"
                            type="date"
                            min={period.startDate || undefined}
                            value={period.endDate}
                            onChange={handleChange}
                            required
                            className={inputClasses}
                        />
                    </div>
                    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
                        <Button type="submit" size="sm" loading={loading} disabled={!hasValidPeriod}>
                            Generate report
                        </Button>
                        <Button
                            as="a"
                            href={hasValidPeriod ? getLeaveTakenReportCsvUrl(period) : undefined}
                            variant="secondary"
                            size="sm"
                            icon={Download}
                            aria-disabled={!hasValidPeriod}
                            onClick={(event) => {
                                if (!hasValidPeriod) event.preventDefault();
                            }}
                        >
                            Download CSV
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                            Clear
                        </Button>
                    </div>
                </form>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs font-medium text-slate-500">Quick ranges:</span>
                    {PRESETS.map((preset) => (
                        <Button
                            key={preset.key}
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={loading}
                            onClick={() => applyPreset(preset.key)}
                        >
                            {preset.label}
                        </Button>
                    ))}
                </div>

                {error && (
                    <p role="alert" className="mt-3 text-sm text-red-600">
                        {error}
                    </p>
                )}
            </Card>

            {rows !== null && (
                <div className="mt-6">
                    {rows.length === 0 ? (
                        <p className="text-sm text-slate-500">Nobody had an approved leave request in this period.</p>
                    ) : (
                        <Card className="overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                                <h2 className="text-sm font-semibold text-slate-900">Leave taken per employee</h2>
                                <span className="text-xs text-slate-500">
                                    {rows.length} {rows.length === 1 ? "employee" : "employees"} · {totalDays} total day
                                    {totalDays === 1 ? "" : "s"}
                                </span>
                            </div>
                            <ul className="divide-y divide-slate-100">
                                {rows.map((row) => (
                                    <li key={row.employee_id} className="flex items-center gap-3 px-4 py-3">
                                        <Avatar firstName={row.employee_first_name} lastName={row.employee_last_name} size="sm" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-slate-900">
                                                    {row.employee_first_name} {row.employee_last_name}
                                                </span>
                                                <RoleBadge role={row.employee_role} />
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {row.request_count} request{row.request_count === 1 ? "" : "s"}
                                            </p>
                                        </div>
                                        <Badge className="bg-indigo-100 text-indigo-700">
                                            {Number(row.total_days_taken)} day{Number(row.total_days_taken) === 1 ? "" : "s"}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}

export function HrReportsPage() {
    const [activeTab, setActiveTab] = useState(TABS.BROWSE);

    return (
        <div>
            <PageHeader
                title="Reports"
                description="Browse every leave request in the company, or generate a leave-taken report per employee."
            />

            <div role="tablist" aria-label="Reports view" className="mt-6 flex gap-1 border-b border-slate-200">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === TABS.BROWSE}
                    onClick={() => setActiveTab(TABS.BROWSE)}
                    className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                        activeTab === TABS.BROWSE
                            ? "border-indigo-600 text-indigo-700"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Browse Requests
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === TABS.REPORT}
                    onClick={() => setActiveTab(TABS.REPORT)}
                    className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                        activeTab === TABS.REPORT
                            ? "border-indigo-600 text-indigo-700"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Leave Report
                </button>
            </div>

            <div className="mt-6">{activeTab === TABS.BROWSE ? <BrowseRequestsTab /> : <LeaveReportTab />}</div>
        </div>
    );
}
