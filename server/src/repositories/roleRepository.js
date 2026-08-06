import pool from "../config/db.js";

export async function findRoleByName(roleName) {
    const result = await pool.query(
        "SELECT id, role_name FROM roles WHERE role_name = $1",
        [roleName]
    );
    return result.rows[0] || null;
}
