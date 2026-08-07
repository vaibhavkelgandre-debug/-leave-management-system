// The manager/HR approvals list — same card-list pattern as every other
// list in the app, with approve/reject on pending requests and an
// HR-only override on already-decided ones. Row-level state (busy, error,
// the reject-comment box) lives per row, same convention as everywhere else.
import { useState } from "react";
import { Check, History, ShieldCheck, ShieldX, X } from "lucide-react";
import { approveLeaveRequest, rejectLeaveRequest, overrideLeaveRequest } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { StatusBadge } from "../ui/Badge.jsx";
import { AuditTrail } from "./AuditTrail.jsx";
import { formatDateRange } from "../../utils/dates.js";

function RequestRow({ request, canOverride, onChanged, onViewHistory }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [showRejectComment, setShowRejectComment] = useState(false);
    const [comment, setComment] = useState("");

    const isPending = request.status === "SUBMITTED";
    const workingDays = Number(request.working_days);

    async function runAction(action) {
        setBusy(true);
        setError(null);
        try {
            await action();
            onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to update request"));
            setBusy(false);
        }
    }

    return (
        <li className="px-4 py-3 transition hover:bg-slate-50/80">
            <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                            {request.employee_first_name} {request.employee_last_name}
                        </span>
                        <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                        {request.leave_type_name} · {formatDateRange(request.start_date, request.end_date)} · {workingDays} day
                        {workingDays === 1 ? "" : "s"}
                    </p>
                    {request.reason && <p className="mt-1 text-xs text-slate-500">{request.reason}</p>}
                    {error && (
                        <p role="alert" className="mt-1 text-xs text-red-600">
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    {isPending && (
                        <>
                            <IconButton
                                icon={Check}
                                label="Approve"
                                variant="success"
                                size="sm"
                                loading={busy}
                                onClick={() => runAction(() => approveLeaveRequest(request.id))}
                            />
                            <IconButton
                                icon={X}
                                label="Reject"
                                variant="danger"
                                size="sm"
                                loading={busy}
                                onClick={() => setShowRejectComment((prev) => !prev)}
                            />
                        </>
                    )}
                    {canOverride && request.status === "APPROVED" && (
                        <IconButton
                            icon={ShieldX}
                            label="Override to rejected"
                            variant="danger"
                            size="sm"
                            loading={busy}
                            onClick={() => runAction(() => overrideLeaveRequest(request.id, "REJECTED"))}
                        />
                    )}
                    {canOverride && request.status === "REJECTED" && (
                        <IconButton
                            icon={ShieldCheck}
                            label="Override to approved"
                            variant="success"
                            size="sm"
                            loading={busy}
                            onClick={() => runAction(() => overrideLeaveRequest(request.id, "APPROVED"))}
                        />
                    )}
                    <IconButton icon={History} label="View history" size="sm" onClick={() => onViewHistory(request.id)} />
                </div>
            </div>

            {showRejectComment && (
                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <input
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Reason for rejecting (optional)"
                        className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <Button
                        size="sm"
                        variant="danger"
                        loading={busy}
                        onClick={() => runAction(() => rejectLeaveRequest(request.id, comment || undefined))}
                    >
                        Confirm reject
                    </Button>
                </div>
            )}
        </li>
    );
}

export function TeamRequestList({ requests, canOverride, onChanged }) {
    const [historyRequestId, setHistoryRequestId] = useState(null);

    return (
        <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {requests.map((request) => (
                    <RequestRow
                        key={request.id}
                        request={request}
                        canOverride={canOverride}
                        onChanged={onChanged}
                        onViewHistory={setHistoryRequestId}
                    />
                ))}
            </ul>
            <AuditTrail
                requestId={historyRequestId}
                open={historyRequestId !== null}
                onClose={() => setHistoryRequestId(null)}
            />
        </Card>
    );
}
