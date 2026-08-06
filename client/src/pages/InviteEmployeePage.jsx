import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUsers, inviteEmployee } from "../services/userService.js";
import { toErrorMessage } from "../services/httpError.js";
import { ManagerSelect } from "../components/team/ManagerSelect.jsx";
import { isValidEmail } from "../utils/validation.js";
import { ROLES } from "../constants/roles.js";

const emptyForm = { firstName: "", lastName: "", email: "", role: ROLES.EMPLOYEE, managerId: "" };

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

export function InviteEmployeePage() {
    // Only needed to populate the manager dropdown — null until loaded so no
    // setState happens synchronously inside the effect.
    const [users, setUsers] = useState(null);

    const [form, setForm] = useState(emptyForm);
    const [inviteError, setInviteError] = useState(null);
    const [inviteResult, setInviteResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getUsers()
            .then((data) => {
                if (!cancelled) setUsers(data);
            })
            .catch(() => {
                // A failed load only costs us the manager suggestions; the form
                // itself still works, so this isn't surfaced as a page error.
                if (!cancelled) setUsers([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: value,
            // Who they may report to depends on the role, so a previously picked
            // person can become invalid — clear it rather than submit a bad pair.
            ...(name === "role" ? { managerId: "" } : {}),
        }));
    }

    // HR admins sit at the top of the tree and have nobody to report to.
    const needsReportingLine = form.role !== ROLES.HR_ADMIN;

    // Mirrors the server's hierarchy rule (reportingService.js): an employee may
    // report to a manager or an HR admin, but a manager only to an HR admin.
    const reportingOptions = (users ?? []).filter((u) =>
        form.role === ROLES.MANAGER ? u.role === ROLES.HR_ADMIN : u.role !== ROLES.EMPLOYEE
    );

    const reportingLabel = form.role === ROLES.MANAGER ? "Reporting HR admin" : "Manager";

    async function handleInvite(event) {
        event.preventDefault();
        setInviteError(null);
        setInviteResult(null);

        // The browser's type="email" check accepts a domain with no dot (e.g.
        // "viraj@123"), which the server then rejects. Catch it here so the user
        // gets a precise message instead of a failed round-trip.
        if (!isValidEmail(form.email.trim())) {
            setInviteError("Enter a valid email address");
            return;
        }

        setSubmitting(true);

        try {
            const payload = needsReportingLine ? form : { ...form, managerId: null };
            const result = await inviteEmployee(payload);
            setInviteResult(result);
            setForm(emptyForm);
        } catch (err) {
            setInviteError(toErrorMessage(err, "Unable to invite employee"));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-md">
            <Link to="/dashboard/employees" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                ← Back to All Employees
            </Link>

            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-slate-900">Invite an employee</h1>
                <p className="mt-1 text-sm text-slate-500">
                    They'll get a link to set their own password. Nothing is emailed — share the link yourself.
                </p>

                <form onSubmit={handleInvite} className="mt-6 space-y-4">
                    {inviteError && (
                        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {inviteError}
                        </p>
                    )}

                    <div>
                        <label htmlFor="firstName" className={labelClasses}>
                            First name
                        </label>
                        <input
                            id="firstName"
                            name="firstName"
                            value={form.firstName}
                            onChange={handleChange}
                            required
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label htmlFor="lastName" className={labelClasses}>
                            Last name
                        </label>
                        <input
                            id="lastName"
                            name="lastName"
                            value={form.lastName}
                            onChange={handleChange}
                            required
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label htmlFor="email" className={labelClasses}>
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={handleChange}
                            required
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label htmlFor="role" className={labelClasses}>
                            Role
                        </label>
                        <select id="role" name="role" value={form.role} onChange={handleChange} className={inputClasses}>
                            <option value={ROLES.EMPLOYEE}>Employee</option>
                            <option value={ROLES.MANAGER}>Manager</option>
                            <option value={ROLES.HR_ADMIN}>HR Admin</option>
                        </select>
                    </div>

                    {needsReportingLine && (
                        <div>
                            <label htmlFor="managerId" className={labelClasses}>
                                {reportingLabel}
                            </label>
                            <ManagerSelect
                                id="managerId"
                                label={reportingLabel}
                                value={form.managerId}
                                onChange={(event) => setForm((prev) => ({ ...prev, managerId: event.target.value }))}
                                options={reportingOptions}
                                targetRole={form.role}
                                allowNone={false}
                                required
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "Inviting…" : "Invite"}
                    </button>
                </form>

                {inviteResult && (
                    <div className="mt-6 rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
                        <p className="font-medium">Invited. Share this link with them:</p>
                        <code className="mt-1 block break-all text-xs">{inviteResult.inviteLink}</code>
                        <p className="mt-3 text-xs text-green-700">
                            Open it in a private window — following it in this browser would sign you in as them.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
