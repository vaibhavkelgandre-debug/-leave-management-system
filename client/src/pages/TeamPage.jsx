import { useEffect, useState } from "react";
import { getMyTeam } from "../services/userService.js";
import { useAuth } from "../hooks/useAuth.js";
import { EmployeePersonRow } from "../components/team/EmployeePersonRow.jsx";
import { Card } from "../components/ui/Card.jsx";

// Editing a report's manager or activate/deactivate status lives here, not
// on "All Employees" (EmployeesPage.jsx) — managing your own team is what
// this page is for, so `EmployeePersonRow`'s actions stay on their default
// (`showActions={true}`) here and get turned off there instead. The
// profile_status badge (`showProfileStatus`) is likewise only turned on
// here, so HR can tell at a glance who on their team is already verified.
function TeamSection({ people, users, onChanged, showReportsTo = false }) {
    return (
        <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {people.map((person) => (
                    <EmployeePersonRow
                        key={person.id}
                        user={person}
                        users={users}
                        onChanged={onChanged}
                        showReportsTo={showReportsTo}
                        showProfileStatus
                    />
                ))}
            </ul>
        </Card>
    );
}

export function TeamPage() {
    const { user: currentUser } = useAuth();
    const [team, setTeam] = useState(null);
    const [error, setError] = useState(null);
    // Bumped by a row's manager-reassign or activate/deactivate action to
    // re-trigger the fetch effect, same pattern as EmployeesPage.jsx.
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    useEffect(() => {
        let cancelled = false;

        getMyTeam()
            .then((data) => {
                if (!cancelled) setTeam(data);
            })
            .catch(() => {
                if (!cancelled) setError("Unable to load your team");
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    if (error) {
        return (
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {error}
                </p>
            </div>
        );
    }

    if (!team) {
        return (
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>
                <p role="status" className="mt-6 text-sm text-slate-500">
                    Loading…
                </p>
            </div>
        );
    }

    if (team.length === 0) {
        return (
            <div>
                <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>
                <p className="mt-6 text-sm text-slate-500">You have no direct reports yet.</p>
            </div>
        );
    }

    // getMyTeam() (reportingService.getTeam) deliberately excludes the
    // caller themselves — but a report's manager-reassign dropdown, and the
    // "reports to" label on an extended-team row, both need to be able to
    // resolve/offer the viewer as a manager too.
    const users = [currentUser, ...team];
    const directReports = team.filter((person) => person.manager_id === currentUser.id);
    const extendedTeam = team.filter((person) => person.manager_id !== currentUser.id);

    return (
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>

            <section className="mt-6">
                <h2 className="text-lg font-semibold text-slate-900">Direct reports</h2>
                <p className="mt-1 text-sm text-slate-500">People who report straight to you.</p>
                <div className="mt-3">
                    {directReports.length > 0 ? (
                        <TeamSection people={directReports} users={users} onChanged={reload} />
                    ) : (
                        <p className="text-sm text-slate-500">Nobody reports directly to you.</p>
                    )}
                </div>
            </section>

            {extendedTeam.length > 0 && (
                <section className="mt-8">
                    <h2 className="text-lg font-semibold text-slate-900">Extended team</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Everyone further down your reporting line, and who they answer to.
                    </p>
                    <div className="mt-3">
                        <TeamSection people={extendedTeam} users={users} onChanged={reload} showReportsTo />
                    </div>
                </section>
            )}
        </div>
    );
}
