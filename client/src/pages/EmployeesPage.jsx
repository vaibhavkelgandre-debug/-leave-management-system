import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { getUsers } from "../services/userService.js";
import { EmployeeTable } from "../components/team/EmployeeTable.jsx";
import { EmployeeTeamCard } from "../components/team/EmployeeTeamCard.jsx";
import { Button } from "../components/ui/Button.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { groupEmployeesForOrgView } from "../utils/employeeGroups.js";

export function EmployeesPage() {
    // null until the first load resolves — doubles as the loading sentinel so
    // no setState happens synchronously inside the effect.
    const [users, setUsers] = useState(null);
    const [loadError, setLoadError] = useState(null);

    // Bumped by a row to re-trigger the fetch effect. A successful invite no
    // longer bumps this directly — AddEmployeePage.jsx is its own route now,
    // so returning here via its "Back to All Employees" link remounts this
    // page and refetches on its own.
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
                description="Grouped by reporting line — each team's own table lists who reports to whom. Manage your own team's details from My Team."
                action={
                    <Button as={Link} to="/dashboard/employees/new" icon={Plus}>
                        Add Employee
                    </Button>
                }
            />

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
                        <div className="mt-3">
                            <EmployeeTable
                                people={leadership}
                                users={users}
                                onChanged={reload}
                                showReportsTo
                                showActions={false}
                                emptyMessage="No one yet."
                            />
                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-slate-900">Teams</h2>
                        {teams.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-500">No managers yet — invite one to start a team.</p>
                        ) : (
                            <div className="mt-3 space-y-4">
                                {teams.map((team) => (
                                    <EmployeeTeamCard
                                        key={team.manager.id}
                                        team={team}
                                        users={users}
                                        onChanged={reload}
                                        showActions={false}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {unassigned.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-900">Reports directly to HR</h2>
                            <div className="mt-3">
                                <EmployeeTable
                                    people={unassigned}
                                    users={users}
                                    onChanged={reload}
                                    showReportsTo
                                    showActions={false}
                                />
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
