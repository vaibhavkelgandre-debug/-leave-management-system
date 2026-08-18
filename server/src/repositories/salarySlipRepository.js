// Pure parameterized SQL for salary_slips/salary_slip_revisions — no
// business rules here (LOP calculation, who's allowed to see or create a
// slip, all live in salarySlipService.js), only queries.
import pool from "../config/db.js";

const SLIP_COLUMNS = `
    ss.id, ss.employee_id, ss.pay_period,
    ss.basic_pay, ss.hra, ss.pf_employee_contribution, ss.pf_employer_contribution,
    ss.esic, ss.special_allowance, ss.lop_days, ss.lop_deduction, ss.income_tax, ss.net_pay,
    ss.status, ss.voided_by, ss.voided_at, ss.void_reason,
    ss.created_by, ss.updated_by, ss.created_at, ss.updated_at,
    u.first_name AS employee_first_name, u.last_name AS employee_last_name, u.email AS employee_email,
    u.designation AS employee_designation, u.employee_code AS employee_code,
    u.joining_date AS employee_joining_date, u.pan_number AS employee_pan_number,
    u.aadhar_number AS employee_aadhar_number
`;

// Input: the employee ids a caller is allowed to see (already resolved by
// the service layer — either just the caller's own id, or their HR
// subtree), and an optional pay period to narrow to one. Output: every
// matching slip, newest period first.
export async function findSlipsByEmployeeIds(employeeIds, { payPeriod } = {}) {
    if (employeeIds.length === 0) return [];

    const params = [employeeIds];
    let where = "ss.employee_id = ANY($1::uuid[])";
    if (payPeriod) {
        params.push(payPeriod);
        where += ` AND ss.pay_period = $${params.length}`;
    }

    const result = await pool.query(
        `SELECT ${SLIP_COLUMNS}
         FROM salary_slips ss
         JOIN users u ON u.id = ss.employee_id
         WHERE ${where}
         ORDER BY ss.pay_period DESC, u.first_name`,
        params
    );
    return result.rows;
}

export async function findSlipById(id) {
    const result = await pool.query(
        `SELECT ${SLIP_COLUMNS}
         FROM salary_slips ss
         JOIN users u ON u.id = ss.employee_id
         WHERE ss.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

// Bulk create-or-correct for one pay period, as a single statement (no
// pool.connect()/BEGIN — matching leaveBalanceRepository's convention of
// expressing a multi-row write as one atomic statement rather than an
// application-level transaction). For each incoming (employee_id) row: if a
// slip already exists for (employee_id, pay_period), its current values are
// archived into salary_slip_revisions first, then overwritten; otherwise a
// new slip is created. `rows` is `[{ employeeId, basicPay, hra,
// pfEmployeeContribution, pfEmployerContribution, esic, specialAllowance,
// lopDays, lopDeduction, incomeTax, netPay }]` — already computed by
// salarySlipService.calculatePayroll from a salary_structures row plus
// leave data, never raw user input.
export async function replaceSlipsForPeriod({ payPeriod, rows, actorId }) {
    if (rows.length === 0) return [];

    const employeeIds = rows.map((row) => row.employeeId);
    const basicPays = rows.map((row) => row.basicPay);
    const hras = rows.map((row) => row.hra);
    const pfEmployeeContributions = rows.map((row) => row.pfEmployeeContribution);
    const pfEmployerContributions = rows.map((row) => row.pfEmployerContribution);
    const esics = rows.map((row) => row.esic);
    const specialAllowances = rows.map((row) => row.specialAllowance);
    const lopDaysList = rows.map((row) => row.lopDays);
    const lopDeductions = rows.map((row) => row.lopDeduction);
    const incomeTaxes = rows.map((row) => row.incomeTax);
    const netPays = rows.map((row) => row.netPay);

    const result = await pool.query(
        `WITH incoming (
            employee_id, basic_pay, hra, pf_employee_contribution, pf_employer_contribution,
            esic, special_allowance, lop_days, lop_deduction, income_tax, net_pay
        ) AS (
            SELECT * FROM UNNEST(
                $1::uuid[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[],
                $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[], $12::numeric[]
            )
        ),
        archived AS (
            INSERT INTO salary_slip_revisions
                (salary_slip_id, employee_id, pay_period, basic_pay, hra, pf_employee_contribution, pf_employer_contribution,
                 esic, special_allowance, lop_days, lop_deduction, income_tax, net_pay, replaced_by)
            SELECT s.id, s.employee_id, s.pay_period, s.basic_pay, s.hra, s.pf_employee_contribution, s.pf_employer_contribution,
                   s.esic, s.special_allowance, s.lop_days, s.lop_deduction, s.income_tax, s.net_pay, $13
            FROM salary_slips s
            JOIN incoming i ON i.employee_id = s.employee_id
            WHERE s.pay_period = $2
            RETURNING 1
        )
        INSERT INTO salary_slips (
            employee_id, pay_period, basic_pay, hra, pf_employee_contribution, pf_employer_contribution,
            esic, special_allowance, lop_days, lop_deduction, income_tax, net_pay, created_by
        )
        SELECT employee_id, $2, basic_pay, hra, pf_employee_contribution, pf_employer_contribution,
               esic, special_allowance, lop_days, lop_deduction, income_tax, net_pay, $13
        FROM incoming
        ON CONFLICT (employee_id, pay_period) DO UPDATE SET
            basic_pay = EXCLUDED.basic_pay,
            hra = EXCLUDED.hra,
            pf_employee_contribution = EXCLUDED.pf_employee_contribution,
            pf_employer_contribution = EXCLUDED.pf_employer_contribution,
            esic = EXCLUDED.esic,
            special_allowance = EXCLUDED.special_allowance,
            lop_days = EXCLUDED.lop_days,
            lop_deduction = EXCLUDED.lop_deduction,
            income_tax = EXCLUDED.income_tax,
            net_pay = EXCLUDED.net_pay,
            updated_by = $13,
            updated_at = CURRENT_TIMESTAMP,
            -- Re-running a period is a fresh, authoritative confirm — it
            -- supersedes any earlier void on that same slip, same as it
            -- already supersedes the earlier figures (archived above).
            status = 'ACTIVE',
            voided_by = NULL,
            voided_at = NULL,
            void_reason = NULL
        RETURNING id, employee_id, pay_period, basic_pay, hra, pf_employee_contribution, pf_employer_contribution,
                  esic, special_allowance, lop_days, lop_deduction, income_tax, net_pay, status,
                  created_by, updated_by, created_at, updated_at`,
        [
            employeeIds,
            payPeriod,
            basicPays,
            hras,
            pfEmployeeContributions,
            pfEmployerContributions,
            esics,
            specialAllowances,
            lopDaysList,
            lopDeductions,
            incomeTaxes,
            netPays,
            actorId,
        ]
    );
    return result.rows;
}

// Soft-delete: marks a slip VOIDED rather than removing it, so a mistaken
// run (e.g. generated for the wrong pay period) leaves a record that it was
// corrected rather than silently disappearing. Scoped to `status = 'ACTIVE'`
// so voiding an already-voided slip is a no-op (returns null) rather than
// re-stamping voided_by/voided_at — the service layer turns that into a 409.
export async function voidSlip(id, { voidedBy, reason }) {
    const result = await pool.query(
        `UPDATE salary_slips
         SET status = 'VOIDED', voided_by = $2, voided_at = CURRENT_TIMESTAMP, void_reason = $3
         WHERE id = $1 AND status = 'ACTIVE'
         RETURNING id, employee_id, pay_period, status, voided_by, voided_at, void_reason`,
        [id, voidedBy, reason ?? null]
    );
    return result.rows[0] || null;
}

// Append-only reads — nothing here ever updates or deletes a revision row,
// matching audit_logs' append-only convention.
export async function findRevisionsBySlipId(slipId) {
    const result = await pool.query(
        `SELECT id, salary_slip_id, employee_id, pay_period, basic_pay, hra, pf_employee_contribution, pf_employer_contribution,
                esic, special_allowance, lop_days, lop_deduction, income_tax, net_pay, replaced_by, replaced_at
         FROM salary_slip_revisions
         WHERE salary_slip_id = $1
         ORDER BY replaced_at DESC`,
        [slipId]
    );
    return result.rows;
}
