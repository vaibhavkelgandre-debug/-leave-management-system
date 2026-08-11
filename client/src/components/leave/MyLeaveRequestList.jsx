// An employee's own leave request history — card list matching
// HolidayList.jsx's pattern (mobile-safe by construction, no table). Each row
// owns its own withdraw/cancel mutation state, same convention as every
// other row-level action in this app.
import { useEffect, useRef, useState } from "react";
import { Ban, Info, X } from "lucide-react";
import { withdrawLeaveRequest, cancelLeaveRequest } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { StatusBadge } from "../ui/Badge.jsx";
import { RequestDetailModal } from "./RequestDetailModal.jsx";
import { formatDateRange, todayDateKey } from "../../utils/dates.js";

function RequestItem({ request, onChanged, onViewDetails, isSelected, registerRef }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // Mirrors the server's own rules exactly (leaveRequestStateMachine.js +
    // the CANCEL date check in leaveRequestService.js) — the server is still
    // the real gate, this just avoids showing a button that would fail.
    const canWithdraw = request.status === "SUBMITTED";
    const canCancel = request.status === "APPROVED" && request.start_date > todayDateKey();
    const workingDays = Number(request.working_days);

    // `setBusy(false)` must run on both paths, not just `catch` — see the
    // identical fix/comment on TeamRequestList.jsx's `runAction`. Without it,
    // a successful withdraw/cancel left the row's icon spinning forever
    // instead of clearing once `onChanged()`'s refetch lands.
    async function handleWithdraw() {
        setBusy(true);
        setError(null);
        try {
            await withdrawLeaveRequest(request.id);
            onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to withdraw request"));
        } finally {
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
        } finally {
            setBusy(false);
        }
    }

    return (
        <li
            ref={registerRef}
            className={`px-4 py-3 transition ${
                isSelected ? "bg-indigo-50/80 ring-1 ring-inset ring-indigo-300" : "hover:bg-slate-50/80"
            }`}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{request.leave_type_name}</span>
                        <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                        {formatDateRange(request.start_date, request.end_date)} · {workingDays} day
                        {workingDays === 1 ? "" : "s"}
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

                <div className="flex flex-wrap items-center gap-2">
                    {canWithdraw && (
                        <Button icon={X} variant="secondary" size="sm" loading={busy} onClick={handleWithdraw}>
                            Withdraw
                        </Button>
                    )}
                    {canCancel && (
                        <Button icon={Ban} variant="danger" size="sm" loading={busy} onClick={handleCancel}>
                            Cancel
                        </Button>
                    )}
                    <Button icon={Info} variant="secondary" size="sm" onClick={() => onViewDetails(request)}>
                        Details
                    </Button>
                </div>
            </div>
        </li>
    );
}

export function MyLeaveRequestList({ requests, onChanged, selectedRequestId }) {
    const [detailRequest, setDetailRequest] = useState(null);
    const itemNodes = useRef(new Map());

    // Scrolls the row picked from the calendar into view — the row itself is
    // already visible as "selected" via `isSelected` below without this, but
    // on a long list it can sit off-screen with no scroll container of its
    // own (the whole page scrolls), so it needs an explicit nudge.
    useEffect(() => {
        if (!selectedRequestId) return;
        itemNodes.current.get(selectedRequestId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [selectedRequestId]);

    return (
        <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {requests.map((request) => (
                    <RequestItem
                        key={request.id}
                        request={request}
                        onChanged={onChanged}
                        onViewDetails={setDetailRequest}
                        isSelected={request.id === selectedRequestId}
                        registerRef={(node) => {
                            if (node) itemNodes.current.set(request.id, node);
                            else itemNodes.current.delete(request.id);
                        }}
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
