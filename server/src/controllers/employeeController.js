// Thin HTTP glue for the employee-onboarding admin actions added in Module 5
// v2: document upload/review, profile verification, and (see
// salaryStructureController.js) salary structures. All business logic lives
// in userService.js / employeeDocumentService.js.
import * as userService from "../services/userService.js";
import * as employeeDocumentService from "../services/employeeDocumentService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function uploadDocument(req, res, next) {
    try {
        const document = await employeeDocumentService.uploadDocument(req.user.id, req.params.documentType, req.file);
        sendSuccess(res, 200, "Document uploaded", document);
    } catch (error) {
        next(error);
    }
}

export async function listMyDocuments(req, res, next) {
    try {
        const documents = await employeeDocumentService.listDocuments(req.user, req.user.id);
        sendSuccess(res, 200, "Documents retrieved", documents);
    } catch (error) {
        next(error);
    }
}

export async function listDocumentsForEmployee(req, res, next) {
    try {
        const documents = await employeeDocumentService.listDocuments(req.user, req.params.id);
        sendSuccess(res, 200, "Documents retrieved", documents);
    } catch (error) {
        next(error);
    }
}

export async function getDocumentUrl(req, res, next) {
    try {
        const document = await employeeDocumentService.getDocumentUrl(req.user, req.params.id, req.params.documentType);
        sendSuccess(res, 200, "Document retrieved", document);
    } catch (error) {
        next(error);
    }
}

// Same lookup as getDocumentUrl, always scoped to the caller's own id — lets
// ProfileDocumentUpload.jsx offer a "View" action without needing to know
// its own employee id (it doesn't receive one as a prop today).
export async function getMyDocumentUrl(req, res, next) {
    try {
        const document = await employeeDocumentService.getDocumentUrl(req.user, req.user.id, req.params.documentType);
        sendSuccess(res, 200, "Document retrieved", document);
    } catch (error) {
        next(error);
    }
}

export async function uploadCustomDocument(req, res, next) {
    try {
        const document = await employeeDocumentService.uploadCustomDocument(req.user.id, req.body.name, req.file);
        sendSuccess(res, 200, "Document uploaded", document);
    } catch (error) {
        next(error);
    }
}

export async function getMyCustomDocumentUrl(req, res, next) {
    try {
        const document = await employeeDocumentService.getDocumentUrlById(req.user, req.user.id, req.params.documentId);
        sendSuccess(res, 200, "Document retrieved", document);
    } catch (error) {
        next(error);
    }
}

export async function deleteCustomDocument(req, res, next) {
    try {
        await employeeDocumentService.deleteCustomDocument(req.user.id, req.params.documentId);
        sendSuccess(res, 200, "Document removed", null);
    } catch (error) {
        next(error);
    }
}

export async function reviewDocument(req, res, next) {
    try {
        const document = await employeeDocumentService.reviewDocument(
            req.user,
            req.params.id,
            req.params.documentType,
            req.body
        );
        sendSuccess(res, 200, "Document reviewed", document);
    } catch (error) {
        next(error);
    }
}

export async function submitProfile(req, res, next) {
    try {
        const user = await userService.submitProfileForVerification(req.user.id);
        sendSuccess(res, 200, "Profile submitted for verification", user);
    } catch (error) {
        next(error);
    }
}

export async function verifyProfile(req, res, next) {
    try {
        const user = await userService.verifyProfile(req.user, req.params.id);
        sendSuccess(res, 200, "Profile verified", user);
    } catch (error) {
        next(error);
    }
}

export async function sendProfileBack(req, res, next) {
    try {
        const user = await userService.sendProfileBack(req.user, req.params.id, req.body.reason);
        sendSuccess(res, 200, "Profile sent back", user);
    } catch (error) {
        next(error);
    }
}

export async function listPendingVerification(req, res, next) {
    try {
        const users = await userService.listPendingVerification(req.user);
        sendSuccess(res, 200, "Pending profiles retrieved", users);
    } catch (error) {
        next(error);
    }
}

export async function getEmployeeForVerification(req, res, next) {
    try {
        const employee = await userService.getEmployeeForVerification(req.user, req.params.id);
        sendSuccess(res, 200, "Employee retrieved", employee);
    } catch (error) {
        next(error);
    }
}

export async function listVerifiedEmployees(req, res, next) {
    try {
        const users = await userService.listVerifiedEmployees(req.user);
        sendSuccess(res, 200, "Verified employees retrieved", users);
    } catch (error) {
        next(error);
    }
}
