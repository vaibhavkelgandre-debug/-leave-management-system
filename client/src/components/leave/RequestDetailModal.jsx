// Full detail view for a single leave request — everything about it (who,
// when, why, its decision, its full history) plus its attached document
// embedded inline, so an approver never has to leave the app to validate it.
// Consolidates what used to be two separate actions ("View history" opening
// AuditTrail, "View document" opening a new browser tab to Cloudinary) into
// one "View details" action; AuditTrail.jsx has been folded in here and
// retired now that both of its callers open this instead.
import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal.jsx";
import { StatusBadge } from "../ui/Badge.jsx";
import { DocumentPreview } from "./DocumentPreview.jsx";
import { getLeaveRequestAuditTrail, getLeaveRequestDocument } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { formatDateRange, formatDateTime } from "../../utils/dates.js";

const ACTION_LABELS = {
    SUBMIT: "Submitted",
    APPROVE: "Approved",
    REJECT: "Rejected",
    WITHDRAW: "Withdrawn",
    CANCEL: "Cancelled",
    HR_OVERRIDE_TO_APPROVED: "Overridden to approved",
    HR_OVERRIDE_TO_REJECTED: "Overridden to rejected",
};

function actorName(entry) {
    const name = `${entry.actor_first_name} ${entry.actor_last_name}`;
    if (!entry.acted_for) return name;
    return `${name} (on behalf of ${entry.acted_for_first_name} ${entry.acted_for_last_name})`;
}

function AuditEntryRow({ entry }) {
    return (
        <li className="border-l-2 border-indigo-200 py-2 pl-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-semibold text-slate-900">
                    {ACTION_LABELS[entry.action] || entry.action}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
            </div>
            <p className="text-xs text-slate-500">{actorName(entry)}</p>
            {entry.comment && <p className="mt-1 text-xs text-slate-600 italic">“{entry.comment}”</p>}
        </li>
    );
}

// Input: the full request row (already loaded by the caller's list — no
// separate "get one" fetch needed for it) and `open`/`onClose` for the
// surrounding Modal. Output: nothing directly — renders the detail view, or
// per-section loading/error states. The audit trail and, if the request has
// one, the document are fetched lazily on open, each keyed by the request id
// they were fetched for (same stale-result guard AuditTrail.jsx used) so
// switching to a different request without unmounting doesn't show a
// flash of the previous one's data.
export function RequestDetailModal({ request, open, onClose }) {
    const [trailResult, setTrailResult] = useState(null);
    const [docResult, setDocResult] = useState(null);

    useEffect(() => {
        if (!open || !request) return;

        getLeaveRequestAuditTrail(request.id)
            .then((entries) => setTrailResult({ requestId: request.id, entries, error: null }))
            .catch((err) =>
                setTrailResult({ requestId: request.id, entries: null, error: toErrorMessage(err, "Unable to load history") })
            );

        if (request.has_document) {
            getLeaveRequestDocument(request.id)
                .then((doc) => setDocResult({ requestId: request.id, doc, error: null }))
                .catch((err) =>
                    setDocResult({ requestId: request.id, doc: null, error: toErrorMessage(err, "Unable to load document") })
                );
        }
    }, [open, request]);

    if (!request) return null;

    const isTrailCurrent = trailResult?.requestId === request.id;
    const trailEntries = isTrailCurrent ? trailResult.entries : null;
    const trailError = isTrailCurrent ? trailResult.error : null;

    const isDocCurrent = docResult?.requestId === request.id;
    const doc = isDocCurrent ? docResult.doc : null;
    const docError = isDocCurrent ? docResult.error : null;

    const workingDays = Number(request.working_days);

    return (
        <Modal open={open} onClose={onClose} title="Request details" size="lg">
            <div className="space-y-5">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-900">
                            {request.employee_first_name} {request.employee_last_name}
                        </span>
                        <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                        {request.leave_type_name} · {formatDateRange(request.start_date, request.end_date)} ·{" "}
                        {workingDays} day{workingDays === 1 ? "" : "s"}
                        {(request.start_half_day || request.end_half_day) && " (half day)"}
                    </p>
                </div>

                <div>
                    <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Reason</h3>
                    <p className="mt-1 text-sm text-slate-700">{request.reason}</p>
                </div>

                {request.decided_by && (
                    <div>
                        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Decision</h3>
                        <p className="mt-1 text-sm text-slate-700">
                            {request.decided_by_first_name} {request.decided_by_last_name} ·{" "}
                            {formatDateTime(request.decided_at)}
                        </p>
                        {request.decision_comment && (
                            <p className="mt-1 text-sm text-slate-600 italic">“{request.decision_comment}”</p>
                        )}
                    </div>
                )}

                {request.has_document && (
                    <div>
                        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Document</h3>
                        {docError && (
                            <p role="alert" className="mt-1 text-sm text-red-600">
                                {docError}
                            </p>
                        )}
                        {!docError && !doc && <p className="mt-1 text-sm text-slate-500">Loading…</p>}
                        {doc && (
                            <div className="mt-1">
                                <DocumentPreview url={doc.url} mimeType={doc.mimeType} filename={doc.filename} />
                                <p className="mt-1 text-xs text-slate-500">{doc.filename}</p>
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">History</h3>
                    {trailError && (
                        <p role="alert" className="mt-1 text-sm text-red-600">
                            {trailError}
                        </p>
                    )}
                    {!trailError && trailEntries === null && <p className="mt-1 text-sm text-slate-500">Loading…</p>}
                    {!trailError && trailEntries !== null && trailEntries.length === 0 && (
                        <p className="mt-1 text-sm text-slate-500">No history yet.</p>
                    )}
                    {!trailError && trailEntries !== null && trailEntries.length > 0 && (
                        <ul className="mt-1 space-y-2">
                            {trailEntries.map((entry) => (
                                <AuditEntryRow key={entry.id} entry={entry} />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </Modal>
    );
}
