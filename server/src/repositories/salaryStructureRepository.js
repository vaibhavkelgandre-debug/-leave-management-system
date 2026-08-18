// Pure parameterized SQL for salary_structures/salary_structure_revisions —
// no business rules here (who's allowed to assign one lives in
// salaryStructureService.js), only queries.
import pool from "../config/db.js";

const COLUMNS = `id, employee_id, basic_salary, hra, pf_employee_contribution, pf_employer_contribution,
    esic, special_allowance, income_tax, created_by, updated_by, created_at, updated_at`;

export async function findStructureByEmployeeId(employeeId) {
    const result = await pool.query(`SELECT ${COLUMNS} FROM salary_structures WHERE employee_id = $1`, [employeeId]);
    return result.rows[0] || null;
}

// Single atomic statement (no pool.connect()/BEGIN, matching this
// codebase's convention — see salarySlipRepository.replaceSlipsForPeriod):
// archives the current row (if any) into salary_structure_revisions, then
// creates or overwrites the structure via ON CONFLICT.
export async function upsertStructure({
    employeeId,
    basicSalary,
    hra,
    pfEmployeeContribution,
    pfEmployerContribution,
    esic,
    specialAllowance,
    incomeTax,
    actorId,
}) {
    const result = await pool.query(
        `WITH archived AS (
            INSERT INTO salary_structure_revisions
                (salary_structure_id, employee_id, basic_salary, hra, pf_employee_contribution, pf_employer_contribution, esic, special_allowance, income_tax, replaced_by)
            SELECT id, employee_id, basic_salary, hra, pf_employee_contribution, pf_employer_contribution, esic, special_allowance, income_tax, $9
            FROM salary_structures WHERE employee_id = $1
            RETURNING 1
        )
        INSERT INTO salary_structures
            (employee_id, basic_salary, hra, pf_employee_contribution, pf_employer_contribution, esic, special_allowance, income_tax, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (employee_id) DO UPDATE SET
            basic_salary = EXCLUDED.basic_salary,
            hra = EXCLUDED.hra,
            pf_employee_contribution = EXCLUDED.pf_employee_contribution,
            pf_employer_contribution = EXCLUDED.pf_employer_contribution,
            esic = EXCLUDED.esic,
            special_allowance = EXCLUDED.special_allowance,
            income_tax = EXCLUDED.income_tax,
            updated_by = $9,
            updated_at = CURRENT_TIMESTAMP
        RETURNING ${COLUMNS}`,
        [employeeId, basicSalary, hra, pfEmployeeContribution, pfEmployerContribution, esic, specialAllowance, incomeTax, actorId]
    );
    return result.rows[0];
}
