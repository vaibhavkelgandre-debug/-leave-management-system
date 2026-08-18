// Module 5 v2: the four identity/bank/offer documents an employee must
// upload before their profile can be submitted for HR verification (see
// profileVerificationStateMachine.js / userService.submitProfileForVerification)
// — proof for the pan_number/aadhar_number/bank_* fields and the joining
// date/compensation already collected on the profile form, not unrelated
// payroll-history paperwork. Visibility
// mirrors the salary-slip rule (self, or HR within their own subtree) — not
// the leave-document rule (requester/approver/HR) — since a manager has no
// business reviewing a report's onboarding paperwork.
import { isInActorsHrScope } from "./hrScopeService.js";
import {
    upsertEmployeeDocument,
    insertCustomDocument,
    findDocumentsByEmployeeId,
    findDocumentByEmployeeAndType,
    findDocumentById,
    updateDocumentReview,
    deleteCustomDocumentById,
} from "../repositories/employeeDocumentRepository.js";
import { uploadEmployeeDocument, getSignedDocumentUrl, deletePrivateAsset } from "./cloudinaryService.js";
import { detectFileType } from "../utils/fileType.js";
import { badRequest, forbidden, notFound } from "../utils/appError.js";

export const REQUIRED_DOCUMENT_TYPES = ["PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "OFFER_LETTER"];

const ACCEPTED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

async function assertCanView(actor, employeeId) {
    if (actor.id === employeeId) return;
    if (await isInActorsHrScope(actor, employeeId)) return;
    throw notFound("Employee not found");
}

// Input: the uploading employee's own id, the document type, and a multer
// in-memory file. Output: the new/replaced document row. Self-upload only —
// there's no "HR uploads on an employee's behalf" path in this flow.
export async function uploadDocument(actorId, documentType, file) {
    if (!REQUIRED_DOCUMENT_TYPES.includes(documentType)) {
        throw badRequest("Unknown document type");
    }
    if (!file) {
        throw badRequest("A file is required");
    }

    // Never trust the client-reported mimetype/extension (NFR-4) — same
    // check leave-request documents already apply.
    const detectedFileType = detectFileType(file.buffer);
    if (!ACCEPTED_DOCUMENT_TYPES.has(detectedFileType)) {
        throw badRequest("Document must be a PDF, JPG or PNG file");
    }

    const uploaded = await uploadEmployeeDocument({ buffer: file.buffer, mimeType: detectedFileType });

    return upsertEmployeeDocument({
        employeeId: actorId,
        documentType,
        cloudinaryPublicId: uploaded.publicId,
        cloudinaryResourceType: uploaded.resourceType,
        originalFilename: file.originalname,
        mimeType: detectedFileType,
        fileSizeBytes: file.size,
        uploadedBy: actorId,
    });
}

// Input: the uploading employee's own id, a user-supplied label, and a
// multer in-memory file. Output: the new document row. Unlike uploadDocument
// above, this always creates a fresh row — any number of custom documents
// may exist per employee (e.g. a degree certificate), never required for
// profile verification (see REQUIRED_DOCUMENT_TYPES).
export async function uploadCustomDocument(actorId, name, file) {
    if (!file) {
        throw badRequest("A file is required");
    }

    const detectedFileType = detectFileType(file.buffer);
    if (!ACCEPTED_DOCUMENT_TYPES.has(detectedFileType)) {
        throw badRequest("Document must be a PDF, JPG or PNG file");
    }

    const uploaded = await uploadEmployeeDocument({ buffer: file.buffer, mimeType: detectedFileType });

    return insertCustomDocument({
        employeeId: actorId,
        documentName: name,
        cloudinaryPublicId: uploaded.publicId,
        cloudinaryResourceType: uploaded.resourceType,
        originalFilename: file.originalname,
        mimeType: detectedFileType,
        fileSizeBytes: file.size,
        uploadedBy: actorId,
    });
}

// Output: every document row (metadata only, no signed URL — minted lazily
// per document via getDocumentUrl below, not upfront for the whole list).
export async function listDocuments(actor, employeeId) {
    await assertCanView(actor, employeeId);
    return findDocumentsByEmployeeId(employeeId);
}

export async function getDocumentUrl(actor, employeeId, documentType) {
    await assertCanView(actor, employeeId);

    const document = await findDocumentByEmployeeAndType(employeeId, documentType);
    if (!document) {
        throw notFound("Document not found");
    }

    return {
        url: getSignedDocumentUrl(document.cloudinary_public_id, document.cloudinary_resource_type),
        filename: document.original_filename,
        mimeType: document.mime_type,
    };
}

// Same as getDocumentUrl, but for a custom document identified by its own
// row id rather than a fixed document_type (there can be more than one
// 'OTHER' row per employee, so type alone doesn't identify a single row).
export async function getDocumentUrlById(actor, employeeId, documentId) {
    await assertCanView(actor, employeeId);

    const document = await findDocumentById(documentId);
    if (!document || document.employee_id !== employeeId) {
        throw notFound("Document not found");
    }

    return {
        url: getSignedDocumentUrl(document.cloudinary_public_id, document.cloudinary_resource_type),
        filename: document.original_filename,
        mimeType: document.mime_type,
    };
}

// Self-only — an employee removing a custom document they added by mistake.
// Scoped to `document_type = 'OTHER'` at the repository layer, so this can
// never touch one of the required documents even given the wrong id.
export async function deleteCustomDocument(actorId, documentId) {
    const document = await findDocumentById(documentId);
    if (!document || document.employee_id !== actorId || document.document_type !== "OTHER") {
        throw notFound("Document not found");
    }

    await deletePrivateAsset(document.cloudinary_public_id, document.cloudinary_resource_type);
    await deleteCustomDocumentById(documentId, actorId);
}

// HR-only, subtree-scoped — marks a specific uploaded document VERIFIED or
// REJECTED. Rejecting doesn't delete anything; the employee re-uploads to
// replace it (see employeeDocumentRepository.upsertEmployeeDocument).
export async function reviewDocument(actor, employeeId, documentType, { status, comment }) {
    if (actor.role !== "HR_ADMIN" && actor.role !== "SUPER_ADMIN") {
        throw forbidden("Only HR can review employee documents");
    }
    if (!(await isInActorsHrScope(actor, employeeId))) {
        throw notFound("Employee not found");
    }

    const document = await findDocumentByEmployeeAndType(employeeId, documentType);
    if (!document) {
        throw notFound("Document not found");
    }

    return updateDocumentReview(document.id, { status, reviewedBy: actor.id, reviewComment: comment ?? null });
}
