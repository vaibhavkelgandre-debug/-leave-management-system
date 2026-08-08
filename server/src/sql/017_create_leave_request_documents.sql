-- FR-012 (Module 3, point 2): the document attached to a leave request (e.g.
-- a medical certificate) when its leave type requires one. The file itself
-- lives in Cloudinary, never in Postgres — only `cloudinary_public_id` (plus
-- enough metadata to render a filename/size in the UI) is stored here. There
-- is deliberately no stored URL: Cloudinary assets are uploaded as
-- `type: authenticated`, so a viewable URL only ever exists as a short-lived
-- signed link generated on demand, after the same authorization check used
-- for the leave request itself (see leaveRequestService.getLeaveRequestDocument).
CREATE TABLE IF NOT EXISTS leave_request_documents (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- One document per request: a document is immutable once attached (no
    -- replace/delete endpoint, matching the audit-trail append-only
    -- philosophy elsewhere in Module 3) — resubmitting means withdrawing and
    -- creating a new request, not editing this one's attachment.
    leave_request_id UUID NOT NULL UNIQUE
        REFERENCES leave_requests(id)
        ON DELETE CASCADE,

    cloudinary_public_id VARCHAR(255) NOT NULL,

    -- Cloudinary's own classification of the uploaded asset ("image" for
    -- jpg/png, "raw" for pdf) — needed to regenerate a correctly-typed signed
    -- URL later without re-deriving it from the stored mime type.
    cloudinary_resource_type VARCHAR(20) NOT NULL
        CHECK (cloudinary_resource_type IN ('image', 'raw')),

    original_filename VARCHAR(255) NOT NULL,

    mime_type VARCHAR(100) NOT NULL,

    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),

    uploaded_by UUID NOT NULL
        REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- Every lookup is "does this request have a document" keyed off the request.
CREATE INDEX IF NOT EXISTS idx_leave_request_documents_request_id ON leave_request_documents (leave_request_id);
