import { sendError } from "../utils/apiResponse.js";

export function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            }));
            return sendError(res, 422, "Validation failed", errors);
        }
        req.body = result.data;
        next();
    };
}

export function validateParams(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            const errors = result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            }));
            return sendError(res, 422, "Validation failed", errors);
        }
        req.params = result.data;
        next();
    };
}

export function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            const errors = result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            }));
            return sendError(res, 422, "Validation failed", errors);
        }
        // Express 5 defines `req.query` as a getter-only prototype property
        // (unlike `req.body`/`req.params`), so a plain assignment throws —
        // defineProperty shadows it with a writable own property instead.
        Object.defineProperty(req, "query", {
            value: result.data,
            writable: true,
            configurable: true,
        });
        next();
    };
}
