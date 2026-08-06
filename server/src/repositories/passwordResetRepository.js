import pool from "../config/db.js";

export async function invalidateActiveForUser(userId) {
    await pool.query(
        "UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL",
        [userId]
    );
}

export async function insertPasswordReset({ userId, tokenHash, expiresAt }) {
    const result = await pool.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, expires_at`,
        [userId, tokenHash, expiresAt]
    );
    return result.rows[0];
}

export async function findActiveByTokenHash(tokenHash) {
    const result = await pool.query(
        `SELECT id, user_id, expires_at, used_at
         FROM password_resets
         WHERE token_hash = $1 AND used_at IS NULL`,
        [tokenHash]
    );
    return result.rows[0] || null;
}

export async function markUsed(id) {
    await pool.query("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
}
