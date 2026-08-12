// The approve/reject/override control cluster for a single leave request —
// extracted so the exact same behavior (and its busy/error/comment state)
// can render both compactly on a TeamRequestList row and, with more room,
// inside RequestDetailModal. Keeping this in one place means the two
// call sites can't drift on which actions are legal for which status.
import { useState } from "react";
import { Check, ShieldCheck, ShieldX, X } from "lucide-react";
import { approveLeaveRequest, rejectLeaveRequest, overrideLeaveRequest } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Button } from "../ui/Button.jsx";

// Input: `request` (needs `id`/`status`), `canOverride`, and `onChanged`
// (called after any successful approve/reject/override — the caller decides
// what "changed" means, e.g. refetch a list, or refetch-and-close a modal).
// Output: nothing directly — renders the buttons legal for the request's
// current status, or nothing if none are.
export function RequestActions({ request, canOverride, onChanged }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [showRejectComment, setShowRejectComment] = useState(false);
    const [comment, setComment] = useState("");

    const isPending = request.status === "SUBMITTED";

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
            onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to update request"));
        } finally {
            setBusy(false);
        }
    }

    if (!isPending && !(canOverride && (request.status === "APPROVED" || request.status === "REJECTED"))) {
        return null;
    }

    return (
        <div>
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

            {error && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
