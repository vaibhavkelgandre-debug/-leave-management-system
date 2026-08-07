import apiClient, { unwrap } from "./apiClient.js";

export async function previewLeaveRequest({ startDate, endDate, startHalfDay, endHalfDay }) {
    const response = await apiClient.post("/leave-requests/preview", { startDate, endDate, startHalfDay, endHalfDay });
    return unwrap(response);
}

export async function submitLeaveRequest({ leaveTypeId, startDate, endDate, startHalfDay, endHalfDay, reason }) {
    const response = await apiClient.post("/leave-requests", {
        leaveTypeId,
        startDate,
        endDate,
        startHalfDay,
        endHalfDay,
        reason,
    });
    return unwrap(response);
}

export async function getMyLeaveRequests() {
    const response = await apiClient.get("/leave-requests/mine");
    return unwrap(response);
}

export async function getTeamLeaveRequests() {
    const response = await apiClient.get("/leave-requests/team");
    return unwrap(response);
}

export async function getLeaveRequestAuditTrail(id) {
    const response = await apiClient.get(`/leave-requests/${id}/audit`);
    return unwrap(response);
}

export async function approveLeaveRequest(id, comment) {
    const response = await apiClient.post(`/leave-requests/${id}/approve`, { comment });
    return unwrap(response);
}

export async function rejectLeaveRequest(id, comment) {
    const response = await apiClient.post(`/leave-requests/${id}/reject`, { comment });
    return unwrap(response);
}

export async function withdrawLeaveRequest(id) {
    const response = await apiClient.post(`/leave-requests/${id}/withdraw`, {});
    return unwrap(response);
}

export async function cancelLeaveRequest(id) {
    const response = await apiClient.post(`/leave-requests/${id}/cancel`, {});
    return unwrap(response);
}

export async function overrideLeaveRequest(id, toStatus, comment) {
    const response = await apiClient.post(`/leave-requests/${id}/override`, { toStatus, comment });
    return unwrap(response);
}
