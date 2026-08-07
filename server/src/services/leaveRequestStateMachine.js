// Module 3 (FR-016, NFR-3): the single, explicit map of legal leave-request
// state transitions. Every mutating action checks against this table instead
// of re-deriving "is this move allowed" with its own conditionals — a reader
// (or a reviewer) can see every legal move in one place rather than piecing
// it together from scattered `if` statements across the service.
import { conflict } from "../utils/appError.js";

// `from`: the statuses a request must currently be in for this action to be
// legal. HR_OVERRIDE_* are the only transitions that move a request *out of*
// an already-decided state (APPROVED/REJECTED) — every other action only
// ever applies to a SUBMITTED request. WITHDRAWN and CANCELLED never appear
// as a `from` anywhere, which is exactly what makes them dead ends.
const TRANSITIONS = {
    APPROVE: { from: ["SUBMITTED"], to: "APPROVED" },
    REJECT: { from: ["SUBMITTED"], to: "REJECTED" },
    WITHDRAW: { from: ["SUBMITTED"], to: "WITHDRAWN" },
    CANCEL: { from: ["APPROVED"], to: "CANCELLED" },
    HR_OVERRIDE_TO_APPROVED: { from: ["REJECTED"], to: "APPROVED" },
    HR_OVERRIDE_TO_REJECTED: { from: ["APPROVED"], to: "REJECTED" },
};

// Input: an `action` key (must be one of the TRANSITIONS above) and the
// request's `currentStatus`. Output: the status the request should move to.
// Failure mode: throws a 409 conflict if the action doesn't apply from the
// request's current status (e.g. approving an already-withdrawn request) —
// this is what makes an illegal transition a distinguishable, deliberate
// error rather than a generic 400.
export function assertLegalTransition(action, currentStatus) {
    const rule = TRANSITIONS[action];

    if (!rule || !rule.from.includes(currentStatus)) {
        throw conflict(`Cannot ${action.toLowerCase().replaceAll("_", " ")} a request in ${currentStatus} state`);
    }

    return rule.to;
}
