import apiClient, { unwrap } from "./apiClient.js";

export async function getLeaveTypes({ includeInactive = false } = {}) {
    const response = await apiClient.get("/leave-types", {
        params: includeInactive ? { includeInactive: true } : {},
    });
    return unwrap(response);
}

export async function createLeaveType({
    name,
    annualEntitlement,
    accrualType,
    allowNegativeBalance,
    requiresDocument,
}) {
    const response = await apiClient.post("/leave-types", {
        name,
        annualEntitlement,
        accrualType,
        allowNegativeBalance,
        requiresDocument,
    });
    return unwrap(response);
}

export async function updateLeaveTypeStatus(leaveTypeId, isActive) {
    const response = await apiClient.patch(`/leave-types/${leaveTypeId}/status`, { isActive });
    return unwrap(response);
}
