// Pure parameterized SQL for the leave_request_documents table — no business
// rules here (whether a document is required, and who's allowed to view one,
// both live in leaveRequestService.js), only queries.
import pool from "../config/db.js";

const COLUMNS = `id, leave_request_id, cloudinary_public_id, cloudinary_resource_type,
    original_filename, mime_type, file_size_bytes, uploaded_by, created_at, updated_at`;

// Input: the uploaded document's metadata. Output: the newly created row.
// Failure mode: a Postgres unique_violation (23505) if the request already
// has a document — the DB-level UNIQUE on leave_request_id is the backstop,
// since a document is never replaced once attached.
export async function insertLeaveRequestDocument({
    leaveRequestId,
    cloudinaryPublicId,
    cloudinaryResourceType,
    originalFilename,
    mimeType,
    fileSizeBytes,
    uploadedBy,
}) {
    const result = await pool.query(
        `INSERT INTO leave_request_documents
            (leave_request_id, cloudinary_public_id, cloudinary_resource_type, original_filename, mime_type, file_size_bytes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS}`,
        [leaveRequestId, cloudinaryPublicId, cloudinaryResourceType, originalFilename, mimeType, fileSizeBytes, uploadedBy]
    );
    return result.rows[0];
}

// Input: a leave request id. Output: its document row, or null if none was
// attached (leave types that don't require one commonly have none).
export async function findDocumentByLeaveRequestId(leaveRequestId) {
    const result = await pool.query(`SELECT ${COLUMNS} FROM leave_request_documents WHERE leave_request_id = $1`, [
        leaveRequestId,
    ]);
    return result.rows[0] || null;
}
