import { z } from "zod";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "holidayDate must be in YYYY-MM-DD format");

export const createHolidaySchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    holidayDate: dateStringSchema,
});

export const updateHolidaySchema = createHolidaySchema;

export const holidayIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
});

export const listHolidaysQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
});
