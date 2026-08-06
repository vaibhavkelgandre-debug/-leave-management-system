import { useEffect, useState } from "react";
import { getUsers, inviteEmployee } from "../services/userService.js";
import { EmployeeTableRow } from "../components/team/EmployeeTableRow.jsx";
import { ManagerSelect } from "../components/team/ManagerSelect.jsx";
import { ROLES } from "../constants/roles.js";

const emptyForm = { firstName: "", lastName: "", email: "", role: ROLES.EMPLOYEE, managerId: "" };

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

export function EmployeesPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    const [showInviteForm, setShowInviteForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [inviteError, setInviteError] = useState(null);
    const [inviteResult, setInviteResult] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    async function loadUsers() {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
            setLoadError(null);
        } catch {
            setLoadError("Unable to load employees");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadUsers();
    }, []);

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    const managerRequired = form.role === ROLES.EMPLOYEE;
    const managerOptions = users.filter((u) => u.role !== ROLES.EMPLOYEE);

    async function handleInvite(event) {
        event.preventDefault();
        setSubmitting(true);
        setInviteError(null);
        setInviteResult(null);

        try {
            const payload = managerRequired ? form : { ...form, managerId: null };
            const result = await inviteEmployee(payload);
            setInviteResult(result);
            setForm(emptyForm);
            await loadUsers();
        } catch (err) {
            setInviteError(err.response?.data?.message || "Unable to invite employee");
        } finally {
            setSubmitting(false);
        }
    }

    function handleCancel() {
        setShowInviteForm(false);
        setForm(emptyForm);
        setInviteError(null);
    }

    return (
        <div>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-slate-900">All Employees</h1>
                {!showInviteForm && (
                    <button
                        type="button"
                        onClick={() => setShowInviteForm(true)}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        + Add Employee
                    </button>
                )}
            </div>

            {showInviteForm && (
            <section className="mt-6 max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Invite an employee</h2>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="text-sm font-medium text-slate-500 hover:text-slate-700"
                    >
                        Cancel
                    </button>
                </div>
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

                    {managerRequired && (
                        <div>
                            <label htmlFor="managerId" className={labelClasses}>
                                Manager
                            </label>
                            <ManagerSelect
                                id="managerId"
                                label="Manager"
                                value={form.managerId}
                                onChange={(event) => setForm((prev) => ({ ...prev, managerId: event.target.value }))}
                                options={managerOptions}
                                targetRole={ROLES.EMPLOYEE}
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
                    <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                        Invited. Share this link with them:
                        <br />
                        <code className="break-all text-xs">{inviteResult.inviteLink}</code>
                    </p>
                )}
            </section>
            )}

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900">Employees</h2>
                {loading && <p role="status" className="mt-2 text-sm text-slate-500">Loading…</p>}
                {loadError && <p role="alert" className="mt-2 text-sm text-red-600">{loadError}</p>}
                {!loading && !loadError && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Employee</th>
                                    <th className="px-4 py-2 font-medium">Role</th>
                                    <th className="px-4 py-2 font-medium">Status</th>
                                    <th className="px-4 py-2 font-medium">Manager</th>
                                    <th className="px-4 py-2 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((u) => (
                                    <EmployeeTableRow key={u.id} user={u} users={users} onChanged={loadUsers} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
