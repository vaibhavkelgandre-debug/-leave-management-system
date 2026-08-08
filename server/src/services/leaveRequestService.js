// Module 3 core business logic: submitting a leave request and moving it
// through approve/reject/withdraw/cancel/override. This is the one place
// row-level authorization is checked (NFR-1) and the one place a leave
// request's ledger/audit side effects are written — repositories stay pure
// SQL, the controller stays thin glue, exactly like every other feature.
import { findLeaveTypeById } from "../repositories/leaveTypeRepository.js";
import { findAllHolidays } from "../repositories/holidayRepository.js";
import { findDirectReports } from "../repositories/userRepository.js";
import {
    insertLeaveRequest,
    findLeaveRequestById,
    findLeaveRequestsForEmployee,
    findLeaveRequestsForEmployees,
    findAllLeaveRequests,
    findOverlappingLeaveRequest,
    updateLeaveRequestStatus,
} from "../repositories/leaveRequestRepository.js";
import { getBalanceForUserAndType, seedBalancesForUser } from "../repositories/leaveBalanceRepository.js";
import { insertLedgerEntry } from "../repositories/leaveBalanceLedgerRepository.js";
import { findActiveDelegation } from "../repositories/delegationRepository.js";
import { insertAuditLog, findAuditLogsForLeaveRequest } from "../repositories/auditLogRepository.js";
import {
    insertLeaveRequestDocument,
    findDocumentByLeaveRequestId,
} from "../repositories/leaveRequestDocumentRepository.js";
import { calculateWorkingDays } from "./workingDayService.js";
import { assertLegalTransition } from "./leaveRequestStateMachine.js";
import { uploadLeaveRequestDocument, getSignedDocumentUrl } from "./cloudinaryService.js";
import { detectFileType } from "../utils/fileType.js";
import { todayDateKey } from "../utils/dates.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/appError.js";

// FR-012 (Module 3, point 2): only these three content types are accepted
// for a leave-request document, checked against the file's real bytes
// (fileType.js) rather than its extension or reported Content-Type.
const ACCEPTED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

// Maps a state-machine action to the ledger `reason` tag it produces —
// separate from the action name because the two override actions collapse
// onto shared reason tags (HR_OVERRIDE_APPROVE/HR_OVERRIDE_REJECT) that read
// naturally in the ledger regardless of which status they started from.
const LEDGER_REASON_BY_ACTION = {
    APPROVE: "APPROVE",
    REJECT: "REJECT",
    WITHDRAW: "WITHDRAW",
    CANCEL: "CANCEL",
    HR_OVERRIDE_TO_APPROVED: "HR_OVERRIDE_APPROVE",
    HR_OVERRIDE_TO_REJECTED: "HR_OVERRIDE_REJECT",
};

// Input: an action name and the request's snapshotted `workingDays`. Output:
// how much this action changes the ledger's pending/taken totals by. A
// request's `working_days` never changes after submission, so every delta
// here is either +workingDays, -workingDays, or 0 — never recomputed.
// Business meaning of each case (see Module 3 spec in .claude/rules.md):
//   SUBMIT already happened by the time this runs; APPROVE moves the hold
//   from pending into taken; REJECT/WITHDRAW just release the hold; CANCEL
//   returns already-taken days; the two HR overrides directly flip taken
//   without touching pending, since pending was already resolved by the
//   original approve/reject.
function ledgerDeltaForAction(action, workingDays) {
    switch (action) {
        case "APPROVE":
            return { pendingDelta: -workingDays, takenDelta: workingDays };
        case "REJECT":
        case "WITHDRAW":
            return { pendingDelta: -workingDays, takenDelta: 0 };
        case "CANCEL":
            return { pendingDelta: 0, takenDelta: -workingDays };
        case "HR_OVERRIDE_TO_APPROVED":
            return { pendingDelta: 0, takenDelta: workingDays };
        case "HR_OVERRIDE_TO_REJECTED":
            return { pendingDelta: 0, takenDelta: -workingDays };
        default:
            // Unreachable: assertLegalTransition already rejects any action
            // not in its TRANSITIONS map before this function is ever called.
            throw new Error(`No ledger rule for action: ${action}`);
    }
}

// True if `actorId` is `employeeManagerId` themselves, or is currently an
// active delegate standing in for them. Shared by the "can view" and "can
// act" checks below so the delegate-window logic exists in exactly one place.
async function isManagerOrDelegateOf(actorId, employeeManagerId) {
    if (!employeeManagerId) {
        return false;
    }
    if (employeeManagerId === actorId) {
        return true;
    }
    const delegation = await findActiveDelegation({
        managerId: employeeManagerId,
        delegateId: actorId,
        onDate: todayDateKey(),
    });
    return Boolean(delegation);
}

// The single row-level authorization check (NFR-1) for every mutating
// action. Input: the authenticated actor, the joined leave request row, and
// the action they're attempting. Output: `{ actedFor }` — `actedFor` is the
// manager being represented when a delegate acts, otherwise null (FR-020's
// audit requirement). Failure modes: 404 when the actor has no legitimate
// reason to know this request exists at all (an unrelated manager or
// employee); 403 when they know it exists but this action isn't theirs to
// take (their own request, wrong role, or a delegation window that isn't
// active today) — see the NFR-5 policy note in .claude/rules.md.
async function resolveActingCapacity(actor, request, action) {
    const isOwner = actor.id === request.employee_id;

    if (action === "WITHDRAW" || action === "CANCEL") {
        if (!isOwner) {
            throw notFound("Leave request not found");
        }
        return { actedFor: null };
    }

    // An employee can never approve/reject/override their own request,
    // regardless of what role they hold — checked before any role check so
    // an HR admin can't rubber-stamp their own leave either.
    if (isOwner) {
        throw forbidden("You cannot act on your own leave request");
    }

    if (action === "HR_OVERRIDE_TO_APPROVED" || action === "HR_OVERRIDE_TO_REJECTED") {
        if (actor.role === "HR_ADMIN") {
            return { actedFor: null };
        }
        throw forbidden("Only HR can override a decision");
    }

    // APPROVE / REJECT: HR can act on anything; otherwise the actor must be
    // the employee's direct manager or an active delegate for that manager.
    if (actor.role === "HR_ADMIN") {
        return { actedFor: null };
    }
    if (await isManagerOrDelegateOf(actor.id, request.employee_manager_id)) {
        const actingAsDelegate = request.employee_manager_id !== actor.id;
        return { actedFor: actingAsDelegate ? request.employee_manager_id : null };
    }

    throw notFound("Leave request not found");
}

// Input: candidate submission fields. Output: `{ workingDays }` — never
// persists anything. This is what lets the frontend show "this request will
// use N days" before the employee actually submits (Module 3 spec, point 3),
// using the exact same calculation the real submission will use.
export async function previewWorkingDays({ startDate, endDate, startHalfDay, endHalfDay }) {
    const holidays = await findAllHolidays({});
    return calculateWorkingDays({ startDate, endDate, startHalfDay, endHalfDay, holidays });
}

// Input: the submitting employee's id, the request fields, and an optional
// `file` (multer's in-memory `{ buffer, size, originalname }`, or undefined
// if none was attached). Output: the newly created request (joined shape).
// Failure modes: 400 if the leave type doesn't exist/is inactive, if the
// range has no working days, if it would take the balance below zero and the
// leave type doesn't allow that, if the leave type requires a document and
// none was attached, or if an attached file's real content isn't one of the
// accepted types (FR-012); 409 if it overlaps an existing pending/approved
// request of the same employee's.
export async function submitLeaveRequest(
    employeeId,
    { leaveTypeId, startDate, endDate, startHalfDay, endHalfDay, reason },
    file
) {
    const leaveType = await findLeaveTypeById(leaveTypeId);
    if (!leaveType || !leaveType.is_active) {
        throw badRequest("Leave type not found or inactive");
    }

    if (leaveType.requires_document && !file) {
        throw badRequest(`A document is required for ${leaveType.name} requests`);
    }

    // Detected before anything else touches the DB or Cloudinary — never
    // trust the client-reported mimetype/extension (NFR-4).
    let detectedFileType = null;
    if (file) {
        detectedFileType = detectFileType(file.buffer);
        if (!ACCEPTED_DOCUMENT_TYPES.has(detectedFileType)) {
            throw badRequest("Document must be a PDF, JPG or PNG file");
        }
    }

    const holidays = await findAllHolidays({});
    const workingDays = calculateWorkingDays({ startDate, endDate, startHalfDay, endHalfDay, holidays });
    if (workingDays <= 0) {
        throw badRequest("This date range doesn't include any working days");
    }

    if (await findOverlappingLeaveRequest({ employeeId, startDate, endDate })) {
        throw conflict("You already have a pending or approved request that overlaps these dates");
    }

    // Requests spanning a year boundary are debited against the start date's
    // year — a documented simplification rather than splitting the deduction
    // proportionally across two balance rows.
    const year = Number(startDate.slice(0, 4));
    await seedBalancesForUser(employeeId, year); // self-heals the balance row, same as every other balance read in this app
    const balance = await getBalanceForUserAndType(employeeId, leaveTypeId, year);

    if (!leaveType.allow_negative_balance && workingDays > Number(balance.days_remaining)) {
        throw badRequest("This request would take your balance below zero");
    }

    // Uploaded last among the validation/pre-checks, and before the request
    // row is inserted: if Cloudinary fails, nothing has been written to
    // Postgres yet, so there's no partial leave request left behind and
    // nothing to roll back.
    let uploadedDocument = null;
    if (file) {
        uploadedDocument = await uploadLeaveRequestDocument({ buffer: file.buffer, mimeType: detectedFileType });
    }

    const request = await insertLeaveRequest({
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        startHalfDay,
        endHalfDay,
        workingDays,
        reason,
    });

    if (uploadedDocument) {
        await insertLeaveRequestDocument({
            leaveRequestId: request.id,
            cloudinaryPublicId: uploadedDocument.publicId,
            cloudinaryResourceType: uploadedDocument.resourceType,
            originalFilename: file.originalname,
            mimeType: detectedFileType,
            fileSizeBytes: file.size,
            uploadedBy: employeeId,
        });
    }

    await insertLedgerEntry({
        userId: employeeId,
        leaveTypeId,
        year,
        leaveRequestId: request.id,
        pendingDelta: workingDays,
        takenDelta: 0,
        reason: "SUBMIT",
    });

    await insertAuditLog({
        leaveRequestId: request.id,
        actorId: employeeId,
        action: "SUBMIT",
        oldStatus: null,
        newStatus: "SUBMITTED",
    });

    return findLeaveRequestById(request.id);
}

// Output: the employee's own requests.
export async function listMyLeaveRequests(employeeId) {
    return findLeaveRequestsForEmployee(employeeId);
}

// Output: requests the actor can act on — everything, for HR; only direct
// reports, for a manager. Deliberately direct-reports-only rather than the
// full reporting subtree: approval authority belongs to the direct manager
// (or their delegate), not a skip-level manager further up the tree, so the
// list an actor sees matches exactly what they're allowed to act on.
export async function listTeamLeaveRequests(actor) {
    if (actor.role === "HR_ADMIN") {
        return findAllLeaveRequests();
    }
    const reports = await findDirectReports(actor.id);
    return findLeaveRequestsForEmployees(reports.map((report) => report.id));
}

// Input: the actor and a request id. Output: the request, if the actor is
// its owner, HR, its direct manager, or an active delegate for that manager
// — viewing is allowed in more cases than acting (an owner can view but
// never approve their own request). Failure mode: 404 otherwise.
export async function getLeaveRequestById(actor, requestId) {
    const request = await findLeaveRequestById(requestId);
    if (!request) {
        throw notFound("Leave request not found");
    }

    const isOwner = actor.id === request.employee_id;
    if (isOwner || actor.role === "HR_ADMIN" || (await isManagerOrDelegateOf(actor.id, request.employee_manager_id))) {
        return request;
    }

    throw notFound("Leave request not found");
}

// Input: the actor and a request id. Output: that request's full audit trail
// (FR-021), oldest first — same viewing rule as getLeaveRequestById, since
// anyone who can see the request can see how it got to its current state.
export async function getAuditTrail(actor, requestId) {
    await getLeaveRequestById(actor, requestId); // throws 404 if the actor can't view this request at all
    return findAuditLogsForLeaveRequest(requestId);
}

// Input: the actor and a request id. Output: `{ url, filename, mimeType }` —
// a signed Cloudinary URL valid for a few minutes (cloudinaryService.js),
// generated fresh on every call rather than stored, so a document is never
// reachable through a link that outlives this check. Same viewing rule as
// getLeaveRequestById (FR-012: "visible only to the requester, their
// approver and HR"). Failure modes: 404 if the actor can't view the request
// at all, or if the request has no document attached.
export async function getLeaveRequestDocument(actor, requestId) {
    await getLeaveRequestById(actor, requestId); // throws 404 if the actor can't view this request at all

    const document = await findDocumentByLeaveRequestId(requestId);
    if (!document) {
        throw notFound("This leave request has no document attached");
    }

    return {
        url: getSignedDocumentUrl(document.cloudinary_public_id, document.cloudinary_resource_type),
        filename: document.original_filename,
        mimeType: document.mime_type,
    };
}

// Input: the actor, the request id, the action being taken (one of the keys
// in leaveRequestStateMachine.js's TRANSITIONS), and an optional comment.
// Output: the updated request. Failure modes: 404/403 from
// resolveActingCapacity, 409 from assertLegalTransition, or 400 if trying to
// CANCEL a leave that has already started.
export async function decideLeaveRequest(actor, requestId, action, comment) {
    const request = await findLeaveRequestById(requestId);
    if (!request) {
        throw notFound("Leave request not found");
    }

    const { actedFor } = await resolveActingCapacity(actor, request, action);
    const newStatus = assertLegalTransition(action, request.status);

    if (action === "CANCEL" && request.start_date <= todayDateKey()) {
        throw badRequest("Only a future, still-approved leave can be cancelled");
    }

    const year = Number(request.start_date.slice(0, 4));
    const { pendingDelta, takenDelta } = ledgerDeltaForAction(action, Number(request.working_days));

    await updateLeaveRequestStatus(requestId, {
        status: newStatus,
        decidedBy: actor.id,
        decisionComment: comment || null,
    });

    await insertLedgerEntry({
        userId: request.employee_id,
        leaveTypeId: request.leave_type_id,
        year,
        leaveRequestId: requestId,
        pendingDelta,
        takenDelta,
        reason: LEDGER_REASON_BY_ACTION[action],
    });

    await insertAuditLog({
        leaveRequestId: requestId,
        actorId: actor.id,
        actedFor,
        action,
        oldStatus: request.status,
        newStatus,
        comment: comment || null,
    });

    return findLeaveRequestById(requestId);
}
