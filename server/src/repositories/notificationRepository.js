// Pure parameterized SQL for the notifications table — no business rules
// here (recipient resolution and message-building live in
// notificationService.js), only queries, same layering as every other
// repository in this app.
import pool from "../config/db.js";

const COLUMNS = `id, recipient_id, actor_id, type, entity_type, entity_id, message, is_read, read_at, created_at, updated_at`;

// Input: the recipient, the notify-event's type/entity, an optional actor,
// and the precomputed message string. Output: the newly created row.
export async function insertNotification({ recipientId, actorId = null, type, entityType, entityId, message }) {
    const result = await pool.query(
        `INSERT INTO notifications (recipient_id, actor_id, type, entity_type, entity_id, message)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        [recipientId, actorId, type, entityType, entityId, message]
    );
    return result.rows[0];
}

// Input: a recipient id and `{ unreadOnly, limit, offset }`. Output: that
// recipient's notifications, newest first — the index on
// (recipient_id, is_read, created_at DESC) backs both the unread-only and
// full-history cases without a separate query shape for each.
export async function findNotificationsForUser(recipientId, { unreadOnly = false, limit = 20, offset = 0 } = {}) {
    const conditions = ["recipient_id = $1"];
    const params = [recipientId];

    if (unreadOnly) {
        conditions.push("is_read = false");
    }

    params.push(limit, offset);
    const result = await pool.query(
        `SELECT ${COLUMNS} FROM notifications
         WHERE ${conditions.join(" AND ")}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );
    return result.rows;
}

// Input: a recipient id and the same `unreadOnly` flag `findNotificationsForUser`
// was called with. Output: the total row count for that same filter, so the
// frontend can paginate ("20 of 143") without a second, differently-shaped query.
export async function countTotalForUser(recipientId, { unreadOnly = false } = {}) {
    const condition = unreadOnly ? "recipient_id = $1 AND is_read = false" : "recipient_id = $1";
    const result = await pool.query(`SELECT COUNT(*) FROM notifications WHERE ${condition}`, [recipientId]);
    return Number(result.rows[0].count);
}

// Backs the bell badge — a cheap COUNT on the same index as the list query.
export async function countUnreadForUser(recipientId) {
    const result = await pool.query(
        `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = false`,
        [recipientId]
    );
    return Number(result.rows[0].count);
}

// Input: a notification id. Output: the row, or null — used by the service
// to check `recipient_id` ownership before marking it read (never trust the
// id alone; a notification is only ever visible to its own recipient).
export async function findNotificationById(id) {
    const result = await pool.query(`SELECT ${COLUMNS} FROM notifications WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

// Idempotent by design: marking an already-read notification read again just
// re-runs the same UPDATE and returns the same row, rather than erroring.
export async function markRead(id) {
    const result = await pool.query(
        `UPDATE notifications
         SET is_read = true, read_at = COALESCE(read_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${COLUMNS}`,
        [id]
    );
    return result.rows[0];
}

// Input: a notification `type` and the `entity_id` it's about. Output:
// whether one was already created today — the dedupe guard for the
// time-based (sweep-driven, not event-driven) delegation start/end
// notifications, which could otherwise run more than once on the same
// calendar day (e.g. an hourly sweep, or a server restart) and double up.
export async function existsNotificationCreatedToday(type, entityId) {
    const result = await pool.query(
        `SELECT 1 FROM notifications WHERE type = $1 AND entity_id = $2 AND created_at::date = CURRENT_DATE LIMIT 1`,
        [type, entityId]
    );
    return result.rows.length > 0;
}

// Output: how many rows were actually flipped from unread to read (not the
// recipient's total notification count) — lets the controller report a
// meaningful "5 marked as read" rather than a number that's always the same.
export async function markAllRead(recipientId) {
    const result = await pool.query(
        `UPDATE notifications
         SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE recipient_id = $1 AND is_read = false
         RETURNING id`,
        [recipientId]
    );
    return result.rows.length;
}
