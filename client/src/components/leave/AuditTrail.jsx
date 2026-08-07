// Renders a leave request's full audit trail (FR-021) inside a Modal — the
// backend has always tracked this, but until now nothing in the UI surfaced
// it, so HR/managers/employees had no way to see who approved, rejected,
// withdrew or cancelled a request. Loads lazily on open rather than whenever
// the parent list renders, since most rows never get their history viewed.
import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal.jsx";
import { getLeaveRequestAuditTrail } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { formatDateTime } from "../../utils/dates.js";

// Turns a machine action name into the label a human reads, e.g. "APPROVE" -> "Approved".
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

function EntryRow({ entry }) {
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

// Input: the leave request id to show history for, and `open`/`onClose` for
// the surrounding Modal. Output: nothing directly — renders the trail, or a
// loading/error/empty state. Fetch failures show inline rather than closing
// the modal, so the user can retry by reopening.
//
// `result` is keyed by the requestId it was fetched for, so switching to a
// different request (without unmounting) derives "loading" from a stale key
// instead of needing a synchronous setState-to-null at the top of the effect.
export function AuditTrail({ requestId, open, onClose }) {
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!open) return;
        getLeaveRequestAuditTrail(requestId)
            .then((entries) => setResult({ requestId, entries, error: null }))
            .catch((err) => setResult({ requestId, entries: null, error: toErrorMessage(err, "Unable to load history") }));
    }, [open, requestId]);

    const isCurrent = result?.requestId === requestId;
    const entries = isCurrent ? result.entries : null;
    const error = isCurrent ? result.error : null;

    return (
        <Modal open={open} onClose={onClose} title="Request history">
            {error && (
                <p role="alert" className="text-sm text-red-600">
                    {error}
                </p>
            )}
            {!error && entries === null && <p className="text-sm text-slate-500">Loading…</p>}
            {!error && entries !== null && entries.length === 0 && (
                <p className="text-sm text-slate-500">No history yet.</p>
            )}
            {!error && entries !== null && entries.length > 0 && (
                <ul className="space-y-2">
                    {entries.map((entry) => (
                        <EntryRow key={entry.id} entry={entry} />
                    ))}
                </ul>
            )}
        </Modal>
    );
}
