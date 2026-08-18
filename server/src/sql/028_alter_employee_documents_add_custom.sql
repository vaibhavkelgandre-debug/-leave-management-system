-- Module 5 v2: lets an employee attach additional, self-named documents
-- beyond the three required ones (e.g. a degree certificate) — optional,
-- never required for profile verification. `document_name` holds the
-- user-supplied label for an 'OTHER' row; it's unused (NULL) for the three
-- fixed types, whose label is always derived from `document_type` client-side.
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS document_name VARCHAR(100);

ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_document_type_check;
ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_document_type_check
    CHECK (document_type IN ('PAN_CARD', 'AADHAR_CARD', 'BANK_PASSBOOK', 'OTHER'));

-- The three required types stay capped at one row per employee; 'OTHER' may
-- have any number of rows (a fresh one per custom document added), so the
-- old plain UNIQUE(employee_id, document_type) is replaced with a partial
-- index that excludes 'OTHER' — Postgres has no partial UNIQUE table
-- constraint, only a partial unique index, hence dropping the constraint
-- (which owned an equivalent full index) and adding an index directly.
ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS uq_employee_documents_employee_type;
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_documents_employee_type
    ON employee_documents (employee_id, document_type)
    WHERE document_type != 'OTHER';
