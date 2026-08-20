import pool from "../config/db.js";

// Issues a reset token unless one was already issued for this user inside
// `cooldownSeconds`. Input: the user, the new token's hash and expiry, and
// the cooldown window. Output: the new/updated row, or **null meaning
// "throttled — do not email"**.
//
// Deliberately one statement rather than the obvious check-then-invalidate-
// then-insert trio, which was wrong in three separate ways:
//
//   1. **Clock skew.** `created_at` defaults to Postgres's CURRENT_TIMESTAMP
//      into a `timestamp` (no time zone) column, while a JS-side comparison
//      would use the Node process's clock. With Node and Postgres in
//      different zones the cooldown silently never fires (or blocks for
//      hours). `LOCALTIMESTAMP` puts both sides of the comparison on the DB
//      clock, so the skew is structurally impossible.
//   2. **TOCTOU.** A separate SELECT then INSERT lets two concurrent
//      requests both pass the check and both send. A double-click was
//      enough.
//   3. **A 409 enumeration oracle.** Two concurrent inserts collided on the
//      `uq_password_resets_active_user` partial index; errorHandler.js maps
//      23505 to 409, so a real address returned 409 where an unknown one
//      returned 200 — precisely the "which emails are registered" leak this
//      endpoint is built to prevent. `ON CONFLICT` makes 23505 unreachable.
//
// Matches this codebase's existing convention of expressing an atomic
// multi-step write as a single statement rather than an application-level
// transaction (see salarySlipRepository.replaceSlipsForPeriod).
//
// Trade-off: superseding a live token now overwrites its row instead of
// stamping `used_at` and inserting a new one, so there's no history of
// superseded tokens. Nothing reads that. The upside is that `used_at` now
// means exactly one thing — "consumed by confirmPasswordReset" — and
// `created_at` means "last issued", which is exactly what the cooldown needs.
export async function issuePasswordReset({ userId, tokenHash, expiresAt, cooldownSeconds }) {
    const result = await pool.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (
             SELECT 1 FROM password_resets
             WHERE user_id = $1
               AND created_at > LOCALTIMESTAMP - ($4::int * INTERVAL '1 second')
         )
         ON CONFLICT (user_id) WHERE used_at IS NULL
         DO UPDATE SET token_hash = EXCLUDED.token_hash,
                       expires_at = EXCLUDED.expires_at,
                       created_at = LOCALTIMESTAMP,
                       updated_at = LOCALTIMESTAMP
         WHERE password_resets.created_at <= LOCALTIMESTAMP - ($4::int * INTERVAL '1 second')
         RETURNING id, user_id, expires_at`,
        [userId, tokenHash, expiresAt, cooldownSeconds]
    );
    return result.rows[0] || null;
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
