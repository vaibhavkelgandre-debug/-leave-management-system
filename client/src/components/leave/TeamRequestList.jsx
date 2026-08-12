// The manager/HR approvals list — same card-list pattern as every other
// list in the app, with approve/reject on pending requests and an
// HR-only override on already-decided ones. The actions themselves (and
// their busy/error/reject-comment state) live in RequestActions, shared with
// RequestDetailModal so a decision can be made from either place.
// Actions are labeled buttons (icon + text), not icon-only, and the row wraps
// onto its own lines on a narrow screen — icon-only buttons and a rigid
// single-row layout were unreadable/cramped once a row could carry up to
// four actions plus a role badge.
import { useEffect, useRef, useState } from "react";
import { Info, Repeat } from "lucide-react";
import { useAuth } from "../../hooks/useAuth.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../ui/Button.jsx";
import { Badge, RoleBadge, StatusBadge } from "../ui/Badge.jsx";
import { RequestDetailModal } from "./RequestDetailModal.jsx";
import { RequestActions } from "./RequestActions.jsx";
import { formatDateRange } from "../../utils/dates.js";

function RequestRow({ request, canOverride, onChanged, onViewDetails, viewerId, readOnly = false, isSelected, registerRef }) {
    const workingDays = Number(request.working_days);
    // This list can now include a manager's team the viewer is only
    // standing in for as an active delegate (listTeamLeaveRequests merges
    // it in) alongside the viewer's own reports — flag those rows so it's
    // clear why an unfamiliar employee's request is showing up here.
    // Not shown in read-only mode (the HR "All Requests" tab): there, every
    // row's manager differs from the viewer as a matter of course, so the
    // badge would just be noise rather than flagging anything unusual.
    const isDelegatedRow = !readOnly && request.employee_manager_id && request.employee_manager_id !== viewerId;

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
                        <span className="font-semibold text-slate-900">
                            {request.employee_first_name} {request.employee_last_name}
                        </span>
                        <RoleBadge role={request.employee_role} />
                        <StatusBadge status={request.status} />
                        {isDelegatedRow && (
                            <Badge className="flex items-center gap-1 bg-amber-100 text-amber-700">
                                <Repeat className="h-3 w-3" aria-hidden="true" />
                                Delegated for {request.manager_first_name} {request.manager_last_name}
                            </Badge>
                        )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                        {request.leave_type_name} · {formatDateRange(request.start_date, request.end_date)} · {workingDays} day
                        {workingDays === 1 ? "" : "s"}
                    </p>
                    {request.reason && <p className="mt-1 text-xs text-slate-500">{request.reason}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {!readOnly && <RequestActions request={request} canOverride={canOverride} onChanged={onChanged} />}
                    <Button icon={Info} variant="secondary" size="sm" onClick={() => onViewDetails(request)}>
                        Details
                    </Button>
                </div>
            </div>
        </li>
    );
}

// `readOnly`: the HR "All Requests" tab — every request in the company for
// browsing/context, but acting on one is scoped to the caller's own
// reporting subtree (enforced server-side regardless), so this tab shows no
// action buttons at all rather than showing buttons that would just 404 for
// most rows. Switch to "My Team" to actually act on something.
export function TeamRequestList({ requests, canOverride, onChanged, readOnly = false, selectedRequestId }) {
    // Optional chaining: some callers/tests render this before the auth
    // context has a user — the delegated-team badge just stays hidden then,
    // same as if every row were the viewer's own report.
    const { user } = useAuth();
    const [detailRequest, setDetailRequest] = useState(null);
    const itemNodes = useRef(new Map());

    // Scrolls the row picked from TeamLeaveCalendar into view — the row
    // itself is already visible as "selected" via `isSelected` below
    // without this, but on a long list it can sit off-screen with no
    // scroll container of its own (the whole page scrolls).
    useEffect(() => {
        if (!selectedRequestId) return;
        itemNodes.current.get(selectedRequestId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [selectedRequestId]);

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
                        viewerId={user?.id}
                        readOnly={readOnly}
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
                canOverride={canOverride}
                readOnly={readOnly}
                onChanged={onChanged}
            />
        </Card>
    );
}
