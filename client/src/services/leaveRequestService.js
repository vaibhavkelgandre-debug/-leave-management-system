import apiClient, { unwrap } from "./apiClient.js";

export async function previewLeaveRequest({ startDate, endDate, startHalfDay, endHalfDay }) {
    const response = await apiClient.post("/leave-requests/preview", { startDate, endDate, startHalfDay, endHalfDay });
    return unwrap(response);
}

// `document` is an optional File (from an <input type="file">). When present,
// the request is sent as multipart/form-data instead of JSON so the server
// can read the attached file (FR-012). The Content-Type override is
// necessary: apiClient defaults every request to "application/json", and
// without clearing it here the browser can't attach its own multipart
// boundary, which leaves the server unable to parse the body at all.
export async function submitLeaveRequest({ leaveTypeId, startDate, endDate, startHalfDay, endHalfDay, reason }, document) {
    if (!document) {
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

    const formData = new FormData();
    formData.append("leaveTypeId", leaveTypeId);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);
    formData.append("startHalfDay", startHalfDay);
    formData.append("endHalfDay", endHalfDay);
    formData.append("reason", reason);
    formData.append("document", document);

    const response = await apiClient.post("/leave-requests", formData, {
        headers: { "Content-Type": undefined },
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

// HR-only company-wide view — see server/src/routes/leaveRequestRoutes.js.
// Broader than getTeamLeaveRequests' own HR results: that one is scoped to
// the caller's own reporting subtree (what they can actually act on), this
// one is everyone (for browsing/context only — the server still enforces
// the same subtree scoping if an action is attempted on a row from here
// that isn't actually the caller's).
export async function getAllLeaveRequests() {
    const response = await apiClient.get("/leave-requests/all");
    return unwrap(response);
}

// FR-024: HR's filterable browse view — every filter is optional and
// resolved server-side (see server/src/repositories/leaveRequestRepository.js
// findLeaveRequestsFiltered), never a client-side array filter over an
// already-fetched list. `filters` may include employeeId/leaveTypeId/status/
// startDate/endDate; axios drops any key whose value is undefined/empty
// rather than sending it as a literal "undefined" query param.
export async function getFilteredLeaveRequests(filters = {}) {
    const response = await apiClient.get("/leave-requests", { params: filters });
    return unwrap(response);
}

// FR-024's "leave taken per employee over a period" report, as JSON for an
// on-screen table. One row per employee with at least one APPROVED request
// overlapping the period.
export async function getLeaveTakenReport({ startDate, endDate }) {
    const response = await apiClient.get("/leave-requests/report", { params: { startDate, endDate } });
    return unwrap(response);
}

// A plain URL, not an axios call — meant for an <a href>, same reasoning as
// getLeaveRequestDocumentDownloadUrl below: the server sets its own
// Content-Disposition: attachment header, so a normal link navigation is
// enough to save the file, no JS-driven blob download needed.
export function getLeaveTakenReportCsvUrl({ startDate, endDate }) {
    const params = new URLSearchParams({ startDate, endDate });
    return `${apiClient.defaults.baseURL}/leave-requests/report/csv?${params.toString()}`;
}

export async function getLeaveRequestAuditTrail(id) {
    const response = await apiClient.get(`/leave-requests/${id}/audit`);
    return unwrap(response);
}

// Returns `{ url, filename, mimeType }` — `url` is a Cloudinary signed link
// valid for a few minutes (FR-012), so callers should open/use it right away
// rather than caching it for later.
export async function getLeaveRequestDocument(id) {
    const response = await apiClient.get(`/leave-requests/${id}/document`);
    return unwrap(response);
}

// A plain URL, not an axios call — meant for an <a href>. Points at the
// backend's own streaming endpoint (Content-Disposition: attachment) rather
// than the signed Cloudinary URL from getLeaveRequestDocument, since a link
// straight to a cross-origin URL ignores the `download` attribute and just
// navigates there instead of saving a local copy.
export function getLeaveRequestDocumentDownloadUrl(id) {
    return `${apiClient.defaults.baseURL}/leave-requests/${id}/document/download`;
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
