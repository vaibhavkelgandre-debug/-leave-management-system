// Request-shape validation for leave requests (submit/preview/decide). Every
// write endpoint validates server-side, per NFR-4 — never trust the client.
import { z } from "zod";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

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
        startHalfDay: z.boolean().optional().default(false),
        endHalfDay: z.boolean().optional().default(false),
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
// override transitions to apply (see leaveRequestStateMachine.js).
export const overrideSchema = z.object({
    toStatus: z.enum(["APPROVED", "REJECTED"]),
    comment: z.string().trim().optional(),
});
