// HR's monthly payroll run (Module 5 v2) — calculate then approve, no file
// involved. "Calculate" reads each payroll-ready employee's salary
// structure + LOP and computes net pay, writing nothing; "Approve" re-runs
// the same calculation server-side and commits it (see
// salarySlipService.js's module comment for why nothing computed here is
// ever resent — every figure is recomputed fresh from the DB at that point).
// `role`/`profileStatus` filters narrow the run to a slice of HR's subtree
// (e.g. only VERIFIED employees) — carried through from calculate to
// approve unchanged, so what gets confirmed is exactly what was previewed.
import { useState } from "react";
import { calculatePayroll, confirmPayroll } from "../../services/salarySlipService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Button } from "../ui/Button.jsx";
import { Badge } from "../ui/Badge.jsx";
import { ROLES } from "../../constants/roles.js";

function money(value) {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const selectClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function PayrollRunForm({ onSaved }) {
    const [payPeriod, setPayPeriod] = useState("");
    const [role, setRole] = useState("");
    const [profileStatus, setProfileStatus] = useState("");
    const [preview, setPreview] = useState(null); // { rows, summary }
    const [result, setResult] = useState(null); // { committed, skipped }
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Sent as `undefined` for "All" rather than "" — the server's zod schema
    // only recognizes each field's enum values or its absence.
    const filters = { role: role || undefined, profileStatus: profileStatus || undefined };

    async function handleCalculate(event) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);
        try {
            const data = await calculatePayroll(payPeriod, filters);
            setPreview(data);
            setResult(null);
        } catch (err) {
            setFormError(toErrorMessage(err, "Unable to calculate payroll"));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleApprove() {
        setSubmitting(true);
        setFormError(null);
        try {
            const data = await confirmPayroll(payPeriod, filters);
            setResult(data);
            onSaved?.();
        } catch (err) {
            setFormError(toErrorMessage(err, "Unable to approve payroll"));
        } finally {
            setSubmitting(false);
        }
    }

    function startOver() {
        setPayPeriod("");
        setRole("");
        setProfileStatus("");
        setPreview(null);
        setResult(null);
        setFormError(null);
    }

    if (result) {
        return (
            <div className="space-y-4">
                <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                    Generated {result.committed.length} payslip{result.committed.length === 1 ? "" : "s"} for {payPeriod}.
                    {result.skipped.length > 0 &&
                        ` ${result.skipped.length} employee${result.skipped.length === 1 ? "" : "s"} skipped.`}
                </p>
                {result.skipped.length > 0 && (
                    // A row can still be skipped here even after showing "Ready"
                    // in the preview — e.g. someone else confirmed this period
                    // for that employee in between preview and approve — so the
                    // reason is worth showing here too, not just a bare count.
                    <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {result.skipped.map((row) => (
                            <li key={row.employeeId}>
                                {row.employeeName ?? row.employeeId}
                                {row.skipReason ? `: ${row.skipReason}` : ""}
                            </li>
                        ))}
                    </ul>
                )}
                <Button variant="secondary" className="w-full" onClick={startOver}>
                    Run another period
                </Button>
            </div>
        );
    }

    if (preview) {
        return (
            <div className="space-y-4">
                {formError && (
                    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        {formError}
                    </p>
                )}

                <p className="text-sm text-slate-600">
                    {preview.summary.ok} of {preview.summary.total} employee{preview.summary.total === 1 ? "" : "s"}{" "}
                    payroll-ready for <span className="font-medium">{payPeriod}</span>.
                </p>

                <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                            <tr>
                                <th className="px-3 py-2">Employee</th>
                                <th className="px-3 py-2">LOP days</th>
                                <th className="px-3 py-2">Net pay</th>
                                <th className="px-3 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {preview.rows.map((row) => (
                                <tr key={row.employeeId}>
                                    <td className="px-3 py-2 text-slate-700">{row.employeeName}</td>
                                    <td className="px-3 py-2 text-slate-700">{row.computed ? row.computed.lopDays : "—"}</td>
                                    <td className="px-3 py-2 text-slate-700">
                                        {row.computed ? money(row.computed.netPay) : "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.status === "ok" ? (
                                            <Badge className="bg-green-100 text-green-700">Ready</Badge>
                                        ) : (
                                            <>
                                                <Badge className="bg-amber-100 text-amber-700">Skipped</Badge>
                                                <p className="mt-0.5 text-xs text-slate-500">{row.skipReason}</p>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={startOver} disabled={submitting}>
                        Start over
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={handleApprove}
                        loading={submitting}
                        disabled={preview.summary.ok === 0}
                    >
                        Approve and generate {preview.summary.ok} payslip{preview.summary.ok === 1 ? "" : "s"}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleCalculate} className="space-y-4">
            {formError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                </p>
            )}

            <div>
                <label htmlFor="payPeriod" className="mb-1 block text-sm font-medium text-slate-700">
                    Pay period
                </label>
                <input
                    id="payPeriod"
                    type="month"
                    required
                    value={payPeriod}
                    onChange={(event) => setPayPeriod(event.target.value)}
                    className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                    Pulls each payroll-ready employee's salary structure and approved leave for the period — nothing to
                    upload.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="payrollRole" className="mb-1 block text-sm font-medium text-slate-700">
                        Role
                    </label>
                    <select
                        id="payrollRole"
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                        className={selectClasses}
                    >
                        <option value="">All roles</option>
                        <option value={ROLES.EMPLOYEE}>Employee</option>
                        <option value={ROLES.MANAGER}>Manager</option>
                        <option value={ROLES.HR_ADMIN}>HR Admin</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="payrollProfileStatus" className="mb-1 block text-sm font-medium text-slate-700">
                        Profile verification status
                    </label>
                    <select
                        id="payrollProfileStatus"
                        value={profileStatus}
                        onChange={(event) => setProfileStatus(event.target.value)}
                        className={selectClasses}
                    >
                        <option value="">All statuses</option>
                        <option value="INCOMPLETE">Incomplete</option>
                        <option value="SUBMITTED">Submitted</option>
                        <option value="VERIFIED">Verified</option>
                    </select>
                </div>
            </div>
            <p className="text-xs text-slate-500">
                Narrow who this run includes — e.g. only VERIFIED employees — before calculating.
            </p>

            <Button type="submit" loading={submitting} className="w-full">
                Calculate
            </Button>
        </form>
    );
}
