// Salary slip generation (Module 5 v2, FR-025): HR picks a pay period; the
// system computes each payroll-ready employee's net pay from their
// salary_structures row plus LOP (loss-of-pay) days derived from approved
// leave requests — no CSV, no manual monthly re-entry. "Calculate" is a
// pure read (nothing written); "confirm" re-runs the same calculation and
// commits it. Recomputing at confirm time (rather than trusting whatever
// the client saw in the preview) means there's no client-supplied payroll
// data to smuggle at all — every figure always comes from the DB state at
// the moment of the call.
import { isInActorsHrScope, getHrScopedUsers } from "./hrScopeService.js";
import { findStructureByEmployeeId } from "../repositories/salaryStructureRepository.js";
import { findLopWorkingDays } from "../repositories/leaveRequestRepository.js";
import {
    findSlipsByEmployeeIds,
    findSlipById,
    replaceSlipsForPeriod,
    voidSlip,
} from "../repositories/salarySlipRepository.js";
import { notifySalarySlipsGenerated, notifySalarySlipVoided } from "./notificationService.js";
import { badRequest, forbidden, notFound, conflict } from "../utils/appError.js";

function round2(value) {
    return Math.round(value * 100) / 100;
}

// "YYYY-MM" -> the calendar month's [startDate, endDate] and day count,
// used both for the LOP overlap query and the per-day rate.
function monthRange(payPeriod) {
    const [year, month] = payPeriod.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");
    return {
        startDate: `${payPeriod}-01`,
        endDate: `${payPeriod}-${pad(daysInMonth)}`,
        daysInMonth,
    };
}

// "YYYY-MM-DD" for the server's local today — compared lexicographically
// against a period's startDate (same zero-padded shape), so string
// comparison alone tells us whether the period has started yet.
function todayDateString() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// A period that hasn't started yet has no attendance/leave data to compute
// LOP from at all — running payroll for it isn't "early," it's meaningless.
// Mid-month (period started but not finished) is deliberately still
// allowed: HR may want an early preview/run against what's happened so far,
// and forcing a hard month-end wait was explicitly not asked for.
function assertPeriodStarted(payPeriod) {
    const { startDate } = monthRange(payPeriod);
    if (startDate > todayDateString()) {
        throw badRequest("Cannot run payroll for a pay period that hasn't started yet");
    }
}

// Input: one employee's current salary_structures row and the pay period.
// Output: the full computed slip figures. Per-day rate for LOP = (basic +
// hra + special allowance) / calendar days in the month — PF employer
// contribution is recorded but never subtracted from net pay (it's a
// company cost, not a deduction from what the employee receives).
async function computeSlip(employee, structure, payPeriod) {
    const { startDate, endDate, daysInMonth } = monthRange(payPeriod);
    const lopDays = await findLopWorkingDays(employee.id, startDate, endDate);

    const basicSalary = Number(structure.basic_salary);
    const hra = Number(structure.hra);
    const specialAllowance = Number(structure.special_allowance);
    const pfEmployeeContribution = Number(structure.pf_employee_contribution);
    const pfEmployerContribution = Number(structure.pf_employer_contribution);
    const esic = Number(structure.esic);
    const incomeTax = Number(structure.income_tax);

    const perDayRate = (basicSalary + hra + specialAllowance) / daysInMonth;
    const lopDeduction = round2(perDayRate * lopDays);
    const netPay = round2(
        basicSalary + hra + specialAllowance - pfEmployeeContribution - esic - incomeTax - lopDeduction
    );

    return {
        employeeId: employee.id,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        status: "ok",
        skipReason: null,
        computed: {
            basicPay: basicSalary,
            hra,
            pfEmployeeContribution,
            pfEmployerContribution,
            esic,
            specialAllowance,
            lopDays,
            lopDeduction,
            incomeTax,
            netPay,
        },
    };
}

// Shared by calculatePayroll and confirmPayroll: every payroll-ready
// employee in the acting HR-tier actor's scope gets a computed row (an
// HR_ADMIN's own subtree, or SUPER_ADMIN's direct-report HR_ADMINs only —
// see hrScopeService.js); anyone missing a VERIFIED profile or a salary
// structure is reported as skipped, never silently omitted. `role`/
// `profileStatus` (both optional) narrow that scope first — e.g. running
// payroll for just VERIFIED employees, or just one role — so a run for the
// wrong slice of the team never has to happen in the first place. These are
// pre-filters on *who's included*, separate from the "skipped" reasons below
// (which explain why an *included* person still didn't get a real row).
async function calculateForSubtree(actor, payPeriod, { role, profileStatus } = {}) {
    let employees = await getHrScopedUsers(actor);
    if (role) {
        employees = employees.filter((person) => person.role === role);
    }
    if (profileStatus) {
        employees = employees.filter((person) => person.profile_status === profileStatus);
    }

    const rows = await Promise.all(
        employees.map(async (employee) => {
            if (employee.profile_status !== "VERIFIED") {
                return {
                    employeeId: employee.id,
                    employeeName: `${employee.first_name} ${employee.last_name}`,
                    status: "skipped",
                    skipReason: "Profile not yet verified",
                    computed: null,
                };
            }

            const structure = await findStructureByEmployeeId(employee.id);
            if (!structure) {
                return {
                    employeeId: employee.id,
                    employeeName: `${employee.first_name} ${employee.last_name}`,
                    status: "skipped",
                    skipReason: "No salary structure assigned",
                    computed: null,
                };
            }

            return computeSlip(employee, structure, payPeriod);
        })
    );

    const summary = {
        total: rows.length,
        ok: rows.filter((row) => row.status === "ok").length,
        skipped: rows.filter((row) => row.status === "skipped").length,
    };

    return { rows, summary };
}

export async function calculatePayroll(actor, payPeriod, filters = {}) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can calculate payroll");
    }
    assertPeriodStarted(payPeriod);
    return calculateForSubtree(actor, payPeriod, filters);
}

// `filters` must match whatever was passed to calculatePayroll for the
// preview HR is confirming — the same role/profileStatus slice, recomputed
// fresh (never trusting client-supplied preview figures, per the file
// header note), not a company-wide run with the preview's filters ignored.
export async function confirmPayroll(actor, payPeriod, filters = {}) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can approve payroll");
    }
    assertPeriodStarted(payPeriod);

    const { rows } = await calculateForSubtree(actor, payPeriod, filters);
    let okRows = rows.filter((row) => row.status === "ok");
    const skipped = rows.filter((row) => row.status === "skipped");

    // Re-running an already-ACTIVE period must go through voidSalarySlip
    // first — confirming again silently (replaceSlipsForPeriod's own
    // ON CONFLICT would otherwise just overwrite it) would erase a live
    // payslip without HR ever making that an explicit, reasoned decision.
    // A period whose only existing slip is VOIDED is untouched here: that
    // employee's row stays in okRows and replaceSlipsForPeriod both
    // archives the voided figures and reactivates it, exactly as before.
    if (okRows.length > 0) {
        const existing = await findSlipsByEmployeeIds(
            okRows.map((row) => row.employeeId),
            { payPeriod }
        );
        const alreadyActive = new Set(
            existing.filter((slip) => slip.status === "ACTIVE").map((slip) => slip.employee_id)
        );
        if (alreadyActive.size > 0) {
            for (const row of okRows) {
                if (alreadyActive.has(row.employeeId)) {
                    skipped.push({
                        employeeId: row.employeeId,
                        employeeName: row.employeeName,
                        status: "skipped",
                        skipReason: "Already generated for this period — void the existing slip first",
                        computed: null,
                    });
                }
            }
            okRows = okRows.filter((row) => !alreadyActive.has(row.employeeId));
        }
    }

    let committed = [];
    if (okRows.length > 0) {
        committed = await replaceSlipsForPeriod({
            payPeriod,
            actorId: actor.id,
            rows: okRows.map((row) => ({ employeeId: row.employeeId, ...row.computed })),
        });
        // Non-critical side effect (see notifySalarySlipsGenerated) — only
        // committed rows get notified; a skipped row never got a slip.
        await notifySalarySlipsGenerated(committed, payPeriod, actor.id);
    }

    return { committed, skipped };
}

// Output: `actor`'s own slips only — regardless of role. Previously this and
// listSalarySlipsForHr below were one function that branched purely on
// actor.role, so an HR admin's "Your slips" (GET /salary-slips/mine) took
// the same subtree path as "Your team's slips" (GET /salary-slips) and
// returned the exact same rows, which read as duplication on the page.
export async function listMySalarySlips(actor, { payPeriod } = {}) {
    return findSlipsByEmployeeIds([actor.id], { payPeriod });
}

// Output: the slips visible within the acting HR-tier actor's scope (never
// company-wide, never via findAllUsers — this app supports more than one
// HR_ADMIN, each the root of a separate branch; SUPER_ADMIN's scope is
// narrower still, direct-report HR_ADMINs only). HR-tier only — the route
// already gates this with requireRole, this is belt-and-suspenders at the
// service layer, same as calculatePayroll/confirmPayroll above. `role`
// (optional) narrows the scope by role before the `employeeId` filter (if
// any) is applied on top — same "pre-filter, don't compute-then-discard"
// shape as calculateForSubtree's own role/profileStatus filters.
export async function listSalarySlipsForHr(actor, { employeeId, payPeriod, role } = {}) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can view team salary slips");
    }
    let scopedUsers = await getHrScopedUsers(actor);
    if (role) {
        scopedUsers = scopedUsers.filter((person) => person.role === role);
    }
    const scopedIds = scopedUsers.map((person) => person.id);
    const employeeIds = employeeId ? scopedIds.filter((id) => id === employeeId) : scopedIds;
    return findSlipsByEmployeeIds(employeeIds, { payPeriod });
}

// Input: the actor and a slip id. Output: the slip, if `actor` is the
// employee it belongs to, or an HR-tier actor whose scope contains that
// employee — mirrors leaveRequestService.getLeaveRequestById's "auth
// piggybacked on the record itself" precedent. Failure mode: 404 (never
// 403) for anyone else, including a manager, so existence isn't leaked.
export async function getSalarySlipById(actor, id) {
    const slip = await findSlipById(id);
    if (!slip) {
        throw notFound("Salary slip not found");
    }

    const isOwner = actor.id === slip.employee_id;
    if (isOwner || (await isInActorsHrScope(actor, slip.employee_id))) {
        return slip;
    }

    throw notFound("Salary slip not found");
}

// Soft-deletes a slip generated by mistake (e.g. the wrong pay period) —
// HR-tier only, and only within their own scope; never the employee
// themself, unlike getSalarySlipById above, since voiding is a correction HR
// makes, not something to self-serve. 409 if it's already VOIDED, so a
// double click can't be mistaken for success.
export async function voidSalarySlip(actor, id, reason) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can void a salary slip");
    }

    const slip = await findSlipById(id);
    if (!slip || !(await isInActorsHrScope(actor, slip.employee_id))) {
        throw notFound("Salary slip not found");
    }

    const voided = await voidSlip(id, { voidedBy: actor.id, reason });
    if (!voided) {
        throw conflict("This salary slip is already voided");
    }
    await notifySalarySlipVoided(voided, reason, actor.id); // non-critical side effect
    return voided;
}
