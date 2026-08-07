import { z } from "zod";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format");

export const createHolidaySchema = z
    .object({
        name: z.string().trim().min(1, "Name is required"),
        startDate: dateStringSchema,
        // Omitted entirely for a single-day holiday — the service defaults it
        // to startDate. Compared as plain strings, which sorts correctly
        // because the format is always zero-padded YYYY-MM-DD.
        endDate: dateStringSchema.optional(),
    })
    .refine((data) => !data.endDate || data.endDate >= data.startDate, {
        message: "endDate must be on or after startDate",
        path: ["endDate"],
    });

export const updateHolidaySchema = createHolidaySchema;

export const holidayIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
});

export const listHolidaysQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
});
