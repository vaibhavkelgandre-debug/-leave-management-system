import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getUsers } from "../services/userService.js";
import { EmployeePersonRow } from "../components/team/EmployeePersonRow.jsx";
import { EmployeeTeamCard } from "../components/team/EmployeeTeamCard.jsx";
import { InviteEmployeeForm } from "../components/team/InviteEmployeeForm.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { groupEmployeesForOrgView } from "../utils/employeeGroups.js";

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

    const { leadership, teams, unassigned } = loading || loadError ? { leadership: [], teams: [], unassigned: [] } : groupEmployeesForOrgView(users);

    return (
        <div>
            <PageHeader
                title="All Employees"
                description="Grouped by reporting line — each team's own card lists who reports to whom."
                action={
                    <Button icon={Plus} onClick={() => setShowInviteModal(true)}>
                        Add Employee
                    </Button>
                }
            />

            <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite an employee">
                <InviteEmployeeForm onInvited={reload} />
            </Modal>

            {loading && (
                <p role="status" className="mt-8 text-sm text-slate-500">
                    Loading…
                </p>
            )}
            {loadError && (
                <p role="alert" className="mt-8 text-sm text-red-600">
                    {loadError}
                </p>
            )}

            {!loading && !loadError && (
                <div className="mt-8 space-y-8">
                    <section>
                        <h2 className="text-lg font-semibold text-slate-900">Leadership</h2>
                        <Card className="mt-3 overflow-hidden">
                            <ul className="divide-y divide-slate-100">
                                {leadership.map((hrAdmin) => (
                                    <EmployeePersonRow
                                        key={hrAdmin.id}
                                        user={hrAdmin}
                                        users={users}
                                        onChanged={reload}
                                        showReportsTo
                                    />
                                ))}
                            </ul>
                        </Card>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-slate-900">Teams</h2>
                        {teams.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-500">No managers yet — invite one to start a team.</p>
                        ) : (
                            <div className="mt-3 space-y-4">
                                {teams.map((team) => (
                                    <EmployeeTeamCard key={team.manager.id} team={team} users={users} onChanged={reload} />
                                ))}
                            </div>
                        )}
                    </section>

                    {unassigned.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-900">Reports directly to HR</h2>
                            <Card className="mt-3 overflow-hidden">
                                <ul className="divide-y divide-slate-100">
                                    {unassigned.map((employee) => (
                                        <EmployeePersonRow
                                            key={employee.id}
                                            user={employee}
                                            users={users}
                                            onChanged={reload}
                                            showReportsTo
                                        />
                                    ))}
                                </ul>
                            </Card>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
