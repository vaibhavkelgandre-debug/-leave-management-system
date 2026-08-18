-- Module 5 v2: the two required onboarding documents (last 3 months'
-- salary slips, experience/relieving letter) turned out not to be what's
-- actually needed for verification — replaced with proof-of-identity/bank
-- documents that mirror the PAN/Aadhar/bank fields already collected on
-- the profile form (pan_number/aadhar_number/bank_account_number etc.),
-- so the upload sits right next to the fields it's proving.
DELETE FROM employee_documents WHERE document_type NOT IN ('PAN_CARD', 'AADHAR_CARD', 'BANK_PASSBOOK');

ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_document_type_check;
ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_document_type_check
    CHECK (document_type IN ('PAN_CARD', 'AADHAR_CARD', 'BANK_PASSBOOK'));
