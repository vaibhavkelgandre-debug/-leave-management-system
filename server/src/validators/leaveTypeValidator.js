import { z } from "zod";

// Enforces FR-009 (half-day leave) at the leave-type level: entitlements must
// land on a 0.5 boundary so balances derived from them stay half-day-accurate.
const isHalfDayIncrement = (value) => Number.isInteger(value * 2);

export const createLeaveTypeSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    annualEntitlement: z
        .number()
        .min(0, "annualEntitlement must be 0 or greater")
        .refine(isHalfDayIncrement, "annualEntitlement must be in increments of 0.5"),
    accrualType: z.enum(["UPFRONT", "MONTHLY"]),
    allowNegativeBalance: z.boolean().optional().default(false),
    requiresDocument: z.boolean().optional().default(false),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema;

export const leaveTypeIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
});

export const updateLeaveTypeStatusSchema = z.object({
    isActive: z.boolean(),
});

export const listLeaveTypesQuerySchema = z.object({
    includeInactive: z.coerce.boolean().optional().default(false),
});
