// Thin HTTP glue for delegations — see leaveRequestController.js for the
// house convention this follows.
import * as delegationService from "../services/delegationService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function create(req, res, next) {
    try {
        // manager_id always comes from the authenticated session — a manager
        // can only ever nominate a delegate for themselves.
        const delegation = await delegationService.createDelegation(req.user.id, req.body);
        sendSuccess(res, 201, "Delegation created", delegation);
    } catch (error) {
        next(error);
    }
}

export async function listMine(req, res, next) {
    try {
        const delegations = await delegationService.listDelegationsForManager(req.user.id);
        sendSuccess(res, 200, "Delegations retrieved", delegations);
    } catch (error) {
        next(error);
    }
}
