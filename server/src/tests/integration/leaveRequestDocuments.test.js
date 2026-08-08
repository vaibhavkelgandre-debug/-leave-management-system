// FR-012 (Module 3, point 2): document upload for leave requests. Cloudinary
// itself is mocked (same pattern as authGoogle.test.js mocking
// google-auth-library) — these tests exercise the real DB and the real
// requires-document/file-type/authorization rules, without spending a real
// Cloudinary account's quota or needing network access to run.
import request from "supertest";
import { vi, describe, it, expect } from "vitest";
import app from "../../app.js";
import { createUser, createLeaveType, createLeaveRequest } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

vi.mock("../../services/cloudinaryService.js", () => ({
    uploadLeaveRequestDocument: vi.fn().mockResolvedValue({ publicId: "mock-public-id", resourceType: "image" }),
    getSignedDocumentUrl: vi.fn().mockReturnValue("https://res.cloudinary.com/mock/signed-url"),
}));

const PDF_BYTES = Buffer.from("%PDF-1.4\n%mock pdf content for tests");
const NOT_A_REAL_FILE_BYTES = Buffer.from("just some plain text, not a real document");

describe("Leave request documents", () => {
    it("rejects submitting a document-required leave type with no file attached", async () => {
        const employee = await createUser({ email: "doc-missing@example.com" });
        const leaveType = await createLeaveType({ name: "Sick Leave Missing Doc", requiresDocument: true });
        const agent = await loginAs(employee);

        const response = await agent.post("/api/leave-requests").send({
            leaveTypeId: leaveType.id,
            startDate: "2030-06-03",
            endDate: "2030-06-04",
            reason: "Feeling unwell",
        });

        expect(response.statusCode).toBe(400);
    });

    it("rejects a file whose real content isn't PDF/JPG/PNG, regardless of its declared name", async () => {
        const employee = await createUser({ email: "doc-badtype@example.com" });
        const leaveType = await createLeaveType({ name: "Sick Leave Bad Type", requiresDocument: true });
        const agent = await loginAs(employee);

        const response = await agent
            .post("/api/leave-requests")
            .field("leaveTypeId", leaveType.id)
            .field("startDate", "2030-06-03")
            .field("endDate", "2030-06-04")
            .field("reason", "Feeling unwell")
            .attach("document", NOT_A_REAL_FILE_BYTES, { filename: "cert.pdf", contentType: "application/pdf" });

        expect(response.statusCode).toBe(400);
    });

    it("accepts a valid PDF and makes it retrievable only to the requester, their manager, and HR", async () => {
        const manager = await createUser({ role: "MANAGER", email: "doc-mgr@example.com" });
        const employee = await createUser({ role: "EMPLOYEE", managerId: manager.id, email: "doc-emp@example.com" });
        const outsider = await createUser({ email: "doc-outsider@example.com" });
        const leaveType = await createLeaveType({ name: "Sick Leave Valid Doc", requiresDocument: true });
        const agent = await loginAs(employee);

        const submitResponse = await agent
            .post("/api/leave-requests")
            .field("leaveTypeId", leaveType.id)
            .field("startDate", "2030-06-10")
            .field("endDate", "2030-06-11")
            .field("reason", "Feeling unwell")
            .attach("document", PDF_BYTES, { filename: "cert.pdf", contentType: "application/pdf" });

        expect(submitResponse.statusCode).toBe(201);
        expect(submitResponse.body.data.has_document).toBe(true);
        const requestId = submitResponse.body.data.id;

        const ownDocResponse = await agent.get(`/api/leave-requests/${requestId}/document`);
        expect(ownDocResponse.statusCode).toBe(200);
        expect(ownDocResponse.body.data).toMatchObject({
            filename: "cert.pdf",
            mimeType: "application/pdf",
            url: "https://res.cloudinary.com/mock/signed-url",
        });

        const managerAgent = await loginAs(manager);
        const managerDocResponse = await managerAgent.get(`/api/leave-requests/${requestId}/document`);
        expect(managerDocResponse.statusCode).toBe(200);

        const outsiderAgent = await loginAs(outsider);
        const outsiderDocResponse = await outsiderAgent.get(`/api/leave-requests/${requestId}/document`);
        expect(outsiderDocResponse.statusCode).toBe(404);
    });

    it("returns 404 for a request that has no document attached", async () => {
        const employee = await createUser({ email: "doc-none@example.com" });
        const leaveType = await createLeaveType({ name: "No Doc Needed Leave", requiresDocument: false });
        const leaveRequest = await createLeaveRequest({
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            startDate: "2030-06-17",
            endDate: "2030-06-18",
        });
        const agent = await loginAs(employee);

        const response = await agent.get(`/api/leave-requests/${leaveRequest.id}/document`);
        expect(response.statusCode).toBe(404);
    });

    it("reports has_document: false on a request with none attached", async () => {
        const employee = await createUser({ email: "doc-flag-false@example.com" });
        const leaveType = await createLeaveType({ name: "Flag False Leave", requiresDocument: false });
        await createLeaveRequest({
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            startDate: "2030-06-24",
            endDate: "2030-06-25",
        });
        const agent = await loginAs(employee);

        const response = await agent.get("/api/leave-requests/mine");
        expect(response.body.data[0].has_document).toBe(false);
    });
});
