// SUPER_ADMIN role (fixes the "who governs the first HR" gap — see
// .claude/rules.md): singleton bootstrap tested in authRegisterHr.test.js.
// This file covers what SUPER_ADMIN can and can't actually do once it
// exists — auto-approve for their own leave (with correct ledger state, the
// thing most likely to silently corrupt data if implemented naively), acting
// as manager/HR for direct-report HR_ADMINs only (never those HR_ADMINs' own
// downstream teams), and the deliberate no-override carve-out.
import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import {
    createSuperAdmin,
    createUser,
    createLeaveType,
    verifyAllEmployeeDocuments,
} from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

const PDF_BYTES = Buffer.from("%PDF-1.4\n%mock pdf content for tests");
const REQUIRED_DOCUMENT_TYPES = ["PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "OFFER_LETTER"];
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

// A guaranteed weekday on/after the given date — working-day calculation
// excludes weekends, and the test DB has no holidays seeded by default.
function firstWeekdayOnOrAfter(dateStr) {
    const d = new Date(dateStr);
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
    }
    return d.toISOString().slice(0, 10);
}

describe("SUPER_ADMIN", () => {
    it("auto-approves its own leave request with correct ledger state, never passing through SUBMITTED", async () => {
        const superAdmin = await createSuperAdmin({ email: "super-leave@example.com" });
        const leaveType = await createLeaveType({ name: "Casual Leave", annualEntitlement: 12 });
        const agent = await loginAs(superAdmin);
        const date = firstWeekdayOnOrAfter("2031-03-04");

        const response = await agent.post("/api/leave-requests").send({
            leaveTypeId: leaveType.id,
            startDate: date,
            endDate: date,
            startHalfDay: false,
            endHalfDay: false,
            reason: "Personal",
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.data.status).toBe("APPROVED");
        expect(response.body.data.decided_by).toBe(superAdmin.id);

        const year = Number(date.slice(0, 4));
        const balances = (await agent.get(`/api/leave-balances/me?year=${year}`)).body.data;
        const balance = balances.find((b) => b.leave_type_id === leaveType.id);
        expect(Number(balance.days_taken)).toBe(1);
        expect(Number(balance.days_pending)).toBe(0);

        const audit = (await agent.get(`/api/leave-requests/${response.body.data.id}/audit`)).body.data;
        expect(audit).toHaveLength(1);
        expect(audit[0].action).toBe("AUTO_APPROVE");
    });

    it("lets a direct-report HR_ADMIN's own leave request go through SUBMITTED and be approved by SUPER_ADMIN as their manager", async () => {
        const superAdmin = await createSuperAdmin({ email: "super-manager@example.com" });
        const hrAdmin = await createUser({ role: "HR_ADMIN", email: "hr-reports-to-super@example.com", managerId: superAdmin.id });
        const leaveType = await createLeaveType({ name: "Sick Leave" });
        const hrAgent = await loginAs(hrAdmin);
        const date = firstWeekdayOnOrAfter("2031-03-11");

        const submitResponse = await hrAgent.post("/api/leave-requests").send({
            leaveTypeId: leaveType.id,
            startDate: date,
            endDate: date,
            startHalfDay: false,
            endHalfDay: false,
            reason: "Not feeling well",
        });
        expect(submitResponse.body.data.status).toBe("SUBMITTED");

        const superAgent = await loginAs(superAdmin);
        const approveResponse = await superAgent
            .post(`/api/leave-requests/${submitResponse.body.data.id}/approve`)
            .send({});
        expect(approveResponse.statusCode).toBe(200);
        expect(approveResponse.body.data.status).toBe("APPROVED");
    });

    it("rejects SUPER_ADMIN attempting to override a decision — no override power, ever", async () => {
        const superAdmin = await createSuperAdmin({ email: "super-override@example.com" });
        const hrAdmin = await createUser({ role: "HR_ADMIN", email: "hr-override-branch@example.com", managerId: superAdmin.id });
        const employee = await createUser({ email: "emp-override-branch@example.com", managerId: hrAdmin.id });
        const leaveType = await createLeaveType({ name: "Earned Leave" });
        const employeeAgent = await loginAs(employee);
        const date = firstWeekdayOnOrAfter("2031-03-18");

        const submitResponse = await employeeAgent.post("/api/leave-requests").send({
            leaveTypeId: leaveType.id,
            startDate: date,
            endDate: date,
            startHalfDay: false,
            endHalfDay: false,
            reason: "Trip",
        });

        const hrAgent = await loginAs(hrAdmin);
        await hrAgent.post(`/api/leave-requests/${submitResponse.body.data.id}/reject`).send({});

        const superAgent = await loginAs(superAdmin);
        const overrideResponse = await superAgent
            .post(`/api/leave-requests/${submitResponse.body.data.id}/override`)
            .send({ toStatus: "APPROVED", comment: "Reconsidered" });
        expect(overrideResponse.statusCode).toBe(403);
    });

    it("scopes SUPER_ADMIN's HR authority to direct-report HR_ADMINs only, never those HR_ADMINs' own teams", async () => {
        const superAdmin = await createSuperAdmin({ email: "super-scope@example.com" });
        const hrAdmin = await createUser({ role: "HR_ADMIN", email: "hr-scope-branch@example.com", managerId: superAdmin.id });
        const employee = await createUser({ email: "emp-scope-branch@example.com", managerId: hrAdmin.id });

        // Employee completes and submits their profile.
        const employeeAgent = await loginAs(employee);
        await employeeAgent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(employeeAgent);
        await employeeAgent.post("/api/employees/me/profile/submit");

        // The HR_ADMIN (a direct report) also completes and submits theirs.
        const hrAgent = await loginAs(hrAdmin);
        await hrAgent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(hrAgent);
        await hrAgent.post("/api/employees/me/profile/submit");

        const superAgent = await loginAs(superAdmin);

        // A profile is only verifiable once each of its documents is (see
        // userService.verifyProfile) — setup for the scope assertions below,
        // which are what this test is actually about.
        await verifyAllEmployeeDocuments(hrAdmin.id, superAdmin.id);
        await verifyAllEmployeeDocuments(employee.id, hrAdmin.id);

        // SUPER_ADMIN CAN verify their direct-report HR_ADMIN's own profile.
        const verifyHr = await superAgent.post(`/api/employees/${hrAdmin.id}/verify`);
        expect(verifyHr.statusCode).toBe(200);

        // SUPER_ADMIN CANNOT verify the employee two levels down — that
        // belongs to the employee's own HR_ADMIN, not SUPER_ADMIN.
        const verifyEmployee = await superAgent.post(`/api/employees/${employee.id}/verify`);
        expect(verifyEmployee.statusCode).toBe(404);

        // The employee's own HR_ADMIN still can, confirming this is a scope
        // restriction on SUPER_ADMIN specifically, not a broken feature.
        const hrVerifiesEmployee = await hrAgent.post(`/api/employees/${employee.id}/verify`);
        expect(hrVerifiesEmployee.statusCode).toBe(200);
    }, 20000);

    it("notifies SUPER_ADMIN when a direct-report HR_ADMIN submits their profile for verification", async () => {
        const superAdmin = await createSuperAdmin({ email: "super-notif@example.com" });
        const hrAdmin = await createUser({ role: "HR_ADMIN", email: "hr-notif-branch@example.com", managerId: superAdmin.id });
        const hrAgent = await loginAs(hrAdmin);

        await hrAgent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(hrAgent);
        await hrAgent.post("/api/employees/me/profile/submit");

        const superAgent = await loginAs(superAdmin);
        const notifications = (await superAgent.get("/api/notifications")).body.data.notifications;
        const submitted = notifications.find((n) => n.type === "PROFILE_SUBMITTED" && n.entity_id === hrAdmin.id);
        expect(submitted).toBeTruthy();
    }, 20000);

    it("lets an HR_ADMIN report to SUPER_ADMIN via invite, and lets SUPER_ADMIN see them in the company-wide user list", async () => {
        const superAdmin = await createSuperAdmin({ email: "super-invite@example.com" });
        const superAgent = await loginAs(superAdmin);

        const inviteResponse = await superAgent.post("/api/users/invite").send({
            firstName: "New",
            lastName: "HrAdmin",
            email: "new-hr-under-super@example.com",
            role: "HR_ADMIN",
            managerId: superAdmin.id,
        });
        expect(inviteResponse.statusCode).toBe(201);

        const users = (await superAgent.get("/api/users")).body.data;
        const invited = users.find((u) => u.email === "new-hr-under-super@example.com");
        expect(invited.manager_id).toBe(superAdmin.id);
    });
});
