-- Module 5 v2: the two documents an employee must upload before their
-- profile can be submitted for HR verification. Same Cloudinary-metadata-
-- only shape as leave_request_documents (017) — the file itself lives in
-- Cloudinary as a private `type: authenticated` asset, never a stored URL.
-- Unlike leave_request_documents (one per leave request, immutable),
-- re-uploading here REPLACES the existing row for that document type
-- (ON CONFLICT in employeeDocumentRepository.js) — a rejected document
-- needs to be fixable without HR deleting anything by hand.
CREATE TABLE IF NOT EXISTS employee_documents (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    employee_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    document_type VARCHAR(30) NOT NULL
        CHECK (document_type IN ('SALARY_SLIPS_LAST_3_MONTHS', 'EXPERIENCE_RELIEVING_LETTER')),

    cloudinary_public_id VARCHAR(255) NOT NULL,
    cloudinary_resource_type VARCHAR(20) NOT NULL
        CHECK (cloudinary_resource_type IN ('image', 'raw')),
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK (status IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_comment TEXT,

    uploaded_by UUID NOT NULL REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_employee_documents_employee_type UNIQUE (employee_id, document_type)

);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON employee_documents (employee_id);
