import apiClient, { unwrap } from "./apiClient.js";

export const REQUIRED_DOCUMENT_TYPES = ["PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "OFFER_LETTER"];

// Multipart, same Content-Type override reasoning as
// leaveRequestService.submitLeaveRequest's document upload.
export async function uploadMyDocument(documentType, file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post(`/employees/me/documents/${documentType}`, formData, {
        headers: { "Content-Type": undefined },
    });
    return unwrap(response);
}

export async function getMyDocuments() {
    const response = await apiClient.get("/employees/me/documents");
    return unwrap(response);
}

// Optional, self-named documents beyond the required ones (e.g. a degree
// certificate) — never required for profile verification. Any number may
// exist; each is identified by its own id, not a fixed type.
export async function uploadMyCustomDocument(name, file) {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("file", file);

    const response = await apiClient.post("/employees/me/documents/custom", formData, {
        headers: { "Content-Type": undefined },
    });
    return unwrap(response);
}

export async function getMyCustomDocumentUrl(documentId) {
    const response = await apiClient.get(`/employees/me/documents/custom/${documentId}/url`);
    return unwrap(response);
}

export async function deleteMyCustomDocument(documentId) {
    const response = await apiClient.delete(`/employees/me/documents/custom/${documentId}`);
    return unwrap(response);
}

// Returns `{ url, filename, mimeType }` for one of the caller's own
// documents — used by ProfileDocumentUpload.jsx's "View" action.
export async function getMyDocumentUrl(documentType) {
    const response = await apiClient.get(`/employees/me/documents/${documentType}/url`);
    return unwrap(response);
}

export async function getDocumentsForEmployee(employeeId) {
    const response = await apiClient.get(`/employees/${employeeId}/documents`);
    return unwrap(response);
}

// Returns `{ url, filename, mimeType }` — `url` is a short-lived Cloudinary
// signed link, same shape as leaveRequestService.getLeaveRequestDocument.
export async function getDocumentUrl(employeeId, documentType) {
    const response = await apiClient.get(`/employees/${employeeId}/documents/${documentType}/url`);
    return unwrap(response);
}

export async function reviewDocument(employeeId, documentType, { status, comment }) {
    const response = await apiClient.post(`/employees/${employeeId}/documents/${documentType}/review`, {
        status,
        comment,
    });
    return unwrap(response);
}
