import {
    insertLeaveType,
    findAllLeaveTypes,
    findLeaveTypeById,
    updateLeaveType as updateLeaveTypeRepo,
    updateLeaveTypeStatus as updateLeaveTypeStatusRepo,
} from "../repositories/leaveTypeRepository.js";
import * as leaveBalanceService from "./leaveBalanceService.js";
import { notFound } from "../utils/appError.js";

export async function createLeaveType(payload) {
    const leaveType = await insertLeaveType(payload);
    // Extend the new leave type to every existing active employee right away
    // instead of waiting for each of them to first read their balances.
    await leaveBalanceService.backfillBalancesForLeaveType(leaveType.id);
    return leaveType;
}

export async function listLeaveTypes(includeInactive) {
    return findAllLeaveTypes({ includeInactive });
}

export async function getLeaveTypeById(id) {
    const leaveType = await findLeaveTypeById(id);
    if (!leaveType) {
        throw notFound("Leave type not found");
    }
    return leaveType;
}

export async function updateLeaveType(id, payload) {
    await getLeaveTypeById(id);
    // Only affects the leave type's definition going forward — balance rows
    // already materialized for the current year are not retroactively changed.
    const updated = await updateLeaveTypeRepo(id, payload);
    if (!updated) {
        throw notFound("Leave type not found");
    }
    return updated;
}

export async function setLeaveTypeStatus(id, isActive) {
    await getLeaveTypeById(id);
    const updated = await updateLeaveTypeStatusRepo(id, isActive);
    if (!updated) {
        throw notFound("Leave type not found");
    }
    return updated;
}
