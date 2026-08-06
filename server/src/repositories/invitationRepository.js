import pool from "../config/db.js";

export async function invalidateActiveForUser(userId) {
    await pool.query(
        "UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND accepted_at IS NULL",
        [userId]
    );
}

export async function insertInvitation({ userId, tokenHash, invitedBy, expiresAt }) {
    const result = await pool.query(
        `INSERT INTO invitations (user_id, token_hash, invited_by, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, expires_at`,
        [userId, tokenHash, invitedBy, expiresAt]
    );
    return result.rows[0];
}

export async function findActiveByTokenHash(tokenHash) {
    const result = await pool.query(
        `SELECT id, user_id, expires_at, accepted_at
         FROM invitations
         WHERE token_hash = $1 AND accepted_at IS NULL`,
        [tokenHash]
    );
    return result.rows[0] || null;
}

export async function markAccepted(id) {
    await pool.query(
        "UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1",
        [id]
    );
}
