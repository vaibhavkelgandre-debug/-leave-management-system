// A read-only, table-formatted view of leave requests — built for
// HrReportsPage's "Browse Requests" tab (FR-024), where the previous
// TeamRequestList-based rows (name + badges on one line, dates/reason on a
// second) were hard to scan across a long, filtered result set. TeamRequestList
// itself is untouched — it's still the right shape for the interactive
// Approvals page, where a row also carries Approve/Reject/Override actions;
// this component only ever renders "Details" (opens the same
// RequestDetailModal, in readOnly mode so no actions render inside it either).
import { useState } from "react";
import { Info } from "lucide-react";
import { RoleBadge, StatusBadge } from "../ui/Badge.jsx";
import { Card } from "../ui/Card.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { RequestDetailModal } from "./RequestDetailModal.jsx";
import { formatDateRange } from "../../utils/dates.js";

const thClasses = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase";
const tdClasses = "px-3 py-2 align-top text-sm text-slate-700";

export function LeaveRequestTable({ requests }) {
    const [detailRequest, setDetailRequest] = useState(null);

    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className={thClasses}>
                                Employee
                            </th>
                            <th scope="col" className={thClasses}>
                                Leave Type
                            </th>
                            <th scope="col" className={thClasses}>
                                Dates
                            </th>
                            <th scope="col" className={thClasses}>
                                Days
                            </th>
                            <th scope="col" className={thClasses}>
                                Status
                            </th>
                            <th scope="col" className={thClasses}>
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {requests.map((request) => (
                            <tr key={request.id} className="hover:bg-slate-50">
                                <td className={tdClasses}>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-medium text-slate-900">
                                            {request.employee_first_name} {request.employee_last_name}
                                        </span>
                                        <RoleBadge role={request.employee_role} />
                                    </div>
                                </td>
                                <td className={tdClasses}>{request.leave_type_name}</td>
                                <td className={tdClasses}>{formatDateRange(request.start_date, request.end_date)}</td>
                                <td className={tdClasses}>{Number(request.working_days)}</td>
                                <td className={tdClasses}>
                                    <StatusBadge status={request.status} />
                                </td>
                                <td className={`${tdClasses} text-right`}>
                                    <IconButton
                                        icon={Info}
                                        label="Details"
                                        size="sm"
                                        onClick={() => setDetailRequest(request)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <RequestDetailModal
                request={detailRequest}
                open={detailRequest !== null}
                onClose={() => setDetailRequest(null)}
                readOnly
            />
        </Card>
    );
}
