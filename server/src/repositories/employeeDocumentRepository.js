// Pure parameterized SQL for employee_documents — no business rules here
// (which document types are required, who's allowed to view/review one,
// both live in employeeDocumentService.js), only queries.
import pool from "../config/db.js";

const COLUMNS = `id, employee_id, document_type, document_name, cloudinary_public_id, cloudinary_resource_type,
    original_filename, mime_type, file_size_bytes, status, reviewed_by, reviewed_at, review_comment,
    uploaded_by, created_at, updated_at`;

// Re-uploading the same document_type for the same employee REPLACES the
// existing row (unlike leave_request_documents, which is immutable) — a
// rejected document needs to be fixable without HR deleting anything by
// hand. A replace always resets status back to PENDING_REVIEW. Only for the
// required types — `document_type != 'OTHER'` in the ON CONFLICT
// clause has to repeat the partial index's own predicate (028) verbatim,
// since Postgres only infers a partial unique index as the conflict target
// when the WHERE clause matches exactly.
export async function upsertEmployeeDocument({
    employeeId,
    documentType,
    cloudinaryPublicId,
    cloudinaryResourceType,
    originalFilename,
    mimeType,
    fileSizeBytes,
    uploadedBy,
}) {
    const result = await pool.query(
        `INSERT INTO employee_documents
            (employee_id, document_type, cloudinary_public_id, cloudinary_resource_type, original_filename, mime_type, file_size_bytes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (employee_id, document_type) WHERE document_type != 'OTHER' DO UPDATE SET
            cloudinary_public_id = EXCLUDED.cloudinary_public_id,
            cloudinary_resource_type = EXCLUDED.cloudinary_resource_type,
            original_filename = EXCLUDED.original_filename,
            mime_type = EXCLUDED.mime_type,
            file_size_bytes = EXCLUDED.file_size_bytes,
            uploaded_by = EXCLUDED.uploaded_by,
            status = 'PENDING_REVIEW',
            reviewed_by = NULL,
            reviewed_at = NULL,
            review_comment = NULL,
            updated_at = CURRENT_TIMESTAMP
         RETURNING ${COLUMNS}`,
        [employeeId, documentType, cloudinaryPublicId, cloudinaryResourceType, originalFilename, mimeType, fileSizeBytes, uploadedBy]
    );
    return result.rows[0];
}

// A custom ('OTHER') document is always a fresh row — any number may exist
// per employee, distinguished by id rather than document_type, so there's
// nothing to conflict/replace here.
export async function insertCustomDocument({
    employeeId,
    documentName,
    cloudinaryPublicId,
    cloudinaryResourceType,
    originalFilename,
    mimeType,
    fileSizeBytes,
    uploadedBy,
}) {
    const result = await pool.query(
        `INSERT INTO employee_documents
            (employee_id, document_type, document_name, cloudinary_public_id, cloudinary_resource_type, original_filename, mime_type, file_size_bytes, uploaded_by)
         VALUES ($1, 'OTHER', $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLUMNS}`,
        [employeeId, documentName, cloudinaryPublicId, cloudinaryResourceType, originalFilename, mimeType, fileSizeBytes, uploadedBy]
    );
    return result.rows[0];
}

export async function findDocumentsByEmployeeId(employeeId) {
    const result = await pool.query(`SELECT ${COLUMNS} FROM employee_documents WHERE employee_id = $1`, [employeeId]);
    return result.rows;
}

export async function findDocumentByEmployeeAndType(employeeId, documentType) {
    const result = await pool.query(
        `SELECT ${COLUMNS} FROM employee_documents WHERE employee_id = $1 AND document_type = $2`,
        [employeeId, documentType]
    );
    return result.rows[0] || null;
}

export async function findDocumentById(id) {
    const result = await pool.query(`SELECT ${COLUMNS} FROM employee_documents WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

export async function updateDocumentReview(id, { status, reviewedBy, reviewComment = null }) {
    const result = await pool.query(
        `UPDATE employee_documents
         SET status = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP, review_comment = $4
         WHERE id = $1
         RETURNING ${COLUMNS}`,
        [id, status, reviewedBy, reviewComment]
    );
    return result.rows[0] || null;
}

// Scoped to `employeeId` and `document_type = 'OTHER'` so this can never be
// used to delete one of the required documents, even if a caller
// passed the wrong id by mistake.
export async function deleteCustomDocumentById(id, employeeId) {
    const result = await pool.query(
        `DELETE FROM employee_documents
         WHERE id = $1 AND employee_id = $2 AND document_type = 'OTHER'
         RETURNING id`,
        [id, employeeId]
    );
    return result.rows[0] || null;
}
