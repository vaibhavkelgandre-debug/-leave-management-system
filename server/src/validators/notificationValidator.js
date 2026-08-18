// Request-shape validation for the notifications API. Only the list
// endpoint takes any input at all — mark-read/mark-all-read/unread-count
// take no body/query beyond the id already validated by validateParams.
import { z } from "zod";

const booleanish = z.preprocess((value) => (typeof value === "string" ? value === "true" : value), z.boolean());

// `limit`/`offset` arrive as query-string values (always strings) —
// z.coerce.number() turns them into actual numbers before the min/max
// checks run. Capped at 50 to keep a single page cheap regardless of how
// far back a user's notification history goes (NFR-7).
export const listNotificationsQuerySchema = z.object({
    unreadOnly: booleanish.optional().default(false),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const notificationIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
});
