// Request-shape validation for salary slips (Module 5 v2 — calculated from
// a salary_structures row + LOP, not a CSV upload).
import { z } from "zod";

const payPeriodSchema = z.string().regex(/^\d{4}-\d{2}$/, "payPeriod must be in YYYY-MM format");

// `role`/`profileStatus` (both optional) narrow which subtree members a
// calculate/confirm run includes — e.g. only VERIFIED employees, or only
// one role — so a run for the wrong slice of the team never has to happen
// in the first place. `confirm`'s body must carry the same filters as the
// `calculate` call HR previewed, so the two schemas share this shape.
export const payPeriodBodySchema = z.object({
    payPeriod: payPeriodSchema,
    role: z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN"]).optional(),
    profileStatus: z.enum(["INCOMPLETE", "SUBMITTED", "VERIFIED"]).optional(),
});

export const salarySlipIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
});

// POST /api/salary-slips/:id/void — the reason is optional free text, kept
// short since it's just a note for whoever looks at the slip's history
// later, not a structured audit field.
export const voidSlipSchema = z.object({
    reason: z.string().trim().max(500).optional(),
});

// GET /api/salary-slips query params — HR's subtree list, optionally
// narrowed to one employee/period/role. `role` narrows the same way
// `payPeriodBodySchema`'s does for a payroll run — e.g. only EMPLOYEE slips.
export const listSalarySlipsQuerySchema = z.object({
    employeeId: z.string().uuid("employeeId must be a valid id").optional(),
    payPeriod: payPeriodSchema.optional(),
    role: z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN"]).optional(),
    // Pagination, same shape/cap as the leave-request lists: coerced (query
    // strings are always strings), defaulted so an un-paged caller still gets
    // a bounded response, capped so nobody can ask for every slip ever run.
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

// GET /api/salary-slips/mine query params — the caller's own slips,
// optionally narrowed to one pay period.
export const mySalarySlipsQuerySchema = z.object({
    payPeriod: payPeriodSchema.optional(),
});
