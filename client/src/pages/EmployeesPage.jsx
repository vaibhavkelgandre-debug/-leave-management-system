import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUsers } from "../services/userService.js";
import { EmployeeTableRow } from "../components/team/EmployeeTableRow.jsx";

export function EmployeesPage() {
    // null until the first load resolves — doubles as the loading sentinel so
    // no setState happens synchronously inside the effect.
    const [users, setUsers] = useState(null);
    const [loadError, setLoadError] = useState(null);

    // Bumped by a row after it mutates a user, to re-trigger the fetch effect.
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    const loading = users === null;

    useEffect(() => {
        let cancelled = false;

        getUsers()
            .then((data) => {
                if (cancelled) return;
                setUsers(data);
                setLoadError(null);
            })
            .catch(() => {
                if (cancelled) return;
                setUsers([]);
                setLoadError("Unable to load employees");
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    return (
        <div>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-slate-900">All Employees</h1>
                {/* Inviting lives on its own route rather than an inline form, so
                    the list stays uncluttered and the invite page can be linked to
                    directly. */}
                <Link
                    to="/dashboard/employees/new"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                >
                    + Add Employee
                </Link>
            </div>

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
                                    <EmployeeTableRow key={u.id} user={u} users={users} onChanged={reload} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
