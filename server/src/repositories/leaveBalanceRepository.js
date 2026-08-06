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
        `SELECT
            lb.id,
            lb.user_id,
            lb.leave_type_id,
            lt.name AS leave_type_name,
            lb.year,
            lb.entitlement,
            lb.days_taken,
            lb.days_pending,
            (lb.entitlement - lb.days_taken - lb.days_pending) AS days_remaining,
            lb.created_at,
            lb.updated_at
         FROM leave_balances lb
         JOIN leave_types lt ON lt.id = lb.leave_type_id
         WHERE lb.user_id = $1 AND lb.year = $2 AND lt.is_active = true
         ORDER BY lt.name`,
        [userId, year]
    );
    return result.rows;
}
