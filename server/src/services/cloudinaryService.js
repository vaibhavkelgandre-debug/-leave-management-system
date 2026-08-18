// Cloudinary upload + signed-URL generation for leave-request documents.
// Kept separate from leaveRequestService.js so the business logic there
// never touches the Cloudinary SDK directly.
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import cloudinary from "../config/cloudinary.js";

const LEAVE_REQUEST_DOCUMENTS_FOLDER = "leave-request-documents";
const EMPLOYEE_DOCUMENTS_FOLDER = "employee-documents";
const SIGNED_URL_TTL_SECONDS = 5 * 60;

// Shared by uploadLeaveRequestDocument/uploadEmployeeDocument below — only
// the folder differs between the two document kinds. Uploaded as
// `type: "authenticated"` so the asset is never reachable via a plain
// Cloudinary URL — only through a signed link this app generates after its
// own authorization check (see getSignedDocumentUrl below). Failure mode:
// rejects if Cloudinary's upload fails (network/credentials/quota).
async function uploadPrivateAsset({ buffer, mimeType, folder }) {
    const resourceType = mimeType === "application/pdf" ? "raw" : "image";

    const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: randomUUID(),
                resource_type: resourceType,
                type: "authenticated",
            },
            (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
        );
        uploadStream.end(buffer);
    });

    return { publicId: result.public_id, resourceType: result.resource_type };
}

// Input: a file buffer (from multer's memory storage) and the mime type
// detected from its content. Output: `{ publicId, resourceType }` for the
// stored asset. Deliberately called *before* the leave request row is
// inserted (see submitLeaveRequest in leaveRequestService.js) so a
// Cloudinary failure never leaves a half-created request behind — there's
// nothing to roll back because nothing was written to Postgres yet.
export async function uploadLeaveRequestDocument({ buffer, mimeType }) {
    return uploadPrivateAsset({ buffer, mimeType, folder: LEAVE_REQUEST_DOCUMENTS_FOLDER });
}

// Same shape as uploadLeaveRequestDocument, for the two profile-onboarding
// documents (employeeDocumentService.js) — a different folder, otherwise
// identical private-asset handling.
export async function uploadEmployeeDocument({ buffer, mimeType }) {
    return uploadPrivateAsset({ buffer, mimeType, folder: EMPLOYEE_DOCUMENTS_FOLDER });
}

// Input: the stored `cloudinary_public_id`/`cloudinary_resource_type` for a
// document. Output: nothing — removes the asset from Cloudinary storage.
// Only used when a document row is actually deleted (custom/'OTHER'
// employee documents), unlike every other document flow in this app, which
// never deletes and so never needs this.
export async function deletePrivateAsset(publicId, resourceType) {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: "authenticated" });
}

// Input: the stored `cloudinary_public_id`/`cloudinary_resource_type` for a
// document. Output: a signed URL that expires in five minutes — short-lived
// on purpose, since it's generated fresh on every authorized view/download
// rather than cached, so there's never a long-lived link floating around
// that could be shared beyond the people this app already authorized.
export function getSignedDocumentUrl(publicId, resourceType) {
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    return cloudinary.url(publicId, {
        type: "authenticated",
        resource_type: resourceType,
        sign_url: true,
        secure: true,
        expires_at: expiresAt,
    });
}

// Input: a signed URL from getSignedDocumentUrl. Output: a Node Readable of
// the document's bytes. Used to proxy the file through this app's own
// response instead of handing the Cloudinary URL to the browser directly —
// a plain `<a href>` to a cross-origin URL ignores the `download` attribute
// and just navigates to it, so forcing an actual save-to-disk requires this
// app to set its own Content-Disposition header on a response it controls.
// Failure mode: rejects if Cloudinary's response isn't a successful body
// (e.g. the signed URL expired between minting it and this call).
export async function fetchDocumentStream(url) {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch document from Cloudinary (status ${response.status})`);
    }
    return Readable.fromWeb(response.body);
}
