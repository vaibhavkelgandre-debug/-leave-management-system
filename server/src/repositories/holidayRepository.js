import pool from "../config/db.js";

const HOLIDAY_COLUMNS = `id, name, start_date, end_date, created_at, updated_at`;

export async function insertHoliday({ name, startDate, endDate }) {
    const result = await pool.query(
        `INSERT INTO holidays (name, start_date, end_date)
         VALUES ($1, $2, $3)
         RETURNING ${HOLIDAY_COLUMNS}`,
        [name, startDate, endDate]
    );
    return result.rows[0];
}

export async function findAllHolidays({ year } = {}) {
    const result = await pool.query(
        `SELECT ${HOLIDAY_COLUMNS}
         FROM holidays
         ${year ? "WHERE EXTRACT(YEAR FROM start_date) <= $1 AND EXTRACT(YEAR FROM end_date) >= $1" : ""}
         ORDER BY start_date`,
        year ? [year] : []
    );
    return result.rows;
}

export async function findHolidayById(id) {
    const result = await pool.query(`SELECT ${HOLIDAY_COLUMNS} FROM holidays WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

// Two ranges overlap when each starts on or before the other's end — the
// standard interval-overlap test, applied to any existing holiday against
// the candidate [startDate, endDate].
export async function findOverlappingHoliday({ startDate, endDate, excludeId }) {
    const result = await pool.query(
        `SELECT id FROM holidays
         WHERE start_date <= $2 AND end_date >= $1
         ${excludeId ? "AND id != $3" : ""}
         LIMIT 1`,
        excludeId ? [startDate, endDate, excludeId] : [startDate, endDate]
    );
    return result.rows[0] || null;
}

export async function updateHoliday(id, { name, startDate, endDate }) {
    const result = await pool.query(
        `UPDATE holidays
         SET name = $2, start_date = $3, end_date = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${HOLIDAY_COLUMNS}`,
        [id, name, startDate, endDate]
    );
    return result.rows[0] || null;
}

export async function deleteHoliday(id) {
    const result = await pool.query(`DELETE FROM holidays WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
}
