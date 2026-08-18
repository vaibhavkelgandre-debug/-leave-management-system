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
// `manager_first_name`/`manager_last_name` (the employee's manager, not
// `decider`) let the approvals view label a row "covering for X" when it
// belongs to a manager other than the viewer themself — the team list can
// now include a manager's team the viewer is only standing in for as an
// active delegate (see leaveRequestService.listTeamLeaveRequests), so
// `employee_manager_id` alone isn't enough for the UI to explain why an
// unfamiliar employee's request is showing up in someone else's list.
const JOINED_COLUMNS = `
    lr.id, lr.employee_id, lr.leave_type_id, lt.name AS leave_type_name,
    lr.start_date, lr.end_date, lr.start_half_day, lr.end_half_day, lr.working_days,
    lr.reason, lr.status, lr.decided_by, lr.decided_at, lr.decision_comment,
    lr.created_at, lr.updated_at,
    u.first_name AS employee_first_name, u.last_name AS employee_last_name, u.email AS employee_email, u.manager_id AS employee_manager_id,
    employee_role.role_name AS employee_role,
    manager.first_name AS manager_first_name, manager.last_name AS manager_last_name,
    decider.first_name AS decided_by_first_name, decider.last_name AS decided_by_last_name,
    EXISTS (SELECT 1 FROM leave_request_documents lrd WHERE lrd.leave_request_id = lr.id) AS has_document
`;
const JOINED_FROM = `FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    JOIN users u ON u.id = lr.employee_id
    JOIN roles employee_role ON employee_role.id = u.role_id
    LEFT JOIN users manager ON manager.id = u.manager_id
    LEFT JOIN users decider ON decider.id = lr.decided_by`;

// Input: the submission fields (employeeId/leaveTypeId/dates/flags/workingDays/reason).
// Output: the newly created row (base columns only — the caller already has
// the leave type name/employee details from validating the submission).
// Always created as SUBMITTED; no failure mode beyond a DB constraint (e.g. a
// bad FK) surfacing as a generic error.
// `status`/`decidedBy`/`decidedAt` default to a plain SUBMITTED row (the
// normal path — the DB column default would do this anyway, but passing it
// explicitly keeps every column visible in one place); SUPER_ADMIN's
// auto-approve bypass (leaveRequestService.submitLeaveRequest) is the one
// caller that overrides them, inserting directly as APPROVED so the row
// never exists in an intermediate SUBMITTED state even momentarily.
export async function insertLeaveRequest({
    employeeId,
    leaveTypeId,
    startDate,
    endDate,
    startHalfDay,
    endHalfDay,
    workingDays,
    reason,
    status = "SUBMITTED",
    decidedBy = null,
    decidedAt = null,
}) {
    const result = await pool.query(
        `INSERT INTO leave_requests
            (employee_id, leave_type_id, start_date, end_date, start_half_day, end_half_day, working_days, reason, status, decided_by, decided_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING ${BASE_COLUMNS}`,
        [employeeId, leaveTypeId, startDate, endDate, startHalfDay, endHalfDay, workingDays, reason, status, decidedBy, decidedAt]
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
// view. Excludes WITHDRAWN: once an employee withdraws their own request
// there's nothing left for a manager/HR to act on, so it shouldn't linger in
// their approvals list. Returns [] without a query for an empty list, since
// `= ANY('{}')` would otherwise need special-casing.
export async function findLeaveRequestsForEmployees(employeeIds) {
    if (employeeIds.length === 0) {
        return [];
    }
    const result = await pool.query(
        `SELECT ${JOINED_COLUMNS} ${JOINED_FROM}
         WHERE lr.employee_id = ANY($1::uuid[]) AND lr.status <> 'WITHDRAWN'
         ORDER BY lr.created_at DESC`,
        [employeeIds]
    );
    return result.rows;
}

// Output: every leave request in the system — HR's view, unscoped by team but
// still excludes WITHDRAWN for the same reason as findLeaveRequestsForEmployees
// above.
export async function findAllLeaveRequests() {
    const result = await pool.query(
        `SELECT ${JOINED_COLUMNS} ${JOINED_FROM} WHERE lr.status <> 'WITHDRAWN' ORDER BY lr.created_at DESC`
    );
    return result.rows;
}

// FR-024: HR's filterable browse view — every filter is optional and, unlike
// findAllLeaveRequests above, nothing is excluded by default (a WITHDRAWN
// request is exactly the kind of thing HR might deliberately filter *for*
// when browsing/reporting, unlike the approvals views where it's just dead
// weight). The WHERE clause is built up dynamically since every filter is
// optional, but every value is still passed as a placeholder — never string-
// concatenated — so this stays immune to SQL injection regardless of which
// filters are present. `startDate`/`endDate` use the standard interval-
// overlap test (a request overlaps the filter window at all), the same
// shape already used for holidays and overlap detection elsewhere.
export async function findLeaveRequestsFiltered({ employeeId, leaveTypeId, status, startDate, endDate, employeeIds } = {}) {
    // `employeeIds`, when passed, is the acting HR admin's own reporting
    // subtree (leaveRequestService.listFilteredLeaveRequests) — an
    // authorization boundary, not a user-facing filter, so it's applied
    // before any of the optional filters below and short-circuits the query
    // entirely for an HR admin with no subtree at all.
    if (employeeIds && employeeIds.length === 0) {
        return [];
    }

    const conditions = [];
    const params = [];

    if (employeeIds) {
        params.push(employeeIds);
        conditions.push(`lr.employee_id = ANY($${params.length}::uuid[])`);
    }
    if (employeeId) {
        params.push(employeeId);
        conditions.push(`lr.employee_id = $${params.length}`);
    }
    if (leaveTypeId) {
        params.push(leaveTypeId);
        conditions.push(`lr.leave_type_id = $${params.length}`);
    }
    if (status) {
        params.push(status);
        conditions.push(`lr.status = $${params.length}`);
    }
    if (startDate) {
        params.push(startDate);
        conditions.push(`lr.end_date >= $${params.length}`);
    }
    if (endDate) {
        params.push(endDate);
        conditions.push(`lr.start_date <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
        `SELECT ${JOINED_COLUMNS} ${JOINED_FROM} ${whereClause} ORDER BY lr.start_date DESC`,
        params
    );
    return result.rows;
}

// FR-024's "report of leave taken per employee over a period": one row per
// employee who has at least one APPROVED request overlapping [startDate,
// endDate] (INNER JOIN via GROUP BY — an employee who took no leave in the
// period simply doesn't appear, rather than showing a zero row for every
// employee in the company). "Taken" means APPROVED specifically — pending,
// rejected, withdrawn, and cancelled requests never actually consumed leave.
// A request is counted in full (its whole snapshotted `working_days`, not a
// pro-rated slice) whenever it overlaps the period at all, even if only
// partially — the same simplification already made for the year-boundary
// debit rule in submitLeaveRequest, documented for the same reason: a
// day-by-day split would need re-deriving the working-day calculation for
// an arbitrary sub-range, which is a lot more machinery for a case the
// brief doesn't ask this precisely for.
export async function findLeaveTakenReport({ startDate, endDate, employeeIds }) {
    // Same subtree authorization boundary as findLeaveRequestsFiltered above
    // — see that function's comment.
    if (employeeIds && employeeIds.length === 0) {
        return [];
    }

    const conditions = ["lr.status = 'APPROVED'", "lr.end_date >= $1", "lr.start_date <= $2"];
    const params = [startDate, endDate];
    if (employeeIds) {
        params.push(employeeIds);
        conditions.push(`u.id = ANY($${params.length}::uuid[])`);
    }

    const result = await pool.query(
        `SELECT
            u.id AS employee_id,
            u.first_name AS employee_first_name,
            u.last_name AS employee_last_name,
            employee_role.role_name AS employee_role,
            COUNT(lr.id)::int AS request_count,
            SUM(lr.working_days)::numeric AS total_days_taken
         FROM leave_requests lr
         JOIN users u ON u.id = lr.employee_id
         JOIN roles employee_role ON employee_role.id = u.role_id
         WHERE ${conditions.join(" AND ")}
         GROUP BY u.id, u.first_name, u.last_name, employee_role.role_name
         ORDER BY u.first_name, u.last_name`,
        params
    );
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

// Module 5 v2: LOP (loss of pay) days for one employee's payroll period —
// the sum of `working_days` on their APPROVED requests of any leave type
// flagged `counts_as_lop`, overlapping [startDate, endDate] (same interval-
// overlap test as findLeaveTakenReport above). Reuses existing leave data
// instead of a separate attendance system, which doesn't exist in this app.
export async function findLopWorkingDays(employeeId, startDate, endDate) {
    const result = await pool.query(
        `SELECT COALESCE(SUM(lr.working_days), 0) AS lop_days
         FROM leave_requests lr
         JOIN leave_types lt ON lt.id = lr.leave_type_id
         WHERE lr.employee_id = $1
           AND lr.status = 'APPROVED'
           AND lt.counts_as_lop = true
           AND lr.end_date >= $2 AND lr.start_date <= $3`,
        [employeeId, startDate, endDate]
    );
    return Number(result.rows[0].lop_days);
}
