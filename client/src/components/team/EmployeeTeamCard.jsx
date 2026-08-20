// One manager's team, rendered as its own table on the "All Employees" org
// view — the manager's own row (tinted, so it reads as the table's header
// rather than just another report) followed by their direct EMPLOYEE
// reports. `team` is one entry from employeeGroups.js's
// `groupEmployeesForOrgView` output: `{ manager, reports }`. Kept as its own
// table per manager (rather than one flat table for every team) so "who's
// on which team" stays a visual grouping, not just a "Reports To" column to
// scan for — a flat table was tried once for this page and found to make
// that relationship hard to read.
import { EmployeeTable } from "./EmployeeTable.jsx";

export function EmployeeTeamCard({ team, users, onChanged, showActions = true }) {
    const { manager, reports } = team;

    return (
        <EmployeeTable
            people={[manager, ...reports]}
            users={users}
            onChanged={onChanged}
            showActions={showActions}
            highlightIds={new Set([manager.id])}
            trailingMessage={reports.length === 0 ? `No one reports to ${manager.first_name} yet.` : null}
        />
    );
}
