import pool from "../config/db.js";

const LEAVE_TYPE_COLUMNS = `
    id,
    name,
    annual_entitlement,
    accrual_type,
    allow_negative_balance,
    requires_document,
    is_active,
    created_at,
    updated_at
`;

export async function insertLeaveType({
    name,
    annualEntitlement,
    accrualType,
    allowNegativeBalance = false,
    requiresDocument = false,
}) {
    const result = await pool.query(
        `INSERT INTO leave_types (name, annual_entitlement, accrual_type, allow_negative_balance, requires_document)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${LEAVE_TYPE_COLUMNS}`,
        [name, annualEntitlement, accrualType, allowNegativeBalance, requiresDocument]
    );
    return result.rows[0];
}

export async function findAllLeaveTypes({ includeInactive = false } = {}) {
    const result = await pool.query(
        `SELECT ${LEAVE_TYPE_COLUMNS}
         FROM leave_types
         ${includeInactive ? "" : "WHERE is_active = true"}
         ORDER BY name`
    );
    return result.rows;
}

export async function findLeaveTypeById(id) {
    const result = await pool.query(`SELECT ${LEAVE_TYPE_COLUMNS} FROM leave_types WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

export async function updateLeaveType(id, { name, annualEntitlement, accrualType, allowNegativeBalance, requiresDocument }) {
    const result = await pool.query(
        `UPDATE leave_types
         SET name = $2,
             annual_entitlement = $3,
             accrual_type = $4,
             allow_negative_balance = $5,
             requires_document = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${LEAVE_TYPE_COLUMNS}`,
        [id, name, annualEntitlement, accrualType, allowNegativeBalance, requiresDocument]
    );
    return result.rows[0] || null;
}

export async function updateLeaveTypeStatus(id, isActive) {
    const result = await pool.query(
        `UPDATE leave_types
         SET is_active = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${LEAVE_TYPE_COLUMNS}`,
        [id, isActive]
    );
    return result.rows[0] || null;
}
