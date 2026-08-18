// Request-shape validation for the employee-onboarding admin actions
// (Module 5 v2): document upload/review and profile verification.
import { z } from "zod";
import { REQUIRED_DOCUMENT_TYPES } from "../services/employeeDocumentService.js";

export const employeeIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
});

export const documentTypeParamSchema = z.object({
    documentType: z.enum(REQUIRED_DOCUMENT_TYPES),
});

export const employeeDocumentParamsSchema = z.object({
    id: z.string().uuid("id must be a valid id"),
    documentType: z.enum(REQUIRED_DOCUMENT_TYPES),
});

export const documentReviewSchema = z.object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    comment: z.string().trim().optional(),
});

// Unlike a document rejection's optional comment above, sending back a
// whole profile always requires an explanation — the employee can't fix
// "misleading info" without knowing which info, or why it didn't match
// their documents.
export const sendProfileBackSchema = z.object({
    reason: z.string().trim().min(1, "reason is required").max(1000),
});

// A custom (OTHER) document — user-supplied label, arriving as a multipart
// text field alongside the file.
export const customDocumentUploadSchema = z.object({
    name: z.string().trim().min(1, "name is required").max(100),
});

export const documentIdParamSchema = z.object({
    documentId: z.string().uuid("documentId must be a valid id"),
});

// HR-entered salary structure — all figures required (default to 0 rather
// than omitting, since a structure is meant to be the complete picture used
// for payroll, not a partial update like the self-service profile fields).
export const salaryStructureSchema = z.object({
    basicSalary: z.coerce.number().min(0),
    hra: z.coerce.number().min(0).optional().default(0),
    pfEmployeeContribution: z.coerce.number().min(0).optional().default(0),
    pfEmployerContribution: z.coerce.number().min(0).optional().default(0),
    esic: z.coerce.number().min(0).optional().default(0),
    specialAllowance: z.coerce.number().min(0).optional().default(0),
    incomeTax: z.coerce.number().min(0).optional().default(0),
});
