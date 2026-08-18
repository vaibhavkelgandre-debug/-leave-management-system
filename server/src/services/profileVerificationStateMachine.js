// Module 5 v2: the explicit map of legal employee-profile-verification
// state transitions — same shape and reasoning as
// leaveRequestStateMachine.js (one table every mutating action checks
// against, instead of scattered conditionals).
import { conflict } from "../utils/appError.js";

const TRANSITIONS = {
    SUBMIT: { from: ["INCOMPLETE"], to: "SUBMITTED" },
    VERIFY: { from: ["SUBMITTED"], to: "VERIFIED" },
    SEND_BACK: { from: ["SUBMITTED"], to: "INCOMPLETE" },
};

// Input: an `action` key and the profile's `currentStatus`. Output: the
// status it should move to. Failure mode: throws a 409 conflict if the
// action doesn't apply from the current status (e.g. HR verifying a profile
// that's still INCOMPLETE, or an employee re-submitting an already-VERIFIED
// one).
export function assertLegalProfileTransition(action, currentStatus) {
    const rule = TRANSITIONS[action];

    if (!rule || !rule.from.includes(currentStatus)) {
        throw conflict(`Cannot ${action.toLowerCase().replaceAll("_", " ")} a profile in ${currentStatus} state`);
    }

    return rule.to;
}
