// Pure parameterized SQL for the append-only audit_logs table (FR-021).
// Deliberately exposes no update/delete function — the only way to add to
// this table is `insertAuditLog`, so there is no code path in this codebase
// that could ever edit or remove a past entry.
import pool from "../config/db.js";

// Used by `insertAuditLog`'s RETURNING clause, which can't reference joined tables.
const BASE_COLUMNS = `id, leave_request_id, actor_id, acted_for, action, old_status, new_status, comment, created_at`;

// Joined shape used only by `findAuditLogsForLeaveRequest`, so the trail can show
// names instead of opaque ids. `actor` is always present (INNER JOIN); `delegate_for`
// is only set when a delegate acted on a manager's behalf, so it's a LEFT JOIN.
const JOINED_COLUMNS = `
    al.id, al.leave_request_id, al.actor_id, al.acted_for, al.action, al.old_status, al.new_status, al.comment, al.created_at,
    actor.first_name AS actor_first_name, actor.last_name AS actor_last_name,
    delegate_for.first_name AS acted_for_first_name, delegate_for.last_name AS acted_for_last_name
`;
const JOINED_FROM = `FROM audit_logs al
    JOIN users actor ON actor.id = al.actor_id
    LEFT JOIN users delegate_for ON delegate_for.id = al.acted_for`;

// Input: which request changed, who did it (`actorId`), who they were acting
// on behalf of if this was a delegate (`actedFor`, otherwise null), the
// action name, the before/after status, and an optional comment.
// Output: the inserted row. No failure mode beyond a bad FK.
export async function insertAuditLog({
    leaveRequestId,
    actorId,
    actedFor = null,
    action,
    oldStatus = null,
    newStatus = null,
    comment = null,
}) {
    const result = await pool.query(
        `INSERT INTO audit_logs (leave_request_id, actor_id, acted_for, action, old_status, new_status, comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${BASE_COLUMNS}`,
        [leaveRequestId, actorId, actedFor, action, oldStatus, newStatus, comment]
    );
    return result.rows[0];
}

// Input: a leave request id. Output: its full history, oldest first — the
// natural reading order for an audit trail — with actor/delegate names
// resolved so callers never have to show a raw user id.
export async function findAuditLogsForLeaveRequest(leaveRequestId) {
    const result = await pool.query(
        `SELECT ${JOINED_COLUMNS} ${JOINED_FROM} WHERE al.leave_request_id = $1 ORDER BY al.created_at`,
        [leaveRequestId]
    );
    return result.rows;
}
