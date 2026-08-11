// FR-024: HR-only. Two tabs — "Browse Requests" (every filter resolved
// server-side: employeeId/leaveTypeId/status/date-range, never a client-side
// array filter over an already-fetched list) and "Leave Report" (leave taken
// per employee over a period, with a CSV download).
import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import {
    getFilteredLeaveRequests,
    getLeaveTakenReport,
    getLeaveTakenReportCsvUrl,
} from "../services/leaveRequestService.js";
import { getUsers } from "../services/userService.js";
import { getLeaveTypes } from "../services/leaveTypeService.js";
import { TeamRequestList } from "../components/leave/TeamRequestList.jsx";
import { Avatar } from "../components/ui/Avatar.jsx";
import { Badge, RoleBadge } from "../components/ui/Badge.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";

const TABS = { BROWSE: "browse", REPORT: "report" };
const STATUS_OPTIONS = ["SUBMITTED", "APPROVED", "REJECTED", "WITHDRAWN", "CANCELLED"];
const emptyFilters = { employeeId: "", leaveTypeId: "", status: "", startDate: "", endDate: "" };

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-xs font-medium text-slate-700";

function BrowseRequestsTab() {
    const [users, setUsers] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [filters, setFilters] = useState(emptyFilters);
    const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
    const [requests, setRequests] = useState([]);
    // Tracks which `appliedFilters` object `requests` belongs to (reference
    // equality, not a deep compare — every call to setAppliedFilters passes
    // a fresh object), so "loading" can be derived rather than set from
    // inside the effect.
    const [loadedFilters, setLoadedFilters] = useState(null);
    const [error, setError] = useState(null);

    const loading = loadedFilters !== appliedFilters;

    useEffect(() => {
        getUsers()
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

        getFilteredLeaveRequests(activeFilters)
            .then((data) => {
                if (cancelled) return;
                setRequests(data);
                setError(null);
                setLoadedFilters(appliedFilters);
            })
            .catch(() => {
                if (cancelled) return;
                setRequests([]);
                setError("Unable to load requests");
                setLoadedFilters(appliedFilters);
            });

        return () => {
            cancelled = true;
        };
    }, [appliedFilters]);

    function handleFilterChange(event) {
        const { name, value } = event.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    }

    function handleApply(event) {
        event.preventDefault();
        setAppliedFilters(filters);
    }

    function handleClear() {
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
                        <select
                            id="employeeId"
                            name="employeeId"
                            value={filters.employeeId}
                            onChange={handleFilterChange}
                            className={inputClasses}
                        >
                            <option value="">Everyone</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.first_name} {user.last_name}
                                </option>
                            ))}
                        </select>
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
                    <TeamRequestList requests={requests} canOverride={false} onChanged={() => {}} readOnly />
                )}
            </div>
        </div>
    );
}

function LeaveReportTab() {
    const [period, setPeriod] = useState({ startDate: "", endDate: "" });
    const [rows, setRows] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const hasValidPeriod = Boolean(period.startDate && period.endDate && period.endDate >= period.startDate);

    function handleChange(event) {
        const { name, value } = event.target;
        setPeriod((prev) => ({ ...prev, [name]: value }));
        setRows(null);
    }

    async function handleGenerate(event) {
        event.preventDefault();
        if (!hasValidPeriod) return;

        setLoading(true);
        setError(null);
        try {
            const data = await getLeaveTakenReport(period);
            setRows(data);
        } catch {
            setError("Unable to generate the report");
        } finally {
            setLoading(false);
        }
    }

    const totalDays = (rows ?? []).reduce((sum, row) => sum + Number(row.total_days_taken), 0);

    return (
        <div>
            <Card className="p-4">
                <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-3">
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
                </form>
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
