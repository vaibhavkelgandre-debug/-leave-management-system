// Groups the flat `GET /users` list into the shape the "All Employees" page
// renders as cards. The reporting hierarchy only ever has two real levels
// worth a card of their own — HR_ADMIN never has a manager (except the
// single SUPER_ADMIN, itself also manager-less), a MANAGER only ever reports
// to HR_ADMIN, and an EMPLOYEE reports to a MANAGER or directly to HR_ADMIN
// (see ALLOWED_MANAGER_ROLES in EmployeePersonRow.jsx) — so this is a fixed
// two-bucket grouping rather than a generic n-level tree:
//   - `leadership`: every HR_ADMIN, plus SUPER_ADMIN.
//   - `teams`: one entry per MANAGER, with their own direct EMPLOYEE reports.
//   - `unassigned`: anyone who reports straight to HR_ADMIN with no manager
//     in between, plus (defensively) anyone whose manager_id doesn't resolve
//     to anyone else in the list at all — grouped instead of dropped, in
//     case of stale/inconsistent data.
export function groupEmployeesForOrgView(users) {
    const byId = new Map(users.map((user) => [user.id, user]));
    const teamsByManagerId = new Map(users.filter((user) => user.role === "MANAGER").map((user) => [user.id, { manager: user, reports: [] }]));

    const leadership = [];
    const unassigned = [];

    for (const user of users) {
        if (user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN") {
            leadership.push(user);
            continue;
        }
        if (user.role === "MANAGER") {
            continue; // Already seeded as a team above; shown as that team's header.
        }

        const manager = user.manager_id ? byId.get(user.manager_id) : null;
        const team = manager ? teamsByManagerId.get(manager.id) : null;
        if (team) {
            team.reports.push(user);
        } else {
            unassigned.push(user);
        }
    }

    const byFirstName = (a, b) => a.first_name.localeCompare(b.first_name);
    leadership.sort(byFirstName);
    unassigned.sort(byFirstName);
    for (const team of teamsByManagerId.values()) {
        team.reports.sort(byFirstName);
    }
    const teams = [...teamsByManagerId.values()].sort((a, b) => byFirstName(a.manager, b.manager));

    return { leadership, teams, unassigned };
}

// Groups My Team's *extended* team (everyone below the viewer who doesn't
// report straight to them) under whoever each person actually reports to, so
// the page can render one small table per manager instead of a single flat
// list with a "Reports To" column to scan.
//
// Deliberately not `groupEmployeesForOrgView` above: that one is a fixed
// leadership/teams/unassigned shape keyed on *role* (only a MANAGER ever gets
// a team), which is right for the company-wide org view and wrong here — in
// a subtree the intermediate manager can just as easily be an HR_ADMIN, and
// there's no leadership tier to separate out.
//
// `directory` is where managers are looked up (My Team's own list plus the
// viewer): an extended-team member's manager is usually one of the viewer's
// *direct* reports, so they're not in `people` themselves. Anyone whose
// manager can't be resolved lands in `ungrouped` rather than being dropped —
// same defensive choice groupEmployeesForOrgView makes for stale data.
export function groupTeamByManager(people, directory) {
    const byId = new Map(directory.map((person) => [person.id, person]));
    const groups = new Map();
    const ungrouped = [];

    for (const person of people) {
        const manager = person.manager_id ? byId.get(person.manager_id) : null;
        if (!manager) {
            ungrouped.push(person);
            continue;
        }
        if (!groups.has(manager.id)) {
            groups.set(manager.id, { manager, reports: [] });
        }
        groups.get(manager.id).reports.push(person);
    }

    const byFirstName = (a, b) => a.first_name.localeCompare(b.first_name);
    for (const group of groups.values()) {
        group.reports.sort(byFirstName);
    }
    ungrouped.sort(byFirstName);

    return {
        groups: [...groups.values()].sort((a, b) => byFirstName(a.manager, b.manager)),
        ungrouped,
    };
}
