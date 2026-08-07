// Thin HTTP glue for leave requests — every handler just pulls from `req`,
// calls one leaveRequestService function, and reports success/failure. All
// business logic (authorization, the state machine, balance/ledger math)
// lives in the service, not here.
import * as leaveRequestService from "../services/leaveRequestService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function preview(req, res, next) {
    try {
        const workingDays = await leaveRequestService.previewWorkingDays(req.body);
        sendSuccess(res, 200, "Working days calculated", { workingDays });
    } catch (error) {
        next(error);
    }
}

export async function submit(req, res, next) {
    try {
        // employee_id always comes from the authenticated session, never the
        // request body — a client can never submit a request on someone
        // else's behalf.
        const request = await leaveRequestService.submitLeaveRequest(req.user.id, req.body);
        sendSuccess(res, 201, "Leave request submitted", request);
    } catch (error) {
        next(error);
    }
}

export async function listMine(req, res, next) {
    try {
        const requests = await leaveRequestService.listMyLeaveRequests(req.user.id);
        sendSuccess(res, 200, "Leave requests retrieved", requests);
    } catch (error) {
        next(error);
    }
}

export async function listTeam(req, res, next) {
    try {
        const requests = await leaveRequestService.listTeamLeaveRequests(req.user);
        sendSuccess(res, 200, "Leave requests retrieved", requests);
    } catch (error) {
        next(error);
    }
}

export async function getOne(req, res, next) {
    try {
        const request = await leaveRequestService.getLeaveRequestById(req.user, req.params.id);
        sendSuccess(res, 200, "Leave request retrieved", request);
    } catch (error) {
        next(error);
    }
}

export async function getAuditTrail(req, res, next) {
    try {
        const trail = await leaveRequestService.getAuditTrail(req.user, req.params.id);
        sendSuccess(res, 200, "Audit trail retrieved", trail);
    } catch (error) {
        next(error);
    }
}

// approve/reject/withdraw/cancel are identical glue apart from which action
// string they pass through to decideLeaveRequest — one factory instead of
// four near-duplicate functions.
function makeDecisionHandler(action) {
    return async function handleDecision(req, res, next) {
        try {
            const request = await leaveRequestService.decideLeaveRequest(req.user, req.params.id, action, req.body.comment);
            sendSuccess(res, 200, "Leave request updated", request);
        } catch (error) {
            next(error);
        }
    };
}

export const approve = makeDecisionHandler("APPROVE");
export const reject = makeDecisionHandler("REJECT");
export const withdraw = makeDecisionHandler("WITHDRAW");
export const cancel = makeDecisionHandler("CANCEL");

export async function override(req, res, next) {
    try {
        const action = req.body.toStatus === "APPROVED" ? "HR_OVERRIDE_TO_APPROVED" : "HR_OVERRIDE_TO_REJECTED";
        const request = await leaveRequestService.decideLeaveRequest(req.user, req.params.id, action, req.body.comment);
        sendSuccess(res, 200, "Leave request overridden", request);
    } catch (error) {
        next(error);
    }
}
