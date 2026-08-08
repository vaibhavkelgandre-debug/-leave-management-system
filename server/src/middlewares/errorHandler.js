import { AppError } from "../utils/appError.js";
import { sendError } from "../utils/apiResponse.js";

// Catch-all for requests that don't match any registered route — keeps the
// response shape consistent with every other API error instead of Express's
// default HTML 404 page.
export function notFoundHandler(req, res) {
    sendError(res, 404, "Route not found", []);
}

// Centralized Express error handler: every controller/middleware can just
// call next(err) and let this translate it into a consistent JSON error
// response, instead of each route formatting its own error output.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        return sendError(res, err.status, err.message, err.errors);
    }

    // Multer raises this (rather than calling next() normally) when the
    // uploaded file exceeds uploadMiddleware.js's size limit — surface it as
    // a 400 the client can act on instead of a generic 500.
    if (err.name === "MulterError") {
        const message = err.code === "LIMIT_FILE_SIZE" ? "Document exceeds the 5MB size limit" : "File upload error";
        return sendError(res, 400, message, []);
    }

    // Postgres unique_violation — surface as a 409 instead of a generic 500
    // so callers know it's a duplicate-data problem they can act on.
    if (err.code === "23505") {
        return sendError(res, 409, "A record with these details already exists", []);
    }

    // Postgres foreign_key_violation — the client referenced an id that
    // doesn't exist (e.g. a deleted user/role), so treat it as bad input.
    if (err.code === "23503") {
        return sendError(res, 422, "Referenced record does not exist", []);
    }

    console.error(err);
    return sendError(res, 500, "Something went wrong", []);
}
