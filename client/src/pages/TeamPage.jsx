import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { getMyTeam } from "../services/userService.js";
import { useAuth } from "../hooks/useAuth.js";
import { ROLES } from "../constants/roles.js";
import { EmployeeTable } from "../components/team/EmployeeTable.jsx";
import { groupTeamByManager } from "../utils/employeeGroups.js";
import { Button } from "../components/ui/Button.jsx";
import { RoleBadge } from "../components/ui/Badge.jsx";

// Editing a report's manager or activate/deactivate status lives here, not
// on "All Employees" (EmployeesPage.jsx) — managing your own team is what
// this page is for, so `EmployeeTable`'s actions stay on their default
// (`showActions={true}`) here and get turned off there instead. That split
// matters more than it used to: All Employees is SUPER_ADMIN-only now, so
// for an HR admin this page *is* the people-management surface — which is
// also why the invite action moved here for them (see `canInvite` below). The
// profile_status badge (`showProfileStatus`) is likewise only turned on
// here, so HR can tell at a glance who on their team is already verified.
function TeamSection({ people, users, onChanged, showReportsTo = false, emptyMessage }) {
    return (
        <EmployeeTable
            people={people}
            users={users}
            onChanged={onChanged}
            showReportsTo={showReportsTo}
            showProfileStatus
            emptyMessage={emptyMessage}
        />
    );
}

// One extended-team manager and the people under them. The manager's name
// sits *above* their table rather than being a "Reports To" column repeated
// on every row — same reasoning as EmployeeTeamCard.jsx on the org view: who
// reports to whom reads better as a visual grouping than as a column to scan.
// Dropping that column also gives the remaining ones (email, phone,
// designation) the width they were competing for.
//
// A heading, not a tinted manager row like EmployeeTeamCard's: on this page
// the manager is almost always one of the viewer's own direct reports, so
// they already have a row in the section above — rendering them again as a
// table row would read as the same person listed twice.
function ExtendedTeamGroup({ manager, reports, users, onChanged }) {
    return (
        <section>
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                    {manager.first_name} {manager.last_name}
                </h3>
                <RoleBadge role={manager.role} />
                <span className="text-xs text-slate-500">
                    {reports.length} {reports.length === 1 ? "report" : "reports"}
                </span>
            </div>
            <div className="mt-2">
                <TeamSection people={reports} users={users} onChanged={onChanged} />
            </div>
        </section>
    );
}

export function TeamPage() {
    const { user: currentUser, hasAnyRole } = useAuth();
    // HR's only remaining entry point to the invite form: All Employees (where
    // "Add Employee" used to live) is SUPER_ADMIN-only now, so without this an
    // HR admin would have no way to invite anyone from the UI at all. Not
    // shown to a plain MANAGER — POST /users/invite is HR-tier server-side.
    const canInvite = hasAnyRole([ROLES.HR_ADMIN, ROLES.SUPER_ADMIN]);
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

    // One header for all four states below (error/loading/empty/loaded) — the
    // invite action can't be tucked into the loaded branch alone, since "my
    // team is empty" is exactly when an HR admin most needs it.
    const header = (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>
            {canInvite && (
                <Button as={Link} to="/dashboard/employees/new" icon={Plus}>
                    Add Employee
                </Button>
            )}
        </div>
    );

    if (error) {
        return (
            <div>
                {header}
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {error}
                </p>
            </div>
        );
    }

    if (!team) {
        return (
            <div>
                {header}
                <p role="status" className="mt-6 text-sm text-slate-500">
                    Loading…
                </p>
            </div>
        );
    }

    if (team.length === 0) {
        return (
            <div>
                {header}
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
    // Looked up against `users` (the team plus the viewer), not `extendedTeam`
    // — an extended-team member's manager is usually a *direct* report, so
    // they aren't in the list being grouped.
    const { groups: extendedGroups, ungrouped: extendedUngrouped } = groupTeamByManager(extendedTeam, users);

    return (
        <div>
            {header}

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
                        Everyone further down your reporting line, grouped under the manager they answer to.
                    </p>
                    <div className="mt-4 space-y-6">
                        {extendedGroups.map((group) => (
                            <ExtendedTeamGroup
                                key={group.manager.id}
                                manager={group.manager}
                                reports={group.reports}
                                users={users}
                                onChanged={reload}
                            />
                        ))}
                        {/* Only reachable with inconsistent data (a manager_id
                            pointing at someone outside this subtree) — shown
                            rather than silently dropped, with the Reports To
                            column back on since there's no heading to carry
                            that information here. */}
                        {extendedUngrouped.length > 0 && (
                            <section>
                                <h3 className="text-sm font-semibold text-slate-900">Elsewhere in your reporting line</h3>
                                <div className="mt-2">
                                    <TeamSection
                                        people={extendedUngrouped}
                                        users={users}
                                        onChanged={reload}
                                        showReportsTo
                                    />
                                </div>
                            </section>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
