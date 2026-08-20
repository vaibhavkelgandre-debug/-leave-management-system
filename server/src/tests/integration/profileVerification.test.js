// Module 5 v2: the onboarding state machine — INCOMPLETE -> SUBMITTED ->
// VERIFIED (or back to INCOMPLETE via HR's send-back).
import { vi, describe, it, expect } from "vitest";
import { createRootHr, createUser, verifyAllEmployeeDocuments } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";
import { REQUIRED_DOCUMENT_TYPES } from "../../services/employeeDocumentService.js";

vi.mock("../../services/cloudinaryService.js", () => ({
    uploadLeaveRequestDocument: vi.fn(),
    uploadEmployeeDocument: vi.fn().mockResolvedValue({ publicId: "mock-public-id", resourceType: "raw" }),
    getSignedDocumentUrl: vi.fn().mockReturnValue("https://res.cloudinary.com/mock/signed-url"),
    fetchDocumentStream: vi.fn(),
}));

const PDF_BYTES = Buffer.from("%PDF-1.4\n%mock pdf content for tests");

const COMPLETE_PROFILE_BODY = {
    phone: "9876543210",
    currentAddress: "1 Example Street",
    permanentAddress: "1 Example Street",
    panNumber: "ABCDE1234F",
    aadharNumber: "123456789012",
    bankAccountNumber: "000111222333",
    bankIfscCode: "HDFC0001234",
    bankName: "HDFC Bank",
    emergencyContact1Phone: "9998887777",
    emergencyContact1Relationship: "Father",
};

async function uploadRequiredDocuments(agent) {
    for (const documentType of REQUIRED_DOCUMENT_TYPES) {
        await agent
            .post(`/api/employees/me/documents/${documentType}`)
            .attach("file", PDF_BYTES, { filename: `${documentType}.pdf`, contentType: "application/pdf" });
    }
}

describe("Profile verification workflow", () => {
    it("rejects submission when required fields are missing", async () => {
        const employee = await createUser({ email: "verify-missing-fields@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.post("/api/employees/me/profile/submit");
        expect(response.statusCode).toBe(400);
    });

    it("rejects submission when required documents are missing", async () => {
        const employee = await createUser({ email: "verify-missing-docs@example.com" });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        const response = await agent.post("/api/employees/me/profile/submit");

        expect(response.statusCode).toBe(400);
    });

    it("moves INCOMPLETE -> SUBMITTED -> VERIFIED, and HR sees it in the queue only while SUBMITTED", async () => {
        const hr = await createRootHr({ email: "verify-flow-hr@example.com" });
        const employee = await createUser({ email: "verify-flow-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);

        const submitResponse = await agent.post("/api/employees/me/profile/submit");
        expect(submitResponse.statusCode).toBe(200);
        expect(submitResponse.body.data.profile_status).toBe("SUBMITTED");

        const hrAgent = await loginAs(hr);
        const queueBefore = await hrAgent.get("/api/employees/pending-verification");
        expect(queueBefore.body.data.map((u) => u.id)).toContain(employee.id);

        // Every document has to be individually verified before the profile
        // can be — see the two "refuses to verify" cases below.
        await verifyAllEmployeeDocuments(employee.id, hr.id);
        const verifyResponse = await hrAgent.post(`/api/employees/${employee.id}/verify`);
        expect(verifyResponse.statusCode).toBe(200);
        expect(verifyResponse.body.data.profile_status).toBe("VERIFIED");

        const queueAfter = await hrAgent.get("/api/employees/pending-verification");
        expect(queueAfter.body.data.map((u) => u.id)).not.toContain(employee.id);
    });

    it("lets HR send a SUBMITTED profile back to INCOMPLETE with a required reason, visible to the employee", async () => {
        const hr = await createRootHr({ email: "verify-sendback-hr@example.com" });
        const employee = await createUser({ email: "verify-sendback-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        const hrAgent = await loginAs(hr);
        const sendBackResponse = await hrAgent
            .post(`/api/employees/${employee.id}/send-back`)
            .send({ reason: "PAN number doesn't match the uploaded PAN card" });
        expect(sendBackResponse.statusCode).toBe(200);
        expect(sendBackResponse.body.data.profile_status).toBe("INCOMPLETE");
        expect(sendBackResponse.body.data.profile_send_back_reason).toBe(
            "PAN number doesn't match the uploaded PAN card"
        );

        const meResponse = await agent.get("/api/auth/me");
        expect(meResponse.body.data.user.profile_status).toBe("INCOMPLETE");
        expect(meResponse.body.data.user.profile_send_back_reason).toBe(
            "PAN number doesn't match the uploaded PAN card"
        );
    });

    it("rejects sending a profile back without a reason", async () => {
        const hr = await createRootHr({ email: "verify-sendback-noreason-hr@example.com" });
        const employee = await createUser({ email: "verify-sendback-noreason-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.post(`/api/employees/${employee.id}/send-back`).send({});
        expect(response.statusCode).toBe(422);
    });

    it("clears the send-back reason once the employee resubmits", async () => {
        const hr = await createRootHr({ email: "verify-sendback-clear-hr@example.com" });
        const employee = await createUser({ email: "verify-sendback-clear-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        const hrAgent = await loginAs(hr);
        await hrAgent.post(`/api/employees/${employee.id}/send-back`).send({ reason: "Fix your bank details" });

        const resubmitResponse = await agent.post("/api/employees/me/profile/submit");
        expect(resubmitResponse.statusCode).toBe(200);
        expect(resubmitResponse.body.data.profile_send_back_reason).toBeNull();
    });

    // The gate that makes the per-document review mean something: without
    // it, HR could mark a profile VERIFIED while its documents sat unread —
    // or rejected — which is the one outcome the review step exists to stop.
    it("refuses to verify a profile while any document is still pending review", async () => {
        const hr = await createRootHr({ email: "verify-pending-docs-hr@example.com" });
        const employee = await createUser({ email: "verify-pending-docs-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        const hrAgent = await loginAs(hr);
        // Three of four reviewed — the missed one is exactly the mistake this
        // guards against.
        for (const documentType of REQUIRED_DOCUMENT_TYPES.slice(0, 3)) {
            await hrAgent
                .post(`/api/employees/${employee.id}/documents/${documentType}/review`)
                .send({ status: "VERIFIED" });
        }

        const response = await hrAgent.post(`/api/employees/${employee.id}/verify`);

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toMatch(/still pending/i);
        expect(response.body.message).toMatch(/Signed offer letter/);
        // Still SUBMITTED, still in the queue — nothing moved.
        const queue = await hrAgent.get("/api/employees/pending-verification");
        expect(queue.body.data.map((u) => u.id)).toContain(employee.id);
    });

    it("refuses to verify a profile with a rejected document, and points HR at sending it back", async () => {
        const hr = await createRootHr({ email: "verify-rejected-doc-hr@example.com" });
        const employee = await createUser({ email: "verify-rejected-doc-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        const hrAgent = await loginAs(hr);
        await verifyAllEmployeeDocuments(employee.id, hr.id);
        await hrAgent
            .post(`/api/employees/${employee.id}/documents/PAN_CARD/review`)
            .send({ status: "REJECTED", comment: "Number doesn't match the profile" });

        const response = await hrAgent.post(`/api/employees/${employee.id}/verify`);

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toMatch(/PAN card/);
        expect(response.body.message).toMatch(/send the profile back/i);
    });

    // The other half of that loop: a send-back the employee "fixes" by
    // resubmitting the same rejected document just hands HR the same blocked
    // Verify button back.
    it("blocks resubmission until a rejected document is actually replaced", async () => {
        const hr = await createRootHr({ email: "resubmit-rejected-hr@example.com" });
        const employee = await createUser({ email: "resubmit-rejected-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        const hrAgent = await loginAs(hr);
        await hrAgent
            .post(`/api/employees/${employee.id}/documents/AADHAR_CARD/review`)
            .send({ status: "REJECTED", comment: "Blurred scan" });
        await hrAgent.post(`/api/employees/${employee.id}/send-back`).send({ reason: "Aadhar scan unreadable" });

        const blocked = await agent.post("/api/employees/me/profile/submit");
        expect(blocked.statusCode).toBe(400);
        expect(blocked.body.message).toMatch(/Aadhar card/);

        // Re-uploading resets that document to PENDING_REVIEW, which is what
        // "replaced" means here — the resubmission then goes through.
        await agent
            .post("/api/employees/me/documents/AADHAR_CARD")
            .attach("file", PDF_BYTES, { filename: "aadhar-v2.pdf", contentType: "application/pdf" });

        const resubmitted = await agent.post("/api/employees/me/profile/submit");
        expect(resubmitted.statusCode).toBe(200);
        expect(resubmitted.body.data.profile_status).toBe("SUBMITTED");

        // And HR can verify it once the replacement is reviewed.
        await verifyAllEmployeeDocuments(employee.id, hr.id);
        expect((await hrAgent.post(`/api/employees/${employee.id}/verify`)).statusCode).toBe(200);
    }, 20000);

    it("rejects verify/send-back from anyone but HR, and 404s for an employee outside HR's subtree", async () => {
        const hr = await createRootHr({ email: "verify-authz-hr@example.com" });
        const outsiderHr = await createRootHr({ email: "verify-authz-outsider-hr@example.com" });
        const employee = await createUser({ email: "verify-authz-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        expect((await agent.post(`/api/employees/${employee.id}/verify`)).statusCode).toBe(403);
        expect(
            (await agent.post(`/api/employees/${employee.id}/send-back`).send({ reason: "test" })).statusCode
        ).toBe(403);

        const outsiderAgent = await loginAs(outsiderHr);
        expect((await outsiderAgent.post(`/api/employees/${employee.id}/verify`)).statusCode).toBe(404);
        expect(
            (await outsiderAgent.post(`/api/employees/${employee.id}/send-back`).send({ reason: "test" })).statusCode
        ).toBe(404);
    });

    it("rejects verifying a profile that's still INCOMPLETE (illegal transition)", async () => {
        const hr = await createRootHr({ email: "verify-illegal-hr@example.com" });
        const employee = await createUser({ email: "verify-illegal-emp@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.post(`/api/employees/${employee.id}/verify`);
        expect(response.statusCode).toBe(409);
    });

    it("lets HR fetch a single employee's full profile for the verification detail page, scoped to their own subtree", async () => {
        const hr = await createRootHr({ email: "verify-detail-hr@example.com" });
        const outsiderHr = await createRootHr({ email: "verify-detail-outsider-hr@example.com" });
        const employee = await createUser({ email: "verify-detail-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);
        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.get(`/api/employees/${employee.id}`);
        expect(response.statusCode).toBe(200);
        expect(response.body.data.id).toBe(employee.id);
        expect(response.body.data.pan_number).toBe("ABCDE1234F");

        expect((await agent.get(`/api/employees/${employee.id}`)).statusCode).toBe(403);

        const outsiderAgent = await loginAs(outsiderHr);
        expect((await outsiderAgent.get(`/api/employees/${employee.id}`)).statusCode).toBe(404);
    });

    it("lists a verified employee under HR's own subtree, but not for an HR admin outside that subtree, and not while still SUBMITTED", async () => {
        const hr = await createRootHr({ email: "verified-list-hr@example.com" });
        const outsiderHr = await createRootHr({ email: "verified-list-outsider-hr@example.com" });
        const employee = await createUser({ email: "verified-list-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        const hrAgent = await loginAs(hr);
        const listWhileSubmitted = await hrAgent.get("/api/employees/verified");
        expect(listWhileSubmitted.body.data.map((u) => u.id)).not.toContain(employee.id);

        await verifyAllEmployeeDocuments(employee.id, hr.id);
        await hrAgent.post(`/api/employees/${employee.id}/verify`);

        const listResponse = await hrAgent.get("/api/employees/verified");
        expect(listResponse.statusCode).toBe(200);
        expect(listResponse.body.data.map((u) => u.id)).toContain(employee.id);

        const outsiderAgent = await loginAs(outsiderHr);
        const outsiderList = await outsiderAgent.get("/api/employees/verified");
        expect(outsiderList.body.data.map((u) => u.id)).not.toContain(employee.id);
    });

    it("rejects listing verified employees for anyone but HR", async () => {
        const hr = await createRootHr({ email: "verified-list-authz-hr@example.com" });
        const employee = await createUser({ email: "verified-list-authz-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        expect((await agent.get("/api/employees/verified")).statusCode).toBe(403);
    });
});
