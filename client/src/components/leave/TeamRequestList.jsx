// The manager/HR approvals list — same card-list pattern as every other
// list in the app, with approve/reject on pending requests and an
// HR-only override on already-decided ones. Row-level state (busy, error,
// the reject-comment box) lives per row, same convention as everywhere else.
// Actions are labeled buttons (icon + text), not icon-only, and the row wraps
// onto its own lines on a narrow screen — icon-only buttons and a rigid
// single-row layout were unreadable/cramped once a row could carry up to
// four actions plus a role badge.
import { useState } from "react";
import { Check, Info, ShieldCheck, ShieldX, X } from "lucide-react";
import { approveLeaveRequest, rejectLeaveRequest, overrideLeaveRequest } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { RoleBadge, StatusBadge } from "../ui/Badge.jsx";
import { RequestDetailModal } from "./RequestDetailModal.jsx";
import { formatDateRange } from "../../utils/dates.js";

function RequestRow({ request, canOverride, onChanged, onViewDetails }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [showRejectComment, setShowRejectComment] = useState(false);
    const [comment, setComment] = useState("");

    const isPending = request.status === "SUBMITTED";
    const workingDays = Number(request.working_days);

    // `setBusy(false)` must run on both paths — previously it only ran in
    // the `catch`, so a *successful* approve/reject/override left the row's
    // icons spinning forever (the row never unmounts: `onChanged()` refetches
    // the list and this component just re-renders with new `request` props,
    // it doesn't get a fresh `busy` state). Looked like the request was
    // hanging when it had actually already succeeded.
    async function runAction(action) {
        setBusy(true);
        setError(null);
        try {
            await action();
            setShowRejectComment(false);
            setComment("");
            onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to update request"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <li className="px-4 py-3 transition hover:bg-slate-50/80">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                            {request.employee_first_name} {request.employee_last_name}
                        </span>
                        <RoleBadge role={request.employee_role} />
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

                <div className="flex flex-wrap items-center gap-2">
                    {isPending && (
                        <>
                            <Button
                                icon={Check}
                                variant="success"
                                size="sm"
                                loading={busy}
                                onClick={() => runAction(() => approveLeaveRequest(request.id))}
                            >
                                Approve
                            </Button>
                            <Button
                                icon={X}
                                variant="danger"
                                size="sm"
                                loading={busy}
                                onClick={() => setShowRejectComment((prev) => !prev)}
                            >
                                Reject
                            </Button>
                        </>
                    )}
                    {canOverride && request.status === "APPROVED" && (
                        <Button
                            icon={ShieldX}
                            variant="danger"
                            size="sm"
                            loading={busy}
                            onClick={() => runAction(() => overrideLeaveRequest(request.id, "REJECTED"))}
                        >
                            Override to rejected
                        </Button>
                    )}
                    {canOverride && request.status === "REJECTED" && (
                        <Button
                            icon={ShieldCheck}
                            variant="success"
                            size="sm"
                            loading={busy}
                            onClick={() => runAction(() => overrideLeaveRequest(request.id, "APPROVED"))}
                        >
                            Override to approved
                        </Button>
                    )}
                    <Button icon={Info} variant="secondary" size="sm" onClick={() => onViewDetails(request)}>
                        Details
                    </Button>
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
    const [detailRequest, setDetailRequest] = useState(null);

    return (
        <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {requests.map((request) => (
                    <RequestRow
                        key={request.id}
                        request={request}
                        canOverride={canOverride}
                        onChanged={onChanged}
                        onViewDetails={setDetailRequest}
                    />
                ))}
            </ul>
            <RequestDetailModal
                request={detailRequest}
                open={detailRequest !== null}
                onClose={() => setDetailRequest(null)}
            />
        </Card>
    );
}
