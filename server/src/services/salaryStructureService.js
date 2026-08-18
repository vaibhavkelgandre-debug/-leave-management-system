// Module 5 v2: the salary structure HR assigns once per employee. Visibility
// is self-or-HR-in-scope (like salary slips); only HR-tier actors may
// assign/edit one.
import { findStructureByEmployeeId, upsertStructure } from "../repositories/salaryStructureRepository.js";
import { isInActorsHrScope } from "./hrScopeService.js";
import { notifySalaryStructureUpdated } from "./notificationService.js";
import { forbidden, notFound } from "../utils/appError.js";

async function assertHrInSubtree(actor, employeeId) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can manage salary structures");
    }
    if (!(await isInActorsHrScope(actor, employeeId))) {
        throw notFound("Employee not found");
    }
}

// The employee can see their own structure (payroll-readiness transparency
// — this is what "you're payroll-ready" ultimately depends on); HR can see
// any structure within their own subtree.
export async function getStructure(actor, employeeId) {
    if (actor.id !== employeeId) {
        await assertHrInSubtree(actor, employeeId);
    }
    return findStructureByEmployeeId(employeeId);
}

export async function assignStructure(actor, employeeId, fields) {
    await assertHrInSubtree(actor, employeeId);
    const structure = await upsertStructure({ employeeId, ...fields, actorId: actor.id });
    await notifySalaryStructureUpdated(employeeId, actor.id); // non-critical side effect
    return structure;
}
