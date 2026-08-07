// Pure parameterized SQL for the append-only leave_balance_ledger table.
// Deliberately has no update/delete export — every balance-affecting action
// (submit, approve, reject, withdraw, cancel, override) writes a new row,
// never edits an old one, which is what makes "balance never drifts" (NFR-2)
// a structural guarantee rather than a discipline everyone has to remember.
import pool from "../config/db.js";

// Input: which user/leave-type/year this entry applies to, the leave request
// that caused it, how much it changes the pending/taken totals by (either can
// be 0), and a short `reason` tag for humans reading the ledger later.
// Output: the inserted row. No failure mode beyond a bad FK.
export async function insertLedgerEntry({
    userId,
    leaveTypeId,
    year,
    leaveRequestId,
    pendingDelta = 0,
    takenDelta = 0,
    reason,
}) {
    const result = await pool.query(
        `INSERT INTO leave_balance_ledger (user_id, leave_type_id, year, leave_request_id, pending_delta, taken_delta, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, user_id, leave_type_id, year, leave_request_id, pending_delta, taken_delta, reason, created_at`,
        [userId, leaveTypeId, year, leaveRequestId, pendingDelta, takenDelta, reason]
    );
    return result.rows[0];
}
