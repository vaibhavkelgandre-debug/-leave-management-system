// "Who's out today", as a table — the same shape for every role that can see
// it, so a super admin reading the whole company and an HR admin reading
// their own branch are looking at identical columns rather than two
// differently-shaped tiles. Fed whatever list the caller already scoped
// (TeamOverviewSummary.jsx decides which endpoint that is), so this component
// has no opinion about who's allowed to see whom.
//
// Was a `<ul>` of wrapped chips per person, which stopped being readable once
// there was more than a handful of people out: with names, roles, emails,
// ranges and type badges all flowing inline, nothing lined up between rows.
// Uses the same `scrollbar-thin overflow-x-auto` + `<table>` shell as every
// other table in the app (EmployeeTable/SalarySlipList/LeaveRequestTable),
// minus their `Card` — this one already renders inside the overview card.
import { Avatar } from "../ui/Avatar.jsx";
import { Badge, RoleBadge } from "../ui/Badge.jsx";
import { formatDateRange } from "../../utils/dates.js";

const thClasses = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase";
const tdClasses = "px-3 py-2.5 align-middle text-sm text-slate-700";

export function OnLeaveTodayTable({ requests, emptyMessage = "Nobody's out today." }) {
    if (requests.length === 0) {
        return <p className="mt-2 text-sm text-slate-500">{emptyMessage}</p>;
    }

    return (
        <div className="scrollbar-thin mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <th scope="col" className={thClasses}>
                            Employee
                        </th>
                        <th scope="col" className={thClasses}>
                            Role
                        </th>
                        <th scope="col" className={thClasses}>
                            Leave type
                        </th>
                        <th scope="col" className={thClasses}>
                            Dates
                        </th>
                        <th scope="col" className={thClasses}>
                            Days
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {requests.map((request) => {
                        const workingDays = Number(request.working_days);
                        const isHalfDay = request.start_half_day || request.end_half_day;
                        return (
                            <tr key={request.id} className="transition hover:bg-slate-50/80">
                                <td className={tdClasses}>
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <Avatar
                                            firstName={request.employee_first_name}
                                            lastName={request.employee_last_name}
                                            size="sm"
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-slate-900">
                                                {request.employee_first_name} {request.employee_last_name}
                                            </p>
                                            {/* Under the name rather than in its own column: it's the
                                                one field here that's only occasionally needed (to
                                                actually reach the person), and a full column of
                                                addresses would crowd out the leave details. */}
                                            <p className="truncate text-xs text-slate-500">{request.employee_email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className={tdClasses}>
                                    <RoleBadge role={request.employee_role} />
                                </td>
                                <td className={tdClasses}>
                                    <Badge className="bg-indigo-100 text-indigo-700">{request.leave_type_name}</Badge>
                                </td>
                                <td className={`${tdClasses} whitespace-nowrap`}>
                                    {formatDateRange(request.start_date, request.end_date)}
                                </td>
                                <td className={`${tdClasses} whitespace-nowrap`}>
                                    {workingDays} {workingDays === 1 ? "day" : "days"}
                                    {isHalfDay && <span className="text-xs text-slate-500"> (half day)</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
