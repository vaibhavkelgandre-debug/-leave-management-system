import pool from "../config/db.js";

// `invited_by` is a scalar subquery, not a JOIN, so a user with more than one
// invitations row (not possible today — there's no resend/re-invite feature
// yet — but defensive regardless) can never multiply this user into extra
// rows the way a LEFT JOIN would. `ORDER BY created_at ASC LIMIT 1` picks the
// original invite if that ever changes. NULL for anyone who registered
// through a path with no invitation row at all (the root HR_ADMIN via
// POST /auth/register/hr) — used by userService.changeManager to restrict
// who may edit an HR_ADMIN's own reporting line to whoever created them.
const PUBLIC_USER_COLUMNS = `
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    r.role_name AS role,
    u.manager_id,
    u.department_id,
    u.status,
    u.created_at,
    u.updated_at,
    (SELECT i.invited_by FROM invitations i WHERE i.user_id = u.id ORDER BY i.created_at ASC LIMIT 1) AS invited_by
`;

export async function findAllUsers() {
    const result = await pool.query(
        `SELECT ${PUBLIC_USER_COLUMNS}
         FROM users u
         JOIN roles r ON r.id = u.role_id
         ORDER BY u.created_at`
    );
    return result.rows;
}

// Removes people who never accepted their invite before it expired. Deleting the
// user (rather than just hiding them) is deliberate: users.email is UNIQUE, so a
// lingering stale row would permanently block HR from re-inviting that person.
// Scoped to status = 'INVITED' so an accepted account can never be caught by this,
// even if an old invitation row is left behind. Dependent rows (invitations,
// leave balances, oauth accounts, password resets) cascade.
export async function deleteExpiredInvitees() {
    const result = await pool.query(
        `DELETE FROM users u
         USING invitations i
         WHERE i.user_id = u.id
           AND u.status = 'INVITED'
           AND i.accepted_at IS NULL
           AND i.expires_at < CURRENT_TIMESTAMP
         RETURNING u.id`
    );
    return result.rows.map((row) => row.id);
}

export async function findUserById(id) {
    const result = await pool.query(
        `SELECT ${PUBLIC_USER_COLUMNS}
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

export async function findAuthByEmail(email) {
    const result = await pool.query(
        `SELECT u.id, u.email, u.password_hash, u.status, r.role_name AS role, u.manager_id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE lower(u.email) = lower($1)`,
        [email]
    );
    return result.rows[0] || null;
}

export async function findAuthContextById(id) {
    const result = await pool.query(
        `SELECT u.id, u.email, u.status, r.role_name AS role, u.manager_id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

export async function countUsers() {
    const result = await pool.query("SELECT COUNT(*)::int AS count FROM users");
    return result.rows[0].count;
}

export async function insertUser({
    firstName,
    lastName,
    email,
    passwordHash = null,
    roleId,
    managerId = null,
    status = "ACTIVE",
}) {
    const result = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role_id, manager_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, first_name, last_name, email, role_id, manager_id, status, created_at, updated_at`,
        [firstName, lastName, email, passwordHash, roleId, managerId, status]
    );
    return result.rows[0];
}

export async function setPasswordHashAndActivate(id, passwordHash) {
    const result = await pool.query(
        `UPDATE users
         SET password_hash = $2, status = 'ACTIVE'
         WHERE id = $1
         RETURNING id, email, status`,
        [id, passwordHash]
    );
    return result.rows[0] || null;
}

export async function touchLastLogin(id) {
    await pool.query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
}

export async function updateStatus(id, status) {
    const result = await pool.query(
        `UPDATE users
         SET status = $2
         WHERE id = $1
         RETURNING id, status`,
        [id, status]
    );
    return result.rows[0] || null;
}

export async function updatePasswordHash(id, passwordHash) {
    await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, passwordHash]);
}

export async function updateManager(id, managerId) {
    const result = await pool.query(
        `UPDATE users
         SET manager_id = $2
         WHERE id = $1
         RETURNING id, manager_id`,
        [id, managerId]
    );
    return result.rows[0] || null;
}

export async function findDirectReports(managerId) {
    const result = await pool.query(
        `SELECT ${PUBLIC_USER_COLUMNS}
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.manager_id = $1
         ORDER BY u.first_name`,
        [managerId]
    );
    return result.rows;
}

export async function findSubtreeUsers(rootId) {
    const result = await pool.query(
        `WITH RECURSIVE subtree AS (
            SELECT id, manager_id, 0 AS depth FROM users WHERE id = $1
            UNION
            SELECT u.id, u.manager_id, s.depth + 1
            FROM users u
            JOIN subtree s ON u.manager_id = s.id
            WHERE s.depth < 20
        )
        SELECT ${PUBLIC_USER_COLUMNS}
        FROM users u
        JOIN roles r ON r.id = u.role_id
        JOIN subtree s ON s.id = u.id
        ORDER BY u.first_name`,
        [rootId]
    );
    return result.rows;
}

export async function isUserInSubtree(rootId, candidateId) {
    const result = await pool.query(
        `WITH RECURSIVE subtree AS (
            SELECT id, manager_id, 0 AS depth FROM users WHERE id = $1
            UNION
            SELECT u.id, u.manager_id, s.depth + 1
            FROM users u
            JOIN subtree s ON u.manager_id = s.id
            WHERE s.depth < 20
        )
        SELECT EXISTS (SELECT 1 FROM subtree WHERE id = $2) AS in_subtree`,
        [rootId, candidateId]
    );
    return result.rows[0].in_subtree;
}
