// The shared table shell for every employee roster in the app (All
// Employees' Leadership/Teams/Reports-directly-to-HR sections, My Team's
// Direct reports/Extended team sections) — same `Card` + `scrollbar-thin
// overflow-x-auto` + `<table>` pattern already established by
// HolidayList.jsx/SalarySlipList.jsx/LeaveRequestTable.jsx, so every table
// in the app reads as one consistent system rather than each page inventing
// its own. Columns are fixed (never hidden behind an expand action) since
// this is the app's roster of record — the point is to see everything about
// a person at a glance, not condense it.
import { Card } from "../ui/Card.jsx";
import { EmployeePersonRow } from "./EmployeePersonRow.jsx";

const thClasses = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase";

// `people`: rows to render, in the order given (EmployeeTeamCard.jsx relies
// on this to put a manager first, followed by their reports). `highlightIds`
// (a Set, optional) tints a specific row's background — the manager-as-
// header case. `emptyMessage` renders one full-width row instead of an empty
// `<tbody>` when `people` is empty. `trailingMessage` (EmployeeTeamCard.jsx's
// "no one reports to X yet") renders as one extra full-width row *after* a
// non-empty `people` list — a manager row still needs to render even when
// they have zero reports, so this is deliberately separate from
// `emptyMessage`, which only applies when there's nobody to show at all.
export function EmployeeTable({
    people,
    users,
    onChanged,
    showReportsTo = false,
    showActions = true,
    showProfileStatus = false,
    highlightIds,
    emptyMessage,
    trailingMessage,
}) {
    const columnCount = 7 + (showReportsTo ? 1 : 0) + (showActions ? 1 : 0);

    return (
        <Card className="overflow-hidden">
            <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className={thClasses}>
                                Employee
                            </th>
                            <th scope="col" className={thClasses}>
                                Designation
                            </th>
                            <th scope="col" className={thClasses}>
                                Department
                            </th>
                            <th scope="col" className={thClasses}>
                                Role
                            </th>
                            <th scope="col" className={thClasses}>
                                Status
                            </th>
                            <th scope="col" className={thClasses}>
                                Email
                            </th>
                            <th scope="col" className={thClasses}>
                                Phone
                            </th>
                            {showReportsTo && (
                                <th scope="col" className={thClasses}>
                                    Reports To
                                </th>
                            )}
                            {showActions && (
                                <th scope="col" className={thClasses}>
                                    <span className="sr-only">Actions</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {people.length === 0 ? (
                            <tr>
                                <td colSpan={columnCount} className="px-3 py-4 text-sm text-slate-500">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            <>
                                {people.map((person) => (
                                    <EmployeePersonRow
                                        key={person.id}
                                        user={person}
                                        users={users}
                                        onChanged={onChanged}
                                        showReportsTo={showReportsTo}
                                        showActions={showActions}
                                        showProfileStatus={showProfileStatus}
                                        highlighted={highlightIds?.has(person.id)}
                                        // Only needed for the manager-edit
                                        // row's `colSpan` — this component
                                        // already computes the number for its
                                        // own empty/trailing rows, and the
                                        // row itself can't know how many
                                        // columns its table has.
                                        columnCount={columnCount}
                                    />
                                ))}
                                {trailingMessage && (
                                    <tr>
                                        <td colSpan={columnCount} className="px-3 py-3 text-sm text-slate-500">
                                            {trailingMessage}
                                        </td>
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
