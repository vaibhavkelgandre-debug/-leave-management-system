// The approve/reject/override control cluster for a single leave request —
// extracted so the exact same behavior (and its busy/error/comment state)
// can render both compactly on a TeamRequestList row and, with more room,
// inside RequestDetailModal. Keeping this in one place means the two
// call sites can't drift on which actions are legal for which status.
import { useState } from "react";
import { Check, ShieldCheck, ShieldX, X } from "lucide-react";
import { approveLeaveRequest, rejectLeaveRequest, overrideLeaveRequest } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { useAuth } from "../../hooks/useAuth.js";
import { canDecideDirectly } from "../../utils/leaveRequestAuthz.js";
import { Button } from "../ui/Button.jsx";
import { IconButton } from "../ui/IconButton.jsx";

// Input: `request` (needs `id`/`status`/`employee_manager_id`), `canOverride`,
// and `onChanged` (called after any successful approve/reject/override — the
// caller decides what "changed" means, e.g. refetch a list, or refetch-and-
// close a modal). `iconOnly` (default off) swaps the labeled buttons for
// icon-only ones with the same accessible name — TeamRequestList opts into
// this for its row layout (a row can carry up to four actions plus a role
// badge, and space is at a premium there); RequestDetailModal keeps the
// default labeled rendering, since "more room" was the whole reason this
// went labeled there in the first place. Re-requested directly after that —
// see the note in rules.md for why this isn't silently un-reverting itself.
// Output: nothing directly — renders the buttons legal for the request's
// current status and this viewer, or nothing if none are.
// Every `iconOnly` button passes `tooltipPortal`: the one call site that uses
// it is a TeamRequestList row, inside a `Card overflow-hidden` with no table
// header above the first row, so a default CSS-absolute tooltip on that row
// was clipped off at the card's top edge. Portal mode is safe anywhere, so
// it's unconditional rather than another prop threaded down.
export function RequestActions({ request, canOverride, onChanged, iconOnly = false }) {
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [showRejectComment, setShowRejectComment] = useState(false);
    const [comment, setComment] = useState("");
    // Which override direction is mid-confirmation, if any. Unlike reject's
    // optional comment above, a reason is required to override (client-
    // requested change) — the Confirm button stays disabled until something's
    // typed, rather than letting the server 422 do the enforcing.
    const [overrideTarget, setOverrideTarget] = useState(null);
    const [overrideComment, setOverrideComment] = useState("");

    const isPending = request.status === "SUBMITTED";
    // An HR viewer only gets Approve/Reject when they're genuinely the
    // request's assigned manager (see leaveRequestAuthz.js) — otherwise this
    // is someone else's direct report, still awaiting that manager's own
    // decision, and HR's only lever is Override once one exists.
    const canDecidePending = isPending && canDecideDirectly(request, user);
    const canOverrideDecided = canOverride && (request.status === "APPROVED" || request.status === "REJECTED");

    // `setBusy(false)` must run on both paths — a successful action doesn't
    // necessarily unmount this component (the row/modal just re-renders with
    // updated props), so leaving it only in `catch` would leave the buttons
    // spinning forever after a successful call.
    async function runAction(action) {
        setBusy(true);
        setError(null);
        try {
            await action();
            setShowRejectComment(false);
            setComment("");
            setOverrideTarget(null);
            setOverrideComment("");
            onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to update request"));
        } finally {
            setBusy(false);
        }
    }

    if (!canDecidePending && !canOverrideDecided) {
        return null;
    }

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2">
                {canDecidePending &&
                    (iconOnly ? (
                        <>
                            <IconButton
                                icon={Check}
                                label="Approve"
                                variant="success"
                                size="sm"
                                loading={busy}
                                tooltipPortal
                                onClick={() => runAction(() => approveLeaveRequest(request.id))}
                            />
                            <IconButton
                                icon={X}
                                label="Reject"
                                variant="danger"
                                size="sm"
                                loading={busy}
                                tooltipPortal
                                onClick={() => setShowRejectComment((prev) => !prev)}
                            />
                        </>
                    ) : (
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
                    ))}
                {canOverride &&
                    request.status === "APPROVED" &&
                    (iconOnly ? (
                        <IconButton
                            icon={ShieldX}
                            label="Override to rejected"
                            variant="danger"
                            size="sm"
                            loading={busy}
                            tooltipPortal
                            onClick={() => setOverrideTarget((prev) => (prev === "REJECTED" ? null : "REJECTED"))}
                        />
                    ) : (
                        <Button
                            icon={ShieldX}
                            variant="danger"
                            size="sm"
                            loading={busy}
                            onClick={() => setOverrideTarget((prev) => (prev === "REJECTED" ? null : "REJECTED"))}
                        >
                            Override to rejected
                        </Button>
                    ))}
                {canOverride &&
                    request.status === "REJECTED" &&
                    (iconOnly ? (
                        <IconButton
                            icon={ShieldCheck}
                            label="Override to approved"
                            variant="success"
                            size="sm"
                            loading={busy}
                            tooltipPortal
                            onClick={() => setOverrideTarget((prev) => (prev === "APPROVED" ? null : "APPROVED"))}
                        />
                    ) : (
                        <Button
                            icon={ShieldCheck}
                            variant="success"
                            size="sm"
                            loading={busy}
                            onClick={() => setOverrideTarget((prev) => (prev === "APPROVED" ? null : "APPROVED"))}
                        >
                            Override to approved
                        </Button>
                    ))}
            </div>

            {showRejectComment && (
                <div className="mt-3 flex items-center gap-2">
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

            {overrideTarget && (
                <div className="mt-3 flex items-center gap-2">
                    <input
                        value={overrideComment}
                        onChange={(event) => setOverrideComment(event.target.value)}
                        placeholder="Reason for overriding (required)"
                        className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <Button
                        size="sm"
                        variant={overrideTarget === "APPROVED" ? "success" : "danger"}
                        loading={busy}
                        disabled={!overrideComment.trim()}
                        onClick={() => runAction(() => overrideLeaveRequest(request.id, overrideTarget, overrideComment))}
                    >
                        Confirm override
                    </Button>
                </div>
            )}

            {error && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
