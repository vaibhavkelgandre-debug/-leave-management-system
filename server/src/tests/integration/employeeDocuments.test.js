// Module 5 v2: the three identity/bank documents an employee uploads before
// their profile can be submitted for verification. Cloudinary itself is
// mocked (same pattern as leaveRequestDocuments.test.js) — these tests
// exercise the real DB and the real visibility/review rules.
import request from "supertest";
import { Readable } from "node:stream";
import { vi, describe, it, expect } from "vitest";
import app from "../../app.js";
import { createRootHr, createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";
import * as cloudinaryService from "../../services/cloudinaryService.js";

vi.mock("../../services/cloudinaryService.js", () => ({
    uploadLeaveRequestDocument: vi.fn(),
    uploadEmployeeDocument: vi.fn().mockResolvedValue({ publicId: "mock-public-id", resourceType: "raw" }),
    getSignedDocumentUrl: vi.fn().mockReturnValue("https://res.cloudinary.com/mock/signed-url"),
    fetchDocumentStream: vi.fn(),
    deletePrivateAsset: vi.fn(),
}));

const PDF_BYTES = Buffer.from("%PDF-1.4\n%mock pdf content for tests");
const NOT_A_REAL_FILE_BYTES = Buffer.from("just some plain text, not a real document");

describe("Employee documents", () => {
    it("requires authentication", async () => {
        expect((await request(app).get("/api/employees/me/documents")).statusCode).toBe(401);
    });

    it("rejects a file whose real content isn't PDF/JPG/PNG", async () => {
        const employee = await createUser({ email: "empdoc-badtype@example.com" });
        const agent = await loginAs(employee);

        const response = await agent
            .post("/api/employees/me/documents/AADHAR_CARD")
            .attach("file", NOT_A_REAL_FILE_BYTES, { filename: "letter.pdf", contentType: "application/pdf" });

        expect(response.statusCode).toBe(400);
    });

    it("uploads a document, replacing a prior upload of the same type", async () => {
        const employee = await createUser({ email: "empdoc-upload@example.com" });
        const agent = await loginAs(employee);

        const first = await agent
            .post("/api/employees/me/documents/AADHAR_CARD")
            .attach("file", PDF_BYTES, { filename: "letter-v1.pdf", contentType: "application/pdf" });
        expect(first.statusCode).toBe(200);
        expect(first.body.data.status).toBe("PENDING_REVIEW");

        const second = await agent
            .post("/api/employees/me/documents/AADHAR_CARD")
            .attach("file", PDF_BYTES, { filename: "letter-v2.pdf", contentType: "application/pdf" });
        expect(second.statusCode).toBe(200);
        expect(second.body.data.original_filename).toBe("letter-v2.pdf");

        const list = await agent.get("/api/employees/me/documents");
        expect(list.body.data).toHaveLength(1);
    });

    it("is visible to the employee and to HR within their subtree, never to a peer employee", async () => {
        const hr = await createRootHr({ email: "empdoc-vis-hr@example.com" });
        const employee = await createUser({ email: "empdoc-vis-emp@example.com", managerId: hr.id });
        const outsider = await createUser({ email: "empdoc-vis-outsider@example.com" });
        const agent = await loginAs(employee);

        await agent
            .post("/api/employees/me/documents/PAN_CARD")
            .attach("file", PDF_BYTES, { filename: "slips.pdf", contentType: "application/pdf" });

        const hrAgent = await loginAs(hr);
        const hrList = await hrAgent.get(`/api/employees/${employee.id}/documents`);
        expect(hrList.statusCode).toBe(200);
        expect(hrList.body.data).toHaveLength(1);

        const hrUrl = await hrAgent.get(`/api/employees/${employee.id}/documents/PAN_CARD/url`);
        expect(hrUrl.statusCode).toBe(200);
        expect(hrUrl.body.data.url).toBe("https://res.cloudinary.com/mock/signed-url");

        const selfUrl = await agent.get("/api/employees/me/documents/PAN_CARD/url");
        expect(selfUrl.statusCode).toBe(200);
        expect(selfUrl.body.data.url).toBe("https://res.cloudinary.com/mock/signed-url");

        const outsiderAgent = await loginAs(outsider);
        expect((await outsiderAgent.get(`/api/employees/${employee.id}/documents`)).statusCode).toBe(404);
    });

    // The bytes are served by this app, not Cloudinary: PDFs are stored as
    // Cloudinary `raw` assets, whose delivery forces `Content-Disposition:
    // attachment`, so HR clicking "View" on a PDF downloaded it instead of
    // showing it. Previewing is only possible from a response we control —
    // hence this endpoint, and hence `inline` being its default.
    it("streams a document inline by default so it can actually be previewed", async () => {
        const hr = await createRootHr({ email: "empdoc-file-hr@example.com" });
        const employee = await createUser({ email: "empdoc-file-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent
            .post("/api/employees/me/documents/PAN_CARD")
            .attach("file", PDF_BYTES, { filename: "pan card.pdf", contentType: "application/pdf" });
        const documentId = (await agent.get("/api/employees/me/documents")).body.data[0].id;

        cloudinaryService.fetchDocumentStream.mockResolvedValue(Readable.from([PDF_BYTES]));
        const hrAgent = await loginAs(hr);
        const response = await hrAgent.get(`/api/employees/documents/${documentId}/file`);

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toBe("application/pdf");
        expect(response.headers["content-disposition"]).toMatch(/^inline;/);
        expect(response.headers["content-disposition"]).toContain('filename="pan card.pdf"');
        expect(response.body).toEqual(PDF_BYTES);

        // `attachment` stays available for a real save-to-disk.
        cloudinaryService.fetchDocumentStream.mockResolvedValue(Readable.from([PDF_BYTES]));
        const download = await hrAgent.get(`/api/employees/documents/${documentId}/file?disposition=attachment`);
        expect(download.headers["content-disposition"]).toMatch(/^attachment;/);

        // The `/url` payload carries the id the viewer needs to build that
        // request in the first place.
        const urlResponse = await hrAgent.get(`/api/employees/${employee.id}/documents/PAN_CARD/url`);
        expect(urlResponse.body.data.documentId).toBe(documentId);
    });

    it("404s a document stream for a peer employee, and 422s a malformed id", async () => {
        const hr = await createRootHr({ email: "empdoc-file-authz-hr@example.com" });
        const employee = await createUser({ email: "empdoc-file-authz-emp@example.com", managerId: hr.id });
        const outsider = await createUser({ email: "empdoc-file-authz-outsider@example.com" });
        const agent = await loginAs(employee);

        await agent
            .post("/api/employees/me/documents/PAN_CARD")
            .attach("file", PDF_BYTES, { filename: "pan.pdf", contentType: "application/pdf" });
        const documentId = (await agent.get("/api/employees/me/documents")).body.data[0].id;

        const outsiderAgent = await loginAs(outsider);
        expect((await outsiderAgent.get(`/api/employees/documents/${documentId}/file`)).statusCode).toBe(404);
        expect((await request(app).get(`/api/employees/documents/${documentId}/file`)).statusCode).toBe(401);
        expect((await agent.get("/api/employees/documents/not-a-uuid/file")).statusCode).toBe(422);
        // A disposition outside the two real values can't reach the header.
        expect(
            (await agent.get(`/api/employees/documents/${documentId}/file?disposition=whatever`)).statusCode
        ).toBe(422);
    });

    it("404s a self URL lookup for a document that was never uploaded", async () => {
        const employee = await createUser({ email: "empdoc-no-doc@example.com" });
        const agent = await loginAs(employee);

        expect((await agent.get("/api/employees/me/documents/PAN_CARD/url")).statusCode).toBe(404);
    });

    it("lets HR verify or reject a document, and rejects review from a non-HR caller", async () => {
        const hr = await createRootHr({ email: "empdoc-review-hr@example.com" });
        const employee = await createUser({ email: "empdoc-review-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent
            .post("/api/employees/me/documents/AADHAR_CARD")
            .attach("file", PDF_BYTES, { filename: "letter.pdf", contentType: "application/pdf" });

        expect(
            (
                await agent
                    .post(`/api/employees/${employee.id}/documents/AADHAR_CARD/review`)
                    .send({ status: "VERIFIED" })
            ).statusCode
        ).toBe(403);

        const hrAgent = await loginAs(hr);
        const reviewResponse = await hrAgent
            .post(`/api/employees/${employee.id}/documents/AADHAR_CARD/review`)
            .send({ status: "REJECTED", comment: "Please upload a signed copy" });

        expect(reviewResponse.statusCode).toBe(200);
        expect(reviewResponse.body.data.status).toBe("REJECTED");
        expect(reviewResponse.body.data.review_comment).toBe("Please upload a signed copy");
    });
});

describe("Custom employee documents", () => {
    it("lets an employee add any number of custom-named documents, alongside the required ones", async () => {
        const employee = await createUser({ email: "empdoc-custom-many@example.com" });
        const agent = await loginAs(employee);

        await agent
            .post("/api/employees/me/documents/PAN_CARD")
            .attach("file", PDF_BYTES, { filename: "pan.pdf", contentType: "application/pdf" });

        const first = await agent
            .post("/api/employees/me/documents/custom")
            .field("name", "Degree certificate")
            .attach("file", PDF_BYTES, { filename: "degree.pdf", contentType: "application/pdf" });
        expect(first.statusCode).toBe(200);
        expect(first.body.data.document_type).toBe("OTHER");
        expect(first.body.data.document_name).toBe("Degree certificate");

        const second = await agent
            .post("/api/employees/me/documents/custom")
            .field("name", "Offer letter")
            .attach("file", PDF_BYTES, { filename: "offer.pdf", contentType: "application/pdf" });
        expect(second.statusCode).toBe(200);

        const list = await agent.get("/api/employees/me/documents");
        expect(list.body.data).toHaveLength(3);
        expect(list.body.data.filter((d) => d.document_type === "OTHER")).toHaveLength(2);
    });

    it("rejects a custom upload with no name", async () => {
        const employee = await createUser({ email: "empdoc-custom-noname@example.com" });
        const agent = await loginAs(employee);

        const response = await agent
            .post("/api/employees/me/documents/custom")
            .attach("file", PDF_BYTES, { filename: "degree.pdf", contentType: "application/pdf" });

        expect(response.statusCode).toBe(422);
    });

    it("lets an employee view and then remove their own custom document", async () => {
        const employee = await createUser({ email: "empdoc-custom-remove@example.com" });
        const agent = await loginAs(employee);

        const uploaded = await agent
            .post("/api/employees/me/documents/custom")
            .field("name", "Degree certificate")
            .attach("file", PDF_BYTES, { filename: "degree.pdf", contentType: "application/pdf" });
        const documentId = uploaded.body.data.id;

        const urlResponse = await agent.get(`/api/employees/me/documents/custom/${documentId}/url`);
        expect(urlResponse.statusCode).toBe(200);
        expect(urlResponse.body.data.url).toBe("https://res.cloudinary.com/mock/signed-url");

        const deleteResponse = await agent.delete(`/api/employees/me/documents/custom/${documentId}`);
        expect(deleteResponse.statusCode).toBe(200);

        const list = await agent.get("/api/employees/me/documents");
        expect(list.body.data).toHaveLength(0);
    });

    it("never lets one employee delete another's custom document", async () => {
        const employee = await createUser({ email: "empdoc-custom-owner@example.com" });
        const outsider = await createUser({ email: "empdoc-custom-outsider@example.com" });
        const agent = await loginAs(employee);
        const outsiderAgent = await loginAs(outsider);

        const uploaded = await agent
            .post("/api/employees/me/documents/custom")
            .field("name", "Degree certificate")
            .attach("file", PDF_BYTES, { filename: "degree.pdf", contentType: "application/pdf" });
        const documentId = uploaded.body.data.id;

        expect((await outsiderAgent.delete(`/api/employees/me/documents/custom/${documentId}`)).statusCode).toBe(404);

        const list = await agent.get("/api/employees/me/documents");
        expect(list.body.data).toHaveLength(1);
    });
});
