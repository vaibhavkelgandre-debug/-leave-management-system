// Request-shape validation for leave requests (submit/preview/decide). Every
// write endpoint validates server-side, per NFR-4 — never trust the client.
import { z } from "zod";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

// Submitting with a document attached sends multipart/form-data (so multer
// can read the file), which arrives as string fields for everything else —
// unlike a plain JSON body, "false" comes through as the string "false", not
// a boolean. z.coerce.boolean() would wrongly treat "false" as truthy, so
// this maps the two string forms explicitly and passes actual booleans (the
// JSON, no-attachment case) through unchanged.
const booleanish = z.preprocess((value) => (typeof value === "string" ? value === "true" : value), z.boolean());

// Shared by both the preview and submit schemas: the date range must not run
// backwards, and a single-day request can't set both half-day flags (that
// would zero the request out, which is never what the employee meant).
function refineDateRange(data, ctx) {
    if (data.endDate < data.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "endDate must be on or after startDate" });
    }
    if (data.startDate === data.endDate && data.startHalfDay && data.endHalfDay) {
        ctx.addIssue({
            code: "custom",
            path: ["endHalfDay"],
            message: "A single-day request can only have one half-day flag set",
        });
    }
}

export const previewLeaveRequestSchema = z
    .object({
        startDate: dateStringSchema,
        endDate: dateStringSchema,
        startHalfDay: z.boolean().optional().default(false),
        endHalfDay: z.boolean().optional().default(false),
    })
    .superRefine(refineDateRange);

export const submitLeaveRequestSchema = z
    .object({
        leaveTypeId: z.string().uuid("leaveTypeId must be a valid id"),
        startDate: dateStringSchema,
        endDate: dateStringSchema,
        startHalfDay: booleanish.optional().default(false),
        endHalfDay: booleanish.optional().default(false),
        reason: z.string().trim().min(1, "Reason is required"),
    })
    .superRefine(refineDateRange);

export const leaveRequestIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
});

// Body for approve/reject/withdraw/cancel — a comment is optional on all four
// (the brief only requires one when a manager rejects, but allowing it
// everywhere costs nothing and avoids arbitrarily blocking a manager who
// wants to leave a note on an approval too).
export const decisionSchema = z.object({
    comment: z.string().trim().optional(),
});

// Body for HR's override endpoint — `toStatus` picks which of the two legal
// override transitions to apply (see leaveRequestStateMachine.js). Unlike
// decisionSchema above, `comment` is required here (client-requested change)
// — overturning the employee's actual manager needs a stated reason, same
// reasoning as profileValidator's sendProfileBackSchema requiring one.
export const overrideSchema = z.object({
    toStatus: z.enum(["APPROVED", "REJECTED"]),
    comment: z.string().trim().min(1, "A reason is required to override a decision"),
});

// FR-024: query params for HR's filterable browse view (GET /leave-requests)
// — every filter is optional, so an HR admin can start broad and narrow down.
// `status` covers every value the state machine can ever produce, not just
// the "active" ones — deliberately including WITHDRAWN/CANCELLED, since this
// is a browse/report view rather than an action queue.
export const listLeaveRequestsQuerySchema = z
    .object({
        employeeId: z.string().uuid("employeeId must be a valid id").optional(),
        leaveTypeId: z.string().uuid("leaveTypeId must be a valid id").optional(),
        status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "WITHDRAWN", "CANCELLED"]).optional(),
        startDate: dateStringSchema.optional(),
        endDate: dateStringSchema.optional(),
    })
    .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
        message: "endDate must be on or after startDate",
        path: ["endDate"],
    });

// FR-024: query params for the leave-taken-per-employee report (and its CSV
// download) — unlike the browse filters above, the period is required: a
// report with no period at all (implicitly "all time") isn't a meaningful
// answer to "leave taken over a period".
export const leaveTakenReportQuerySchema = z
    .object({
        startDate: dateStringSchema,
        endDate: dateStringSchema,
    })
    .refine((data) => data.endDate >= data.startDate, {
        message: "endDate must be on or after startDate",
        path: ["endDate"],
    });
