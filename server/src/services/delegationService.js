// Module 3 (FR-020): a manager nominating someone to approve on their behalf
// for a date range. `leaveRequestService.js` is what actually checks whether
// a delegation is *active* when someone tries to approve a request — this
// file only owns creating/listing delegations.
import { insertDelegation, findDelegationsForManager, findOverlappingDelegationForManager } from "../repositories/delegationRepository.js";
import { findUserById } from "../repositories/userRepository.js";
import { badRequest, conflict } from "../utils/appError.js";

// Input: the manager's id and `{ delegateId, startDate, endDate }`. Output:
// the created delegation (joined shape, includes the delegate's name).
// Failure modes: 400 if delegating to yourself or to a user that doesn't
// exist/isn't active; 409 if it overlaps a delegation this manager already
// has for an overlapping date range (avoids an ambiguous "who's the active
// delegate today").
export async function createDelegation(managerId, { delegateId, startDate, endDate }) {
    if (delegateId === managerId) {
        throw badRequest("You cannot delegate to yourself");
    }

    const delegate = await findUserById(delegateId);
    if (!delegate || delegate.status !== "ACTIVE") {
        throw badRequest("Delegate not found");
    }

    if (await findOverlappingDelegationForManager({ managerId, startDate, endDate })) {
        throw conflict("You already have a delegation covering one or more of these dates");
    }

    return insertDelegation({ managerId, delegateId, startDate, endDate });
}

// Output: every delegation this manager has ever nominated.
export async function listDelegationsForManager(managerId) {
    return findDelegationsForManager(managerId);
}
