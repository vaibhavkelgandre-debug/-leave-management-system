// Multer config for the leave-request document field. Memory storage only —
// the file buffer goes straight to Cloudinary (cloudinaryService.js) and is
// never written to disk. Real type checking happens later against the file's
// content (fileType.js), not here, so this middleware only enforces size.
import multer from "multer";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const uploadLeaveRequestDocument = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single("document");

// Same shape as uploadLeaveRequestDocument, for the two profile-onboarding
// documents (Module 5 v2, employeeDocumentService.js).
export const uploadEmployeeDocument = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single("file");
