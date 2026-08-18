// One manager's team, rendered as its own card on the "All Employees" org
// view — the manager's own row (slightly shaded, so it reads as the card's
// header rather than just another report) followed by their direct
// EMPLOYEE reports. `team` is one entry from employeeGroups.js's
// `groupEmployeesForOrgView` output: `{ manager, reports }`.
import { Users } from "lucide-react";
import { Card } from "../ui/Card.jsx";
import { EmployeePersonRow } from "./EmployeePersonRow.jsx";

export function EmployeeTeamCard({ team, users, onChanged, showActions = true }) {
    const { manager, reports } = team;

    return (
        <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
                <EmployeePersonRow
                    user={manager}
                    users={users}
                    onChanged={onChanged}
                    showActions={showActions}
                    className="bg-indigo-50/40"
                />
                {reports.length === 0 ? (
                    <li className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                        <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                        No one reports to {manager.first_name} yet.
                    </li>
                ) : (
                    reports.map((report) => (
                        <EmployeePersonRow
                            key={report.id}
                            user={report}
                            users={users}
                            onChanged={onChanged}
                            showActions={showActions}
                        />
                    ))
                )}
            </ul>
        </Card>
    );
}
