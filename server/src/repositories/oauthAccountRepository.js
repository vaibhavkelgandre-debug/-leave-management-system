import pool from "../config/db.js";

export async function findByProviderSubject(provider, providerUserId) {
    const result = await pool.query(
        "SELECT id, user_id, provider, provider_user_id FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2",
        [provider, providerUserId]
    );
    return result.rows[0] || null;
}

export async function insertOauthAccount({ userId, provider, providerUserId, providerEmail }) {
    const result = await pool.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, provider) DO UPDATE SET provider_user_id = EXCLUDED.provider_user_id, provider_email = EXCLUDED.provider_email
         RETURNING id, user_id, provider`,
        [userId, provider, providerUserId, providerEmail]
    );
    return result.rows[0];
}
