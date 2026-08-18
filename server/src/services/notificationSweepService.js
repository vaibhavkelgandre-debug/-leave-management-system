// Home for time-based (not event-driven) notification triggers — every
// other notify* call in this app fires directly from the request handler
// that caused it (leaveRequestService, userService, etc.); a delegation's
// start/end date isn't anyone's action on the day itself, so there's no
// request to hook into. server.js calls sweepDelegationTransitions on a
// timer instead. Kept in its own file (rather than folded into
// delegationService.js) so this "runs on a schedule" concern stays visibly
// separate from delegationService's request-driven CRUD, and so a future
// second sweep (if one's ever needed) has an obvious home.
import { findDelegationsStartingOn, findDelegationsEndingOn } from "../repositories/delegationRepository.js";
import { notifyDelegationStarted, notifyDelegationEnded } from "./notificationService.js";
import { todayDateKey } from "../utils/dates.js";

// Input: none — always checks against today's date. Output: none; creates a
// DELEGATION_STARTED notification for every delegation whose window begins
// today and a DELEGATION_ENDED one for every delegation whose window ends
// today. Safe to call more than once on the same calendar day (e.g. an
// hourly interval, or a server restart) — notifyDelegationStarted/Ended
// each dedupe via existsNotificationCreatedToday, so a repeat call is a no-op.
export async function sweepDelegationTransitions() {
    const today = todayDateKey();
    const [startingToday, endingToday] = await Promise.all([
        findDelegationsStartingOn(today),
        findDelegationsEndingOn(today),
    ]);

    for (const delegation of startingToday) {
        await notifyDelegationStarted(delegation);
    }
    for (const delegation of endingToday) {
        await notifyDelegationEnded(delegation);
    }
}
