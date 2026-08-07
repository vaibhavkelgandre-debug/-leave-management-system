import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getUsers } from "../services/userService.js";
import { EmployeeTableRow } from "../components/team/EmployeeTableRow.jsx";
import { InviteEmployeeForm } from "../components/team/InviteEmployeeForm.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";

export function EmployeesPage() {
    // null until the first load resolves — doubles as the loading sentinel so
    // no setState happens synchronously inside the effect.
    const [users, setUsers] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Bumped by a row (or a successful invite) to re-trigger the fetch effect.
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
            <PageHeader
                title="All Employees"
                action={
                    <Button icon={Plus} onClick={() => setShowInviteModal(true)}>
                        Add Employee
                    </Button>
                }
            />

            <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite an employee">
                <InviteEmployeeForm onInvited={reload} />
            </Modal>

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900">Employees</h2>
                {loading && <p role="status" className="mt-2 text-sm text-slate-500">Loading…</p>}
                {loadError && <p role="alert" className="mt-2 text-sm text-red-600">{loadError}</p>}
                {!loading && !loadError && (
                    <Card className="mt-4 overflow-hidden">
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
                    </Card>
                )}
            </section>
        </div>
    );
}
