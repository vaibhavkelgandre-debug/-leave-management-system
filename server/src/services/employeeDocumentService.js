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
import {
    uploadEmployeeDocument,
    getSignedDocumentUrl,
    deletePrivateAsset,
    fetchDocumentStream,
} from "./cloudinaryService.js";
import { detectFileType } from "../utils/fileType.js";
import { badRequest, forbidden, notFound } from "../utils/appError.js";

export const REQUIRED_DOCUMENT_TYPES = ["PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "OFFER_LETTER"];

const ACCEPTED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

// Human names for the four required types, needed because the profile
// verification gates below report *which* documents are blocking — an error
// reading "PAN_CARD is still pending" would be the enum leaking into a
// message HR reads. The client has its own copy for its list UI
// (EmployeeDocumentList.jsx); this one exists for error messages, which are
// composed server-side.
const DOCUMENT_TYPE_LABELS = {
    PAN_CARD: "PAN card",
    AADHAR_CARD: "Aadhar card",
    BANK_PASSBOOK: "Bank passbook",
    OFFER_LETTER: "Signed offer letter",
};

function labelList(documentTypes) {
    return documentTypes.map((type) => DOCUMENT_TYPE_LABELS[type] ?? type).join(", ");
}

// Groups an employee's required documents by what's blocking verification.
// Custom ('OTHER') documents are deliberately excluded from every bucket:
// they're optional extras, never part of the verification gate.
async function categorizeRequiredDocuments(employeeId) {
    const documents = await findDocumentsByEmployeeId(employeeId);
    const byType = new Map(
        documents.filter((document) => document.document_type !== "OTHER").map((document) => [document.document_type, document])
    );

    return {
        missing: REQUIRED_DOCUMENT_TYPES.filter((type) => !byType.has(type)),
        rejected: REQUIRED_DOCUMENT_TYPES.filter((type) => byType.get(type)?.status === "REJECTED"),
        pending: REQUIRED_DOCUMENT_TYPES.filter((type) => byType.get(type)?.status === "PENDING_REVIEW"),
    };
}

// Input: the employee whose profile HR is trying to verify. Output: nothing.
// Failure mode: 400 naming the documents that are in the way.
//
// Verifying the *profile* used to check only the profile's own status, so a
// document could sit unreviewed — or outright rejected — while the profile
// it belongs to was marked VERIFIED, which is the one outcome this whole
// review step exists to prevent. Every required document must be VERIFIED
// individually first; that's the gate, not a warning.
//
// Rejections are reported before pending ones because they need a different
// action from HR: a pending document is theirs to review right now, while a
// rejected one can only be fixed by the employee re-uploading, which means
// sending the profile back (userService.sendProfileBack) rather than
// clicking Verify again.
export async function assertRequiredDocumentsVerified(employeeId) {
    const { missing, rejected, pending } = await categorizeRequiredDocuments(employeeId);

    if (rejected.length > 0) {
        const wasWere = rejected.length === 1 ? "was" : "were";
        throw badRequest(
            `${labelList(rejected)} ${wasWere} rejected as not matching the details provided. Send the profile back so the employee can re-upload, then verify once the new copy checks out.`
        );
    }

    if (missing.length > 0) {
        throw badRequest(`These documents haven't been uploaded yet: ${labelList(missing)}.`);
    }

    if (pending.length > 0) {
        throw badRequest(
            `Review every document before verifying the profile — still pending: ${labelList(pending)}.`
        );
    }
}

// Input: the employee resubmitting their own profile. Output: nothing.
// Failure mode: 400 naming the documents they still have to replace.
//
// The other half of the loop above: once HR sends a profile back over a
// rejected document, resubmitting without replacing that document would
// land HR right back on the same blocked Verify button. A re-upload resets
// the row to PENDING_REVIEW (upsertEmployeeDocument), so "replaced" and
// "no longer rejected" are the same condition.
export async function assertNoRejectedDocuments(employeeId) {
    const { rejected } = await categorizeRequiredDocuments(employeeId);

    if (rejected.length > 0) {
        const it = rejected.length === 1 ? "it" : "them";
        throw badRequest(
            `Replace the rejected document${rejected.length === 1 ? "" : "s"} before resubmitting — HR couldn't match ${it} to your details: ${labelList(rejected)}.`
        );
    }
}

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

    // `documentId` is what lets a caller ask for the bytes through this app
    // instead of the Cloudinary URL (see getDocumentFile) — needed by the
    // viewer, which can only preview a PDF via the proxy. Returned alongside
    // the signed URL rather than replacing it: the URL is still the cheaper
    // path for an image, and dropping it would break every existing caller.
    return {
        documentId: document.id,
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
        documentId: document.id,
        url: getSignedDocumentUrl(document.cloudinary_public_id, document.cloudinary_resource_type),
        filename: document.original_filename,
        mimeType: document.mime_type,
    };
}

// Input: the actor and a document row id (required or custom — both live in
// employee_documents, so one lookup covers all of them). Output:
// `{ stream, filename, mimeType }` — the document's bytes proxied through
// this app rather than handed to the browser as a Cloudinary URL. Failure
// modes: 404 if the document doesn't exist or the actor can't view its
// owner's documents; rejects if Cloudinary's own fetch fails.
//
// This exists because a Cloudinary URL can't be previewed. PDFs are stored
// as `resource_type: "raw"` (uploadPrivateAsset) and raw delivery serves
// them as an attachment, so pointing an <iframe> at the signed URL made the
// browser download the file the instant HR opened the viewer — with no way
// to just *look* at it, which is exactly what reviewing a document is. Since
// the disposition is the delivering server's to set, the only fix is to
// deliver it ourselves: same-origin, correct `Content-Type`, and whichever
// `Content-Disposition` the caller asked for (employeeController).
//
// Two things fall out of proxying that are worth keeping: the signed URL
// never reaches the DOM, and the five-minute expiry stops mattering to a
// viewer left open (each request mints a fresh one).
export async function getDocumentFile(actor, documentId) {
    const document = await findDocumentById(documentId);
    if (!document) {
        throw notFound("Document not found");
    }
    await assertCanView(actor, document.employee_id);

    const url = getSignedDocumentUrl(document.cloudinary_public_id, document.cloudinary_resource_type);
    const stream = await fetchDocumentStream(url);
    return { stream, filename: document.original_filename, mimeType: document.mime_type };
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
