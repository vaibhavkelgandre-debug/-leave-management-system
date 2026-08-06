import { z } from "zod";

export const yearQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
});
