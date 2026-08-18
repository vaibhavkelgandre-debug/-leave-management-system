// The in-app notification system: the read/write API (list/unread-count/
// mark-read/mark-all-read, always scoped to the caller) plus one test per
// hook point confirming the right notification actually gets created —
// leave request submit/decide/withdraw/cancel, profile submit/verify/send-
// back, and salary slip confirmation.
import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import {
    createRootHr,
    createUser,
    createLeaveType,
    createLeaveRequest,
    verifyEmployeeProfile,
    createSalaryStructure,
} from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";
import { REQUIRED_DOCUMENT_TYPES } from "../../services/employeeDocumentService.js";
import { sweepDelegationTransitions } from "../../services/notificationSweepService.js";
import { todayDateKey, addDaysToDateKey } from "../../utils/dates.js";
import { formatPayPeriod } from "../../utils/payPeriod.js";

// salary-slips confirm now rejects a pay period that hasn't started yet
// (see assertPeriodStarted in salarySlipService.js), so these tests need a
// period relative to "now" rather than a hardcoded literal.
function monthsAgo(offset) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

describe("Notifications API", () => {
    it("requires authentication on every route", async () => {
        expect((await request(app).get("/api/notifications")).statusCode).toBe(401);
        expect((await request(app).get("/api/notifications/unread-count")).statusCode).toBe(401);
        expect((await request(app).patch("/api/notifications/read-all")).statusCode).toBe(401);
        expect(
            (await request(app).patch("/api/notifications/00000000-0000-0000-0000-000000000000/read")).statusCode
        ).toBe(401);
    });

    it("only lists/marks the caller's own notifications, 404ing for someone else's", async () => {
        const hr = await createRootHr({ email: "notif-owner-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "notif-owner-mgr@example.com", managerId: hr.id });
        const employee = await createUser({ email: "notif-owner-emp@example.com", managerId: manager.id });
        const leaveType = await createLeaveType();
        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-01", endDate: "2027-02-01" });

        const managerAgent = await loginAs(manager);
        const list = await managerAgent.get("/api/notifications");
        expect(list.statusCode).toBe(200);
        expect(list.body.data.notifications).toHaveLength(1);
        const notificationId = list.body.data.notifications[0].id;

        const otherAgent = await loginAs(hr);
        const stolenRead = await otherAgent.patch(`/api/notifications/${notificationId}/read`);
        expect(stolenRead.statusCode).toBe(404);

        const ownRead = await managerAgent.patch(`/api/notifications/${notificationId}/read`);
        expect(ownRead.statusCode).toBe(200);
        expect(ownRead.body.data.notification.is_read).toBe(true);
    });

    it("tracks unread count accurately and reduces it as notifications are marked read", async () => {
        const hr = await createRootHr({ email: "notif-count-hr@example.com" });
        const employee = await createUser({ email: "notif-count-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType();
        const req1 = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-01", endDate: "2027-02-01" });
        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-03", endDate: "2027-02-03" });

        const hrAgent = await loginAs(hr);
        const before = await hrAgent.get("/api/notifications/unread-count");
        expect(before.body.data.count).toBe(2);

        const list = await hrAgent.get("/api/notifications");
        const first = list.body.data.notifications.find((n) => n.entity_id === req1.id);
        await hrAgent.patch(`/api/notifications/${first.id}/read`);

        const after = await hrAgent.get("/api/notifications/unread-count");
        expect(after.body.data.count).toBe(1);

        // Marking an already-read notification again is a no-op success, not an error.
        const again = await hrAgent.patch(`/api/notifications/${first.id}/read`);
        expect(again.statusCode).toBe(200);
        expect((await hrAgent.get("/api/notifications/unread-count")).body.data.count).toBe(1);
    });

    it("marks every unread notification read at once", async () => {
        const hr = await createRootHr({ email: "notif-markall-hr@example.com" });
        const employee = await createUser({ email: "notif-markall-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType();
        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-01", endDate: "2027-02-01" });
        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-03", endDate: "2027-02-03" });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.patch("/api/notifications/read-all");
        expect(response.statusCode).toBe(200);
        expect(response.body.data.updated).toBe(2);
        expect((await hrAgent.get("/api/notifications/unread-count")).body.data.count).toBe(0);
    });
});

describe("Notification triggers", () => {
    it("notifies only the direct manager on submission, not HR further up the chain", async () => {
        const hr = await createRootHr({ email: "notif-submit-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "notif-submit-mgr@example.com", managerId: hr.id });
        const employee = await createUser({ email: "notif-submit-emp@example.com", managerId: manager.id });
        const leaveType = await createLeaveType({ name: "Sick Leave" });

        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-01", endDate: "2027-02-01" });

        const managerAgent = await loginAs(manager);
        const managerNotifications = await managerAgent.get("/api/notifications");
        expect(managerNotifications.body.data.notifications).toHaveLength(1);
        expect(managerNotifications.body.data.notifications[0]).toMatchObject({
            type: "LEAVE_REQUEST_SUBMITTED",
            entity_type: "LEAVE_REQUEST",
        });
        expect(managerNotifications.body.data.notifications[0].message).toContain("Sick Leave");

        const hrAgent = await loginAs(hr);
        const hrNotifications = await hrAgent.get("/api/notifications");
        expect(hrNotifications.body.data.notifications).toHaveLength(0);
    });

    it("notifies HR directly when the employee reports straight to HR (no manager)", async () => {
        const hr = await createRootHr({ email: "notif-submit-direct-hr@example.com" });
        const employee = await createUser({ email: "notif-submit-direct-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType();

        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-01", endDate: "2027-02-01" });

        const hrAgent = await loginAs(hr);
        const hrNotifications = await hrAgent.get("/api/notifications");
        expect(hrNotifications.body.data.notifications).toHaveLength(1);
        expect(hrNotifications.body.data.notifications[0].type).toBe("LEAVE_REQUEST_SUBMITTED");
    });

    it("notifies the employee when their request is approved or rejected", async () => {
        const hr = await createRootHr({ email: "notif-decide-hr@example.com" });
        const employee = await createUser({ email: "notif-decide-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Casual Leave" });
        const approvedRequest = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-01", endDate: "2027-02-01" });
        const rejectedRequest = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-03", endDate: "2027-02-03" });

        const hrAgent = await loginAs(hr);
        await hrAgent.post(`/api/leave-requests/${approvedRequest.id}/approve`).send({});
        await hrAgent.post(`/api/leave-requests/${rejectedRequest.id}/reject`).send({});

        const employeeAgent = await loginAs(employee);
        const notifications = (await employeeAgent.get("/api/notifications")).body.data.notifications;

        const approvedNotification = notifications.find((n) => n.entity_id === approvedRequest.id);
        const rejectedNotification = notifications.find((n) => n.entity_id === rejectedRequest.id);
        expect(approvedNotification.message).toBe("Your Casual Leave request was approved");
        expect(rejectedNotification.message).toBe("Your Casual Leave request was rejected");
    });

    it("notifies the employee with an override suffix when HR overrides a manager's decision", async () => {
        const hr = await createRootHr({ email: "notif-override-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "notif-override-mgr@example.com", managerId: hr.id });
        const employee = await createUser({ email: "notif-override-emp@example.com", managerId: manager.id });
        const leaveType = await createLeaveType();
        const leaveRequest = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-01", endDate: "2027-02-01" });

        const managerAgent = await loginAs(manager);
        await managerAgent.post(`/api/leave-requests/${leaveRequest.id}/reject`).send({});

        const hrAgent = await loginAs(hr);
        await hrAgent
            .post(`/api/leave-requests/${leaveRequest.id}/override`)
            .send({ toStatus: "APPROVED", comment: "Reconsidered after discussion" });

        const employeeAgent = await loginAs(employee);
        const notifications = (await employeeAgent.get("/api/notifications")).body.data.notifications;
        const overrideNotification = notifications.find((n) => n.type === "LEAVE_REQUEST_DECIDED" && n.message.includes("override"));
        expect(overrideNotification.message).toContain("approved (HR override)");
    });

    it("notifies the manager when the employee withdraws or cancels", async () => {
        const hr = await createRootHr({ email: "notif-withdraw-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "notif-withdraw-mgr@example.com", managerId: hr.id });
        const employee = await createUser({ email: "notif-withdraw-emp@example.com", managerId: manager.id });
        const leaveType = await createLeaveType();
        const withdrawnRequest = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-01", endDate: "2027-02-01" });
        const cancelledRequest = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2027-02-05", endDate: "2027-02-05" });

        const employeeAgent = await loginAs(employee);
        await employeeAgent.post(`/api/leave-requests/${withdrawnRequest.id}/withdraw`).send({});

        const managerAgent = await loginAs(manager);
        await managerAgent.post(`/api/leave-requests/${cancelledRequest.id}/approve`).send({});
        await employeeAgent.post(`/api/leave-requests/${cancelledRequest.id}/cancel`).send({});

        const managerNotifications = (await managerAgent.get("/api/notifications")).body.data.notifications;
        const withdrawnNotification = managerNotifications.find((n) => n.entity_id === withdrawnRequest.id);
        const cancelledNotification = managerNotifications.find(
            (n) => n.entity_id === cancelledRequest.id && n.type === "LEAVE_REQUEST_WITHDRAWN_CANCELLED"
        );
        expect(withdrawnNotification.message).toContain("withdrew");
        expect(cancelledNotification.message).toContain("cancelled");
    });

    // Longer than the default 5s timeout: this scenario chains through
    // several sequential HTTP round trips including multiple document
    // uploads (uploadRequiredDocuments), submit, send-back, resubmit, and
    // verify — each individually fast, but the total exceeds the default.
    it("notifies HR when a profile is submitted, and the employee when it's verified or sent back", async () => {
        const hr = await createRootHr({ email: "notif-profile-hr@example.com" });
        const employee = await createUser({ email: "notif-profile-emp@example.com", managerId: hr.id });
        const agent = await loginAs(employee);

        await agent.patch("/api/users/me/profile").send(COMPLETE_PROFILE_BODY);
        await uploadRequiredDocuments(agent);
        await agent.post("/api/employees/me/profile/submit");

        const hrAgent = await loginAs(hr);
        const hrNotifications = (await hrAgent.get("/api/notifications")).body.data.notifications;
        const submittedNotification = hrNotifications.find((n) => n.type === "PROFILE_SUBMITTED");
        expect(submittedNotification).toBeTruthy();
        expect(submittedNotification.entity_id).toBe(employee.id);

        await hrAgent.post(`/api/employees/${employee.id}/send-back`).send({ reason: "Fix bank details" });
        const afterSendBack = (await agent.get("/api/notifications")).body.data.notifications;
        const sendBackNotification = afterSendBack.find((n) => n.type === "PROFILE_SENT_BACK");
        expect(sendBackNotification.message).toBe("Your profile was sent back: Fix bank details");

        await agent.post("/api/employees/me/profile/submit");
        await hrAgent.post(`/api/employees/${employee.id}/verify`);
        const afterVerify = (await agent.get("/api/notifications")).body.data.notifications;
        expect(afterVerify.some((n) => n.type === "PROFILE_VERIFIED")).toBe(true);
    }, 20000);

    it("notifies the employee when their salary slip is confirmed, using only committed rows", async () => {
        const hr = await createRootHr({ email: "notif-payroll-hr@example.com" });
        const employee = await createUser({ email: "notif-payroll-emp@example.com", managerId: hr.id });
        const unverified = await createUser({ email: "notif-payroll-unverified@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });

        const hrAgent = await loginAs(hr);
        const payPeriod = monthsAgo(1);
        const confirmResponse = await hrAgent.post("/api/salary-slips/confirm").send({ payPeriod });
        const slipId = confirmResponse.body.data.committed[0].id;

        const employeeAgent = await loginAs(employee);
        const employeeNotifications = (await employeeAgent.get("/api/notifications")).body.data.notifications;
        expect(employeeNotifications).toHaveLength(1);
        expect(employeeNotifications[0]).toMatchObject({ type: "SALARY_SLIP_GENERATED", entity_id: slipId });
        expect(employeeNotifications[0].message).toBe(`Your salary slip for ${formatPayPeriod(payPeriod)} is available`);

        const unverifiedAgent = await loginAs(unverified);
        expect((await unverifiedAgent.get("/api/notifications")).body.data.notifications).toHaveLength(0);
    });

    it("notifies the employee when their salary slip is voided", async () => {
        const hr = await createRootHr({ email: "notif-void-hr@example.com" });
        const employee = await createUser({ email: "notif-void-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });

        const hrAgent = await loginAs(hr);
        const payPeriod = monthsAgo(2);
        const confirmResponse = await hrAgent.post("/api/salary-slips/confirm").send({ payPeriod });
        const slipId = confirmResponse.body.data.committed[0].id;

        await hrAgent.post(`/api/salary-slips/${slipId}/void`).send({ reason: "Wrong pay period" });

        const employeeAgent = await loginAs(employee);
        const notifications = (await employeeAgent.get("/api/notifications")).body.data.notifications;
        const voidedNotification = notifications.find((n) => n.type === "SALARY_SLIP_VOIDED");
        expect(voidedNotification.message).toBe(
            `Your salary slip for ${formatPayPeriod(payPeriod)} was voided: Wrong pay period`
        );
    });

    it("notifies the employee and their new manager when the employee's manager changes", async () => {
        const hr = await createRootHr({ email: "notif-mgr-hr@example.com" });
        const oldManager = await createUser({ role: "MANAGER", email: "notif-mgr-old@example.com", managerId: hr.id });
        const newManager = await createUser({ role: "MANAGER", email: "notif-mgr-new@example.com", managerId: hr.id });
        const employee = await createUser({
            email: "notif-mgr-emp@example.com",
            managerId: oldManager.id,
            invitedBy: hr.id,
        });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.patch(`/api/users/${employee.id}/manager`).send({ managerId: newManager.id });
        expect(response.statusCode).toBe(200);

        const employeeAgent = await loginAs(employee);
        const employeeNotifications = (await employeeAgent.get("/api/notifications")).body.data.notifications;
        const managerReassigned = employeeNotifications.find((n) => n.type === "MANAGER_REASSIGNED");
        expect(managerReassigned.message).toBe(`You now report to ${newManager.first_name} ${newManager.last_name}`);

        const newManagerAgent = await loginAs(newManager);
        const newManagerNotifications = (await newManagerAgent.get("/api/notifications")).body.data.notifications;
        const teamMemberAssigned = newManagerNotifications.find((n) => n.type === "TEAM_MEMBER_ASSIGNED");
        expect(teamMemberAssigned.message).toBe(`${employee.first_name} ${employee.last_name} now reports to you`);
    });

    it("does not create a reassignment notification when the manager is unchanged", async () => {
        const hr = await createRootHr({ email: "notif-mgr-noop-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "notif-mgr-noop-mgr@example.com", managerId: hr.id });
        const employee = await createUser({
            email: "notif-mgr-noop-emp@example.com",
            managerId: manager.id,
            invitedBy: hr.id,
        });

        const hrAgent = await loginAs(hr);
        await hrAgent.patch(`/api/users/${employee.id}/manager`).send({ managerId: manager.id });

        const managerAgent = await loginAs(manager);
        const notifications = (await managerAgent.get("/api/notifications")).body.data.notifications;
        expect(notifications.filter((n) => n.type === "TEAM_MEMBER_ASSIGNED")).toHaveLength(0);
    });

    it("notifies the employee when their account is activated or deactivated", async () => {
        const hr = await createRootHr({ email: "notif-status-hr@example.com" });
        const employee = await createUser({
            email: "notif-status-emp@example.com",
            managerId: hr.id,
            invitedBy: hr.id,
        });
        const hrAgent = await loginAs(hr);

        await hrAgent.patch(`/api/users/${employee.id}/status`).send({ status: "INACTIVE" });
        await hrAgent.patch(`/api/users/${employee.id}/status`).send({ status: "ACTIVE" });

        const employeeAgent = await loginAs(employee);
        const notifications = (await employeeAgent.get("/api/notifications")).body.data.notifications;
        const statusNotifications = notifications.filter((n) => n.type === "ACCOUNT_STATUS_CHANGED");
        expect(statusNotifications).toHaveLength(2);
        expect(statusNotifications.some((n) => n.message === "Your account has been activated")).toBe(true);
        expect(statusNotifications.some((n) => n.message === "Your account has been deactivated")).toBe(true);
    });

    it("notifies the employee when HR assigns/updates their salary structure, without leaking any figures", async () => {
        const hr = await createRootHr({ email: "notif-structure-hr@example.com" });
        const employee = await createUser({ email: "notif-structure-emp@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        await hrAgent.patch(`/api/employees/${employee.id}/salary-structure`).send({
            basicSalary: 40000,
            hra: 16000,
            pfEmployeeContribution: 2400,
            pfEmployerContribution: 2400,
            esic: 300,
            specialAllowance: 6000,
            incomeTax: 1500,
        });

        const employeeAgent = await loginAs(employee);
        const notifications = (await employeeAgent.get("/api/notifications")).body.data.notifications;
        const structureNotification = notifications.find((n) => n.type === "SALARY_STRUCTURE_UPDATED");
        expect(structureNotification.message).toBe("Your salary structure has been updated by HR");
        expect(structureNotification.message).not.toMatch(/\d/);
    });

    it("notifies the delegate when nominated, naming the manager and the date range", async () => {
        const manager = await createUser({ role: "MANAGER", email: "notif-deleg-mgr@example.com" });
        const delegate = await createUser({ email: "notif-deleg-delegate@example.com" });
        const managerAgent = await loginAs(manager);

        await managerAgent
            .post("/api/delegations")
            .send({ delegateId: delegate.id, startDate: "2027-06-01", endDate: "2027-06-14" });

        const delegateAgent = await loginAs(delegate);
        const notifications = (await delegateAgent.get("/api/notifications")).body.data.notifications;
        const nominated = notifications.find((n) => n.type === "DELEGATION_NOMINATED");
        expect(nominated.message).toBe(
            `${manager.first_name} ${manager.last_name} nominated you as their delegate from 2027-06-01 to 2027-06-14`
        );
    });

    it("notifies the assigned manager when a new employee is invited, and the inviting HR once the invite is accepted", async () => {
        const hr = await createRootHr({ email: "notif-invite-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "notif-invite-mgr@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        const inviteResponse = await hrAgent.post("/api/users/invite").send({
            firstName: "New",
            lastName: "Hire",
            email: "notif-invite-newhire@example.com",
            role: "EMPLOYEE",
            managerId: manager.id,
        });
        expect(inviteResponse.statusCode).toBe(201);

        const managerAgent = await loginAs(manager);
        const managerNotifications = (await managerAgent.get("/api/notifications")).body.data.notifications;
        const teamMemberAssigned = managerNotifications.find((n) => n.type === "TEAM_MEMBER_ASSIGNED");
        expect(teamMemberAssigned.message).toBe("New Hire now reports to you");

        const token = inviteResponse.body.data.inviteLink.split("/invite/")[1];
        const acceptResponse = await request(app)
            .post("/api/auth/invitations/accept")
            .send({ token, password: "NewPassword123!" });
        expect(acceptResponse.statusCode).toBe(200);

        const hrNotifications = (await hrAgent.get("/api/notifications")).body.data.notifications;
        const inviteAccepted = hrNotifications.find((n) => n.type === "INVITE_ACCEPTED");
        expect(inviteAccepted.message).toBe("New Hire has accepted their invite and joined");
    });

    it("notifies the manager when a delegation's window starts or ends today, deduping a repeat sweep", async () => {
        // Two different managers, not one with two delegations — a single
        // manager's own ranges can't overlap (findOverlappingDelegationForManager),
        // and a window starting today through today+5 and one ending today
        // from today-5 would collide at the "today" boundary for the same manager.
        const startingManager = await createUser({ role: "MANAGER", email: "notif-sweep-start-mgr@example.com" });
        const endingManager = await createUser({ role: "MANAGER", email: "notif-sweep-end-mgr@example.com" });
        const startingDelegate = await createUser({ email: "notif-sweep-starting@example.com" });
        const endingDelegate = await createUser({ email: "notif-sweep-ending@example.com" });

        const today = todayDateKey();
        await (await loginAs(startingManager)).post("/api/delegations").send({
            delegateId: startingDelegate.id,
            startDate: today,
            endDate: addDaysToDateKey(today, 5),
        });
        await (await loginAs(endingManager)).post("/api/delegations").send({
            delegateId: endingDelegate.id,
            startDate: addDaysToDateKey(today, -5),
            endDate: today,
        });

        await sweepDelegationTransitions();

        const startingManagerAgent = await loginAs(startingManager);
        const endingManagerAgent = await loginAs(endingManager);
        const firstStartNotifications = (await startingManagerAgent.get("/api/notifications")).body.data.notifications;
        const firstEndNotifications = (await endingManagerAgent.get("/api/notifications")).body.data.notifications;
        expect(firstStartNotifications.filter((n) => n.type === "DELEGATION_STARTED")).toHaveLength(1);
        expect(firstEndNotifications.filter((n) => n.type === "DELEGATION_ENDED")).toHaveLength(1);

        await sweepDelegationTransitions();

        const secondStartNotifications = (await startingManagerAgent.get("/api/notifications")).body.data.notifications;
        const secondEndNotifications = (await endingManagerAgent.get("/api/notifications")).body.data.notifications;
        expect(secondStartNotifications.filter((n) => n.type === "DELEGATION_STARTED")).toHaveLength(1);
        expect(secondEndNotifications.filter((n) => n.type === "DELEGATION_ENDED")).toHaveLength(1);
    });
});
