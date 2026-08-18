-- Module 5 v2: a 4th required onboarding document — a signed offer letter,
-- which HR uses to verify the joining date and salary/compensation figures
-- the employee entered against what was actually offered. Required
-- alongside PAN_CARD/AADHAR_CARD/BANK_PASSBOOK; the partial unique index
-- from 028 (`WHERE document_type != 'OTHER'`) already covers this new
-- required type without needing its own change — it caps every type except
-- 'OTHER' at one row per employee, whatever those types are.
ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_document_type_check;
ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_document_type_check
    CHECK (document_type IN ('PAN_CARD', 'AADHAR_CARD', 'BANK_PASSBOOK', 'OFFER_LETTER', 'OTHER'));
