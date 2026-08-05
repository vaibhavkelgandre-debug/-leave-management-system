import pool from "../config/db.js";

export async function getUsers() {

    const result = await pool.query(
        "SELECT * FROM users"
    );
    return result.rows;

}