import pool from "../config/db.js";

const HOLIDAY_COLUMNS = `id, name, holiday_date, created_at, updated_at`;

export async function insertHoliday({ name, holidayDate }) {
    const result = await pool.query(
        `INSERT INTO holidays (name, holiday_date)
         VALUES ($1, $2)
         RETURNING ${HOLIDAY_COLUMNS}`,
        [name, holidayDate]
    );
    return result.rows[0];
}

export async function findAllHolidays({ year } = {}) {
    const result = await pool.query(
        `SELECT ${HOLIDAY_COLUMNS}
         FROM holidays
         ${year ? "WHERE EXTRACT(YEAR FROM holiday_date) = $1" : ""}
         ORDER BY holiday_date`,
        year ? [year] : []
    );
    return result.rows;
}

export async function findHolidayById(id) {
    const result = await pool.query(`SELECT ${HOLIDAY_COLUMNS} FROM holidays WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

export async function updateHoliday(id, { name, holidayDate }) {
    const result = await pool.query(
        `UPDATE holidays
         SET name = $2, holiday_date = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${HOLIDAY_COLUMNS}`,
        [id, name, holidayDate]
    );
    return result.rows[0] || null;
}

export async function deleteHoliday(id) {
    const result = await pool.query(`DELETE FROM holidays WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
}
