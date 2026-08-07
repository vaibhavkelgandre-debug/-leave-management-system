// Pure parameterized SQL for the delegations table (FR-020).
import pool from "../config/db.js";

const JOINED_COLUMNS = `
    d.id, d.manager_id, d.delegate_id,
    u.first_name AS delegate_first_name, u.last_name AS delegate_last_name,
    d.start_date, d.end_date, d.created_at
`;

// Input: the manager, the nominated delegate, and the active date range.
// Output: the newly created row (joined shape). No failure mode beyond a DB
// constraint (e.g. manager_id = delegate_id, rejected by chk_delegations_not_self).
export async function insertDelegation({ managerId, delegateId, startDate, endDate }) {
    const result = await pool.query(
        `INSERT INTO delegations (manager_id, delegate_id, start_date, end_date)
         VALUES ($1, $2, $3, $4)
         RETURNING id, manager_id, delegate_id, start_date, end_date, created_at`,
        [managerId, delegateId, startDate, endDate]
    );
    const inserted = result.rows[0];
    return findDelegationById(inserted.id);
}

// Input: a delegation id. Output: the joined row, or null.
export async function findDelegationById(id) {
    const result = await pool.query(
        `SELECT ${JOINED_COLUMNS} FROM delegations d JOIN users u ON u.id = d.delegate_id WHERE d.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

// Input: a manager id. Output: every delegation that manager has ever
// nominated, most recent start date first.
export async function findDelegationsForManager(managerId) {
    const result = await pool.query(
        `SELECT ${JOINED_COLUMNS} FROM delegations d
         JOIN users u ON u.id = d.delegate_id
         WHERE d.manager_id = $1
         ORDER BY d.start_date DESC`,
        [managerId]
    );
    return result.rows;
}

// FR-020's overlap guard: two delegations for the *same* manager must not
// have overlapping date ranges, or "who's the active delegate today" would be
// ambiguous. Same interval-overlap test already used for holidays.
export async function findOverlappingDelegationForManager({ managerId, startDate, endDate }) {
    const result = await pool.query(
        `SELECT id FROM delegations
         WHERE manager_id = $1 AND start_date <= $3 AND end_date >= $2
         LIMIT 1`,
        [managerId, startDate, endDate]
    );
    return result.rows[0] || null;
}

// Input: a candidate manager/delegate pair and a "YYYY-MM-DD" date. Output:
// the delegation row if `delegateId` is actively standing in for `managerId`
// on that date, else null — this is the exact question
// leaveRequestService.assertCanActOnLeaveRequest needs answered for every
// approve/reject attempt by someone who isn't the request's direct manager.
export async function findActiveDelegation({ managerId, delegateId, onDate }) {
    const result = await pool.query(
        `SELECT id FROM delegations
         WHERE manager_id = $1 AND delegate_id = $2 AND start_date <= $3 AND end_date >= $3
         LIMIT 1`,
        [managerId, delegateId, onDate]
    );
    return result.rows[0] || null;
}
