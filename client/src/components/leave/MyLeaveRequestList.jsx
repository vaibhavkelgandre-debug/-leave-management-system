// An employee's own leave request history — card list matching
// HolidayList.jsx's pattern (mobile-safe by construction, no table). Each row
// owns its own withdraw/cancel mutation state, same convention as every
// other row-level action in this app.
import { useState } from "react";
import { Ban, History, X } from "lucide-react";
import { withdrawLeaveRequest, cancelLeaveRequest } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Card } from "../ui/Card.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { StatusBadge } from "../ui/Badge.jsx";
import { AuditTrail } from "./AuditTrail.jsx";
import { formatDateRange, todayDateKey } from "../../utils/dates.js";

function RequestItem({ request, onChanged, onViewHistory }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // Mirrors the server's own rules exactly (leaveRequestStateMachine.js +
    // the CANCEL date check in leaveRequestService.js) — the server is still
    // the real gate, this just avoids showing a button that would fail.
    const canWithdraw = request.status === "SUBMITTED";
    const canCancel = request.status === "APPROVED" && request.start_date > todayDateKey();
    const workingDays = Number(request.working_days);

    async function handleWithdraw() {
        setBusy(true);
        setError(null);
        try {
            await withdrawLeaveRequest(request.id);
            onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to withdraw request"));
            setBusy(false);
        }
    }

    async function handleCancel() {
        setBusy(true);
        setError(null);
        try {
            await cancelLeaveRequest(request.id);
            onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to cancel request"));
            setBusy(false);
        }
    }

    return (
        <li className="flex items-center gap-4 px-4 py-3 transition hover:bg-slate-50/80">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{request.leave_type_name}</span>
                    <StatusBadge status={request.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateRange(request.start_date, request.end_date)} · {workingDays} day{workingDays === 1 ? "" : "s"}
                </p>
                {request.reason && <p className="mt-1 text-xs text-slate-500">{request.reason}</p>}
                {request.decision_comment && (
                    <p className="mt-1 text-xs text-slate-500 italic">“{request.decision_comment}”</p>
                )}
                {error && (
                    <p role="alert" className="mt-1 text-xs text-red-600">
                        {error}
                    </p>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
                {canWithdraw && (
                    <IconButton
                        icon={X}
                        label="Withdraw request"
                        variant="ghost"
                        size="sm"
                        loading={busy}
                        onClick={handleWithdraw}
                    />
                )}
                {canCancel && (
                    <IconButton
                        icon={Ban}
                        label="Cancel request"
                        variant="danger"
                        size="sm"
                        loading={busy}
                        onClick={handleCancel}
                    />
                )}
                <IconButton icon={History} label="View history" size="sm" onClick={() => onViewHistory(request.id)} />
            </div>
        </li>
    );
}

export function MyLeaveRequestList({ requests, onChanged }) {
    const [historyRequestId, setHistoryRequestId] = useState(null);

    return (
        <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {requests.map((request) => (
                    <RequestItem
                        key={request.id}
                        request={request}
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
