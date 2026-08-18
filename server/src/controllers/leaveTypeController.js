import * as leaveTypeService from "../services/leaveTypeService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function createLeaveType(req, res, next) {
    try {
        const leaveType = await leaveTypeService.createLeaveType(req.body);
        sendSuccess(res, 201, "Leave type created", leaveType);
    } catch (error) {
        next(error);
    }
}

// Inactive leave types are only surfaced to HR, regardless of what the caller
// requests, so non-HR callers never see deactivated types in list views.
export async function getLeaveTypes(req, res, next) {
    try {
        const includeInactive =
            req.query.includeInactive && (req.user.role === "HR_ADMIN" || req.user.role === "SUPER_ADMIN");
        const leaveTypes = await leaveTypeService.listLeaveTypes(includeInactive);
        sendSuccess(res, 200, "Leave types retrieved", leaveTypes);
    } catch (error) {
        next(error);
    }
}

export async function getLeaveTypeById(req, res, next) {
    try {
        const leaveType = await leaveTypeService.getLeaveTypeById(req.params.id);
        sendSuccess(res, 200, "Leave type retrieved", leaveType);
    } catch (error) {
        next(error);
    }
}

export async function updateLeaveType(req, res, next) {
    try {
        const leaveType = await leaveTypeService.updateLeaveType(req.params.id, req.body);
        sendSuccess(res, 200, "Leave type updated", leaveType);
    } catch (error) {
        next(error);
    }
}

export async function updateLeaveTypeStatus(req, res, next) {
    try {
        const leaveType = await leaveTypeService.setLeaveTypeStatus(req.params.id, req.body.isActive);
        sendSuccess(res, 200, "Leave type status updated", leaveType);
    } catch (error) {
        next(error);
    }
}
