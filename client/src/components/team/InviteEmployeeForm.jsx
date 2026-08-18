import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { getUsers, inviteEmployee } from "../../services/userService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { isValidEmail } from "../../utils/validation.js";
import { useAuth } from "../../hooks/useAuth.js";
import { ROLES } from "../../constants/roles.js";
import { Button } from "../ui/Button.jsx";
import { ManagerSelect } from "./ManagerSelect.jsx";

const emptyForm = { firstName: "", lastName: "", email: "", role: ROLES.EMPLOYEE, managerId: "" };

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

export function InviteEmployeeForm({ onInvited }) {
    const { user: currentUser } = useAuth();
    // Only needed to populate the manager dropdown — null until loaded so no
    // setState happens synchronously inside the effect.
    const [users, setUsers] = useState(null);

    const [form, setForm] = useState(emptyForm);
    const [inviteError, setInviteError] = useState(null);
    const [inviteResult, setInviteResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);

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
            // Switching to HR_ADMIN defaults to the inviter themself ("You") —
            // a new HR admin reports to whoever created them by default, still
            // changeable to another HR admin below.
            ...(name === "role" ? { managerId: value === ROLES.HR_ADMIN ? currentUser.id : "" } : {}),
        }));
    }

    // Mirrors the server's hierarchy rule (reportingService.js): an employee
    // may report to a manager or an HR admin, a manager only to an HR admin,
    // and an HR admin to another HR admin or to the super admin. Spelled out
    // explicitly (rather than "!== EMPLOYEE") now that a 4th role exists —
    // an employee/manager must never see SUPER_ADMIN as an option here.
    const reportingOptions = (users ?? []).filter((u) => {
        if (form.role === ROLES.HR_ADMIN) return u.role === ROLES.HR_ADMIN || u.role === ROLES.SUPER_ADMIN;
        if (form.role === ROLES.MANAGER) return u.role === ROLES.HR_ADMIN;
        return u.role === ROLES.MANAGER || u.role === ROLES.HR_ADMIN;
    });

    const reportingLabel =
        form.role === ROLES.MANAGER ? "Reporting HR admin" : form.role === ROLES.HR_ADMIN ? "Reports to" : "Manager";

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
            // Every role picks a reporting line now, including HR_ADMIN — an
            // HR admin's manager must be another HR admin (their creator, by
            // default). Only the root HR_ADMIN(s), created via the separate
            // public /register/hr flow rather than this form, ever have no
            // manager at all.
            const result = await inviteEmployee(form);
            setInviteResult(result);
            setForm(emptyForm);
            onInvited?.();
        } catch (err) {
            setInviteError(toErrorMessage(err, "Unable to invite employee"));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCopyLink() {
        try {
            await navigator.clipboard.writeText(inviteResult.inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access can fail (permissions, insecure context) — the
            // link is still visible to copy by hand, so this fails silently.
        }
    }

    return (
        <div>
            <p className="text-sm text-slate-500">
                They'll get a link to set their own password. Nothing is emailed — share the link yourself.
            </p>

            <form onSubmit={handleInvite} className="mt-4 space-y-4">
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
                        currentUserId={currentUser.id}
                    />
                </div>

                <Button type="submit" loading={submitting} className="w-full">
                    Invite
                </Button>
            </form>

            {inviteResult && (
                <div className="mt-6 rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
                    <p className="font-medium">Invited. Share this link with them:</p>
                    <div className="mt-2 flex items-center gap-2">
                        <code className="block flex-1 break-all rounded bg-white/70 px-2 py-1.5 text-xs">
                            {inviteResult.inviteLink}
                        </code>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={copied ? Check : Copy}
                            onClick={handleCopyLink}
                        >
                            {copied ? "Copied" : "Copy"}
                        </Button>
                    </div>
                    <p className="mt-3 text-xs text-green-700">
                        Open it in a private window — following it in this browser would sign you in as them.
                    </p>
                </div>
            )}
        </div>
    );
}
