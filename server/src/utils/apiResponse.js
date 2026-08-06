// Standardizes the JSON envelope for every successful API response so
// clients can rely on a consistent { success, message, data } shape.
export function sendSuccess(res, status, message, data = null) {
    return res.status(status).json({ success: true, message, data });
}

// Standardizes the JSON envelope for every error response (paired with
// sendSuccess) so the frontend can branch on `success` alone.
export function sendError(res, status, message, errors = []) {
    return res.status(status).json({ success: false, message, errors });
}
