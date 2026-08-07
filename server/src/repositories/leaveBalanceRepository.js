// Pure parameterized SQL for the leave_balances table. `entitlement` is the
// only value stored per row; `days_taken`/`days_pending` are always derived
// from leave_balance_ledger at read time (see BALANCE_SELECT below) rather
// than stored — see the header comment in
// server/src/sql/014_create_leave_balance_ledger.sql for why.
import pool from "../config/db.js";

// Seeds a balance (full annual entitlement, current call's year) for every
// ACTIVE leave type this user doesn't already have a row for. Called right
// after a new employee is created — ON CONFLICT DO NOTHING makes it safe to
// call more than once for the same user/year.
export async function seedBalancesForUser(userId, year) {
    await pool.query(
        `INSERT INTO leave_balances (user_id, leave_type_id, year, entitlement)
         SELECT $1, lt.id, $2, lt.annual_entitlement
         FROM leave_types lt
         WHERE lt.is_active = true
         ON CONFLICT (user_id, leave_type_id, year) DO NOTHING`,
        [userId, year]
    );
}

// Seeds a balance for every ACTIVE user for a single newly created leave
// type. Called right after HR creates the leave type so existing employees
// don't have to wait for their next balance read to be backfilled.
export async function backfillBalancesForLeaveType(leaveTypeId, year) {
    await pool.query(
        `INSERT INTO leave_balances (user_id, leave_type_id, year, entitlement)
         SELECT u.id, lt.id, $2, lt.annual_entitlement
         FROM users u, leave_types lt
         WHERE u.status = 'ACTIVE' AND lt.id = $1
         ON CONFLICT (user_id, leave_type_id, year) DO NOTHING`,
        [leaveTypeId, year]
    );
}

// The balance-with-arithmetic SELECT, shared by listBalancesForUser and
// getBalanceForUserAndType. `days_taken`/`days_pending` are NOT stored
// columns — leave_balances only stores `entitlement` — they're derived by
// summing leave_balance_ledger every time this runs (NFR-2: the number is
// always recomputed from the history that produced it, so there's no running
// total that could ever drift out of step with that history). The LEFT JOIN
// means a leave type with zero ledger entries yet still returns 0, not NULL,
// via COALESCE.
const BALANCE_SELECT = `
    SELECT
        lb.id,
        lb.user_id,
        lb.leave_type_id,
        lt.name AS leave_type_name,
        lb.year,
        lb.entitlement,
        COALESCE(SUM(ledger.taken_delta), 0) AS days_taken,
        COALESCE(SUM(ledger.pending_delta), 0) AS days_pending,
        lb.entitlement - COALESCE(SUM(ledger.taken_delta), 0) - COALESCE(SUM(ledger.pending_delta), 0) AS days_remaining,
        lb.created_at,
        lb.updated_at
    FROM leave_balances lb
    JOIN leave_types lt ON lt.id = lb.leave_type_id
    LEFT JOIN leave_balance_ledger ledger
        ON ledger.user_id = lb.user_id AND ledger.leave_type_id = lb.leave_type_id AND ledger.year = lb.year
`;
const BALANCE_GROUP_BY = "GROUP BY lb.id, lt.name";

// Self-healing read: ensures a balance row exists for every active leave
// type before returning the list. This is what makes balances "just appear"
// across a calendar-year boundary without a year-rollover job — the first
// read of a new year backfills it the same way a new leave type does.
export async function listBalancesForUser(userId, year) {
    await pool.query(
        `INSERT INTO leave_balances (user_id, leave_type_id, year, entitlement)
         SELECT $1, lt.id, $2, lt.annual_entitlement
         FROM leave_types lt
         WHERE lt.is_active = true
         ON CONFLICT (user_id, leave_type_id, year) DO NOTHING`,
        [userId, year]
    );

    const result = await pool.query(
        `${BALANCE_SELECT}
         WHERE lb.user_id = $1 AND lb.year = $2 AND lt.is_active = true
         ${BALANCE_GROUP_BY}
         ORDER BY lt.name`,
        [userId, year]
    );
    return result.rows;
}

// Input: a user, a specific leave type, and a year (a leave type may be
// inactive here on purpose — a request against a type that was later
// deactivated still needs its balance checkable). Output: the single balance
// row, or null if it doesn't exist yet (callers needing one to exist should
// call listBalancesForUser or seedBalancesForUser first to self-heal it).
export async function getBalanceForUserAndType(userId, leaveTypeId, year) {
    const result = await pool.query(
        `${BALANCE_SELECT}
         WHERE lb.user_id = $1 AND lb.leave_type_id = $2 AND lb.year = $3
         ${BALANCE_GROUP_BY}`,
        [userId, leaveTypeId, year]
    );
    return result.rows[0] || null;
}
