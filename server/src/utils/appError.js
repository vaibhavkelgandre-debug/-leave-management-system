// Carries an intended HTTP status alongside the error so the centralized
// errorHandler middleware can turn any thrown/next()-ed error into the
// correct response code without callers needing to touch `res` directly.
export class AppError extends Error {
    constructor(status, message, errors = []) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

// Factory helpers below let services/controllers raise semantic errors
// (e.g. `throw badRequest(...)`) instead of constructing AppError with raw
// status codes scattered across the codebase.
export function badRequest(message, errors = []) {
    return new AppError(400, message, errors);
}

export function unauthorized(message = "Unauthorized") {
    return new AppError(401, message);
}

export function forbidden(message = "Forbidden") {
    return new AppError(403, message);
}

export function notFound(message = "Not found") {
    return new AppError(404, message);
}

export function conflict(message) {
    return new AppError(409, message);
}
