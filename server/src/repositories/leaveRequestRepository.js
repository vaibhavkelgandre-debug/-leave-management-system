// Pure parameterized SQL for the leave_requests table — no business rules
// here (overlap/balance/authorization checks all live in leaveRequestService.js),
// only queries.
import pool from "../config/db.js";

const BASE_COLUMNS = `id, employee_id, leave_type_id, start_date, end_date, start_half_day, end_half_day,
    working_days, reason, status, decided_by, decided_at, decision_comment, created_at, updated_at`;

// Joined shape used by every "read" query — includes the leave type's name,
// the employee's name/manager_id (so callers, the service's authorization
// check in particular, never need a second round-trip just to find out who
// a request's employee reports to), and whoever most recently decided it
// (`decided_by` is only an id otherwise — LEFT JOIN since it's NULL for a
// still-SUBMITTED request).
// `has_document` (FR-012) lets the UI show a "view document" action only on
// requests that actually have one, without a second round-trip per row — a
// plain EXISTS subquery rather than a LEFT JOIN, since leave_request_documents
// is at most one row per request and this only needs a boolean, not its columns.
// `employee_role` lets the team/approvals view show a role badge next to the
// employee's name (HR sees everyone's requests, so the role isn't otherwise
// obvious from that list alone).
const JOINED_COLUMNS = `
    lr.id, lr.employee_id, lr.leave_type_id, lt.name AS leave_type_name,
    lr.start_date, lr.end_date, lr.start_half_day, lr.end_half_day, lr.working_days,
    lr.reason, lr.status, lr.decided_by, lr.decided_at, lr.decision_comment,
    lr.created_at, lr.updated_at,
    u.first_name AS employee_first_name, u.last_name AS employee_last_name, u.manager_id AS employee_manager_id,
    employee_role.role_name AS employee_role,
    decider.first_name AS decided_by_first_name, decider.last_name AS decided_by_last_name,
    EXISTS (SELECT 1 FROM leave_request_documents lrd WHERE lrd.leave_request_id = lr.id) AS has_document
`;
const JOINED_FROM = `FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    JOIN users u ON u.id = lr.employee_id
    JOIN roles employee_role ON employee_role.id = u.role_id
    LEFT JOIN users decider ON decider.id = lr.decided_by`;

// Input: the submission fields (employeeId/leaveTypeId/dates/flags/workingDays/reason).
// Output: the newly created row (base columns only — the caller already has
// the leave type name/employee details from validating the submission).
// Always created as SUBMITTED; no failure mode beyond a DB constraint (e.g. a
// bad FK) surfacing as a generic error.
export async function insertLeaveRequest({
    employeeId,
    leaveTypeId,
    startDate,
    endDate,
    startHalfDay,
    endHalfDay,
    workingDays,
    reason,
}) {
    const result = await pool.query(
        `INSERT INTO leave_requests
            (employee_id, leave_type_id, start_date, end_date, start_half_day, end_half_day, working_days, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${BASE_COLUMNS}`,
        [employeeId, leaveTypeId, startDate, endDate, startHalfDay, endHalfDay, workingDays, reason]
    );
    return result.rows[0];
}

// Input: a leave request id. Output: the joined row, or null if it doesn't
// exist — callers translate a null into a 404 themselves.
export async function findLeaveRequestById(id) {
    const result = await pool.query(`SELECT ${JOINED_COLUMNS} ${JOINED_FROM} WHERE lr.id = $1`, [id]);
    return result.rows[0] || null;
}

// Input: one employee id. Output: that employee's own requests, newest first.
export async function findLeaveRequestsForEmployee(employeeId) {
    const result = await pool.query(
        `SELECT ${JOINED_COLUMNS} ${JOINED_FROM} WHERE lr.employee_id = $1 ORDER BY lr.start_date DESC`,
        [employeeId]
    );
    return result.rows;
}

// Input: an array of employee ids (a manager's direct reports). Output: all
// of their requests, newest-submitted first — used for the manager approvals
// view. Returns [] without a query for an empty list, since `= ANY('{}')`
// would otherwise need special-casing.
export async function findLeaveRequestsForEmployees(employeeIds) {
    if (employeeIds.length === 0) {
        return [];
    }
    const result = await pool.query(
        `SELECT ${JOINED_COLUMNS} ${JOINED_FROM} WHERE lr.employee_id = ANY($1::uuid[]) ORDER BY lr.created_at DESC`,
        [employeeIds]
    );
    return result.rows;
}

// Output: every leave request in the system — HR's view, unscoped.
export async function findAllLeaveRequests() {
    const result = await pool.query(`SELECT ${JOINED_COLUMNS} ${JOINED_FROM} ORDER BY lr.created_at DESC`);
    return result.rows;
}

// FR-015: a request overlaps another of the same employee's if their date
// ranges intersect (the standard interval-overlap test, same shape already
// used for holidays) and the other request hasn't already been
// rejected/withdrawn/cancelled — only SUBMITTED/APPROVED requests hold a
// claim on the calendar.
export async function findOverlappingLeaveRequest({ employeeId, startDate, endDate }) {
    const result = await pool.query(
        `SELECT id FROM leave_requests
         WHERE employee_id = $1
           AND status IN ('SUBMITTED', 'APPROVED')
           AND start_date <= $3 AND end_date >= $2
         LIMIT 1`,
        [employeeId, startDate, endDate]
    );
    return result.rows[0] || null;
}

// Input: the request id, the new status, who caused the change, and an
// optional comment. Output: the updated base row, or null if the id doesn't
// exist. `decided_by`/`decided_at` are reused for every transition (approve,
// reject, withdraw, cancel, override) as "who/when changed the status most
// recently" — not only for manager approval decisions.
export async function updateLeaveRequestStatus(id, { status, decidedBy, decisionComment = null }) {
    const result = await pool.query(
        `UPDATE leave_requests
         SET status = $2, decided_by = $3, decided_at = CURRENT_TIMESTAMP, decision_comment = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${BASE_COLUMNS}`,
        [id, status, decidedBy, decisionComment]
    );
    return result.rows[0] || null;
}
