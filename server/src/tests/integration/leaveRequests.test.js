import request from "supertest";
import app from "../../app.js";
import { describe, it, expect } from "vitest";
import {
    createRootHr,
    createUser,
    createLeaveType,
    createHoliday,
    createLeaveRequest,
    createDelegation,
} from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

// Every leave request in this file is dated in 2030 so it's always safely in
// the future — GET /leave-balances/me defaults to the *current* real-world
// year when no `year` is given, so callers must explicitly ask for 2030 or
// they'll see an empty year's balance instead of the one these requests
// actually affected.
async function getBalance(agent, leaveTypeId, year = 2030) {
    const response = await agent.get("/api/leave-balances/me").query({ year });
    return response.body.data.find((b) => b.leave_type_id === leaveTypeId);
}

describe("Leave requests", () => {
    it("requires authentication", async () => {
        const response = await request(app).get("/api/leave-requests/mine");
        expect(response.statusCode).toBe(401);
    });

    describe("preview", () => {
        it("computes working days without creating anything", async () => {
            const employee = await createUser({ email: "preview-emp@example.com" });
            const agent = await loginAs(employee);

            const response = await agent
                .post("/api/leave-requests/preview")
                .send({ startDate: "2027-01-04", endDate: "2027-01-08" });

            expect(response.statusCode).toBe(200);
            expect(response.body.data.workingDays).toBe(5);

            const list = await agent.get("/api/leave-requests/mine");
            expect(list.body.data).toHaveLength(0);
        });

        it("excludes a holiday from the preview", async () => {
            const employee = await createUser({ email: "preview-holiday@example.com" });
            await createHoliday({ name: "Mid-week holiday", startDate: "2027-01-06" });
            const agent = await loginAs(employee);

            const response = await agent
                .post("/api/leave-requests/preview")
                .send({ startDate: "2027-01-04", endDate: "2027-01-08" });

            expect(response.body.data.workingDays).toBe(4);
        });
    });

    describe("submission", () => {
        it("submits a valid request and holds the days as pending", async () => {
            const manager = await createUser({ role: "MANAGER", email: "sub-mgr@example.com" });
            const employee = await createUser({ role: "EMPLOYEE", managerId: manager.id, email: "sub-emp@example.com" });
            const leaveType = await createLeaveType({ name: "Submission Leave", annualEntitlement: 10 });
            const agent = await loginAs(employee);

            const response = await agent.post("/api/leave-requests").send({
                leaveTypeId: leaveType.id,
                startDate: "2030-06-03",
                endDate: "2030-06-04",
                reason: "Family event",
            });

            expect(response.statusCode).toBe(201);
            expect(response.body.data.status).toBe("SUBMITTED");
            expect(Number(response.body.data.working_days)).toBe(2);

            const balance = await getBalance(agent, leaveType.id);
            expect(Number(balance.days_pending)).toBe(2);
            expect(Number(balance.days_taken)).toBe(0);
            expect(Number(balance.days_remaining)).toBe(8);
        });

        it("rejects a range with no working days", async () => {
            const employee = await createUser({ email: "sub-noworkdays@example.com" });
            const leaveType = await createLeaveType({ name: "No Workdays Leave" });
            const agent = await loginAs(employee);

            // 2027-01-09/10 is a Saturday/Sunday.
            const response = await agent.post("/api/leave-requests").send({
                leaveTypeId: leaveType.id,
                startDate: "2027-01-09",
                endDate: "2027-01-10",
                reason: "Oops",
            });

            expect(response.statusCode).toBe(400);
        });

        it("rejects an overlapping request", async () => {
            const employee = await createUser({ email: "sub-overlap@example.com" });
            const leaveType = await createLeaveType({ name: "Overlap Leave", annualEntitlement: 20 });
            await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-07-01",
                endDate: "2030-07-05",
            });
            const agent = await loginAs(employee);

            const response = await agent.post("/api/leave-requests").send({
                leaveTypeId: leaveType.id,
                startDate: "2030-07-03",
                endDate: "2030-07-08",
                reason: "Clashing",
            });

            expect(response.statusCode).toBe(409);
        });

        it("rejects a request that would take the balance negative", async () => {
            const employee = await createUser({ email: "sub-negative@example.com" });
            const leaveType = await createLeaveType({ name: "Tiny Leave", annualEntitlement: 1, allowNegativeBalance: false });
            const agent = await loginAs(employee);

            const response = await agent.post("/api/leave-requests").send({
                leaveTypeId: leaveType.id,
                startDate: "2030-06-03", // Mon-Tue, 2 working days against a 1-day entitlement
                endDate: "2030-06-04",
                reason: "Too much",
            });

            expect(response.statusCode).toBe(400);
        });

        it("allows a negative balance when the leave type permits it", async () => {
            const employee = await createUser({ email: "sub-allow-negative@example.com" });
            const leaveType = await createLeaveType({ name: "Flexible Leave", annualEntitlement: 1, allowNegativeBalance: true });
            const agent = await loginAs(employee);

            const response = await agent.post("/api/leave-requests").send({
                leaveTypeId: leaveType.id,
                startDate: "2030-06-03",
                endDate: "2030-06-04",
                reason: "Fine",
            });

            expect(response.statusCode).toBe(201);
            const balance = await getBalance(agent, leaveType.id);
            expect(Number(balance.days_remaining)).toBe(-1);
        });
    });

    describe("approval workflow", () => {
        it("moves days from pending to taken on approval", async () => {
            const manager = await createUser({ role: "MANAGER", email: "appr-mgr@example.com" });
            const employee = await createUser({ role: "EMPLOYEE", managerId: manager.id, email: "appr-emp@example.com" });
            const leaveType = await createLeaveType({ name: "Approve Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-09-02",
                endDate: "2030-09-03",
            });

            const managerAgent = await loginAs(manager);
            const response = await managerAgent
                .post(`/api/leave-requests/${leaveRequest.id}/approve`)
                .send({ comment: "Enjoy" });

            expect(response.statusCode).toBe(200);
            expect(response.body.data.status).toBe("APPROVED");

            const employeeAgent = await loginAs(employee);
            const balance = await getBalance(employeeAgent, leaveType.id);
            expect(Number(balance.days_pending)).toBe(0);
            expect(Number(balance.days_taken)).toBe(2);
        });

        it("releases the pending hold on rejection without touching taken", async () => {
            const manager = await createUser({ role: "MANAGER", email: "rej-mgr@example.com" });
            const employee = await createUser({ role: "EMPLOYEE", managerId: manager.id, email: "rej-emp@example.com" });
            const leaveType = await createLeaveType({ name: "Reject Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-09-10",
                endDate: "2030-09-11",
            });

            const managerAgent = await loginAs(manager);
            const response = await managerAgent
                .post(`/api/leave-requests/${leaveRequest.id}/reject`)
                .send({ comment: "Not now" });

            expect(response.statusCode).toBe(200);
            expect(response.body.data.status).toBe("REJECTED");

            const employeeAgent = await loginAs(employee);
            const balance = await getBalance(employeeAgent, leaveType.id);
            expect(Number(balance.days_pending)).toBe(0);
            expect(Number(balance.days_taken)).toBe(0);
        });

        it("lets an employee withdraw their own pending request", async () => {
            const employee = await createUser({ email: "withdraw-emp@example.com" });
            const leaveType = await createLeaveType({ name: "Withdraw Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-09-16",
                endDate: "2030-09-17",
            });
            const agent = await loginAs(employee);

            const response = await agent.post(`/api/leave-requests/${leaveRequest.id}/withdraw`).send({});
            expect(response.statusCode).toBe(200);
            expect(response.body.data.status).toBe("WITHDRAWN");

            const balance = await getBalance(agent, leaveType.id);
            expect(Number(balance.days_pending)).toBe(0);
        });

        it("lets an employee cancel their own future approved request, restoring the balance", async () => {
            const manager = await createUser({ role: "MANAGER", email: "cancel-mgr@example.com" });
            const employee = await createUser({ role: "EMPLOYEE", managerId: manager.id, email: "cancel-emp@example.com" });
            const leaveType = await createLeaveType({ name: "Cancel Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-09-23",
                endDate: "2030-09-24",
            });
            const managerAgent = await loginAs(manager);
            await managerAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            const employeeAgent = await loginAs(employee);
            const response = await employeeAgent.post(`/api/leave-requests/${leaveRequest.id}/cancel`).send({});

            expect(response.statusCode).toBe(200);
            expect(response.body.data.status).toBe("CANCELLED");

            const balance = await getBalance(employeeAgent, leaveType.id);
            expect(Number(balance.days_taken)).toBe(0);
            expect(Number(balance.days_pending)).toBe(0);
        });

        it("refuses to cancel an approved request that has already started", async () => {
            const manager = await createUser({ role: "MANAGER", email: "cancel-past-mgr@example.com" });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "cancel-past-emp@example.com",
            });
            const leaveType = await createLeaveType({ name: "Past Cancel Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2020-01-06",
                endDate: "2020-01-07",
            });
            const managerAgent = await loginAs(manager);
            await managerAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            const employeeAgent = await loginAs(employee);
            const response = await employeeAgent.post(`/api/leave-requests/${leaveRequest.id}/cancel`).send({});

            expect(response.statusCode).toBe(400);
        });

        it("rejects an illegal transition — approving an already-withdrawn request", async () => {
            const manager = await createUser({ role: "MANAGER", email: "illegal-mgr@example.com" });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "illegal-emp@example.com",
            });
            const leaveType = await createLeaveType({ name: "Illegal Transition Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-10-01",
                endDate: "2030-10-02",
            });
            const employeeAgent = await loginAs(employee);
            await employeeAgent.post(`/api/leave-requests/${leaveRequest.id}/withdraw`).send({});

            const managerAgent = await loginAs(manager);
            const response = await managerAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            expect(response.statusCode).toBe(409);
        });
    });

    describe("HR override", () => {
        it("overrides a rejected request to approved, and it now counts as taken", async () => {
            const hr = await createRootHr({ email: "override-hr@example.com" });
            // Must actually be in this HR's reporting subtree — HR's override
            // authority is scoped to their own branch, not company-wide.
            const manager = await createUser({ role: "MANAGER", managerId: hr.id, email: "override-mgr@example.com" });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "override-emp@example.com",
            });
            const leaveType = await createLeaveType({ name: "Override Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-10-08",
                endDate: "2030-10-09",
            });
            const managerAgent = await loginAs(manager);
            await managerAgent.post(`/api/leave-requests/${leaveRequest.id}/reject`).send({});

            const hrAgent = await loginAs(hr);
            const response = await hrAgent
                .post(`/api/leave-requests/${leaveRequest.id}/override`)
                .send({ toStatus: "APPROVED", comment: "Reconsidered" });

            expect(response.statusCode).toBe(200);
            expect(response.body.data.status).toBe("APPROVED");

            const employeeAgent = await loginAs(employee);
            const balance = await getBalance(employeeAgent, leaveType.id);
            expect(Number(balance.days_taken)).toBe(2);
            expect(Number(balance.days_pending)).toBe(0);
        });

        it("rejects an override attempt from a non-HR caller", async () => {
            const manager = await createUser({ role: "MANAGER", email: "override-nonhr-mgr@example.com" });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "override-nonhr-emp@example.com",
            });
            const leaveType = await createLeaveType({ name: "Non-HR Override Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-10-15",
                endDate: "2030-10-16",
            });
            const managerAgent = await loginAs(manager);
            await managerAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            const response = await managerAgent
                .post(`/api/leave-requests/${leaveRequest.id}/override`)
                .send({ toStatus: "REJECTED" });

            expect(response.statusCode).toBe(403);
        });
    });

    describe("authorization", () => {
        it("stops a manager acting on a request outside their team", async () => {
            const managerA = await createUser({ role: "MANAGER", email: "authz-mgrA@example.com" });
            const managerB = await createUser({ role: "MANAGER", email: "authz-mgrB@example.com" });
            const employeeOfA = await createUser({
                role: "EMPLOYEE",
                managerId: managerA.id,
                email: "authz-empA@example.com",
            });
            const leaveType = await createLeaveType({ name: "Cross-team Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employeeOfA.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-11-04",
                endDate: "2030-11-05",
            });

            const managerBAgent = await loginAs(managerB);
            const response = await managerBAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            expect(response.statusCode).toBe(404);
        });

        it("stops an employee approving their own request", async () => {
            const employee = await createUser({ email: "authz-self@example.com" });
            const leaveType = await createLeaveType({ name: "Self Approve Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-11-11",
                endDate: "2030-11-12",
            });

            const agent = await loginAs(employee);
            const response = await agent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            expect(response.statusCode).toBe(403);
        });

        it("stops a delegate acting once their delegation window has ended", async () => {
            const manager = await createUser({ role: "MANAGER", email: "authz-delegator@example.com" });
            const delegate = await createUser({ role: "MANAGER", email: "authz-delegate@example.com" });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "authz-delegated-emp@example.com",
            });
            const leaveType = await createLeaveType({ name: "Delegate Window Leave", annualEntitlement: 10 });

            // Window entirely in the past — expired by "today" no matter when this suite runs.
            await createDelegation({
                managerId: manager.id,
                delegateId: delegate.id,
                startDate: "2020-01-01",
                endDate: "2020-01-31",
            });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-11-18",
                endDate: "2030-11-19",
            });

            const delegateAgent = await loginAs(delegate);
            const response = await delegateAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            // Same 404 as "no relationship at all" — an expired delegate has
            // no more standing to know this request exists than a stranger.
            expect(response.statusCode).toBe(404);
        });

        it("lets a delegate act while their delegation window is active", async () => {
            const manager = await createUser({ role: "MANAGER", email: "authz-active-delegator@example.com" });
            const delegate = await createUser({ role: "MANAGER", email: "authz-active-delegate@example.com" });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "authz-active-delegated-emp@example.com",
            });
            const leaveType = await createLeaveType({ name: "Active Delegate Leave", annualEntitlement: 10 });

            const year = new Date().getFullYear();
            await createDelegation({
                managerId: manager.id,
                delegateId: delegate.id,
                startDate: `${year}-01-01`,
                endDate: `${year}-12-31`,
            });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-11-25",
                endDate: "2030-11-26",
            });

            const delegateAgent = await loginAs(delegate);
            const response = await delegateAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            expect(response.statusCode).toBe(200);
        });

        it("lets an HR admin approve a request within their own reporting subtree", async () => {
            const hr = await createRootHr({ email: "authz-hr-own-branch@example.com" });
            const manager = await createUser({ role: "MANAGER", managerId: hr.id, email: "authz-hr-own-mgr@example.com" });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "authz-hr-own-emp@example.com",
            });
            const leaveType = await createLeaveType({ name: "HR Own Branch Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-11-28",
                endDate: "2030-11-29",
            });

            const hrAgent = await loginAs(hr);
            const response = await hrAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            expect(response.statusCode).toBe(200);
        });

        it("stops an HR admin approving a request outside their own reporting subtree — this app supports more than one HR_ADMIN", async () => {
            const hrA = await createRootHr({ email: "authz-hrA@example.com" });
            const hrB = await createRootHr({ email: "authz-hrB@example.com" });
            const managerOfB = await createUser({ role: "MANAGER", managerId: hrB.id, email: "authz-mgr-of-hrB@example.com" });
            const employeeOfB = await createUser({
                role: "EMPLOYEE",
                managerId: managerOfB.id,
                email: "authz-emp-of-hrB@example.com",
            });
            const leaveType = await createLeaveType({ name: "Cross-HR Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employeeOfB.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-04",
                endDate: "2030-12-05",
            });

            const hrAAgent = await loginAs(hrA);
            const response = await hrAAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            // Same 404 as "no relationship at all" — an unrelated HR admin has
            // no more legitimate reason to know this request exists than an
            // unrelated manager does.
            expect(response.statusCode).toBe(404);
        });

        it("stops an HR admin overriding a decision outside their own reporting subtree", async () => {
            const hrA = await createRootHr({ email: "authz-override-hrA@example.com" });
            const hrB = await createRootHr({ email: "authz-override-hrB@example.com" });
            const managerOfB = await createUser({
                role: "MANAGER",
                managerId: hrB.id,
                email: "authz-override-mgr-of-hrB@example.com",
            });
            const employeeOfB = await createUser({
                role: "EMPLOYEE",
                managerId: managerOfB.id,
                email: "authz-override-emp-of-hrB@example.com",
            });
            const leaveType = await createLeaveType({ name: "Cross-HR Override Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employeeOfB.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-06",
                endDate: "2030-12-07",
            });
            const managerOfBAgent = await loginAs(managerOfB);
            await managerOfBAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            const hrAAgent = await loginAs(hrA);
            const response = await hrAAgent
                .post(`/api/leave-requests/${leaveRequest.id}/override`)
                .send({ toStatus: "REJECTED" });

            expect(response.statusCode).toBe(404);
        });
    });

    describe("listing", () => {
        it("shows an employee only their own requests", async () => {
            const employeeA = await createUser({ email: "list-empA@example.com" });
            const employeeB = await createUser({ email: "list-empB@example.com" });
            const leaveType = await createLeaveType({ name: "Listing Leave", annualEntitlement: 10 });
            await createLeaveRequest({
                employeeId: employeeA.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-02",
                endDate: "2030-12-03",
            });
            await createLeaveRequest({
                employeeId: employeeB.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-02",
                endDate: "2030-12-03",
            });

            const agentA = await loginAs(employeeA);
            const response = await agentA.get("/api/leave-requests/mine");

            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].employee_id).toBe(employeeA.id);
        });

        it("shows a manager only their direct reports' requests, and HR their whole reporting subtree", async () => {
            const hr = await createRootHr({ email: "list-hr@example.com" });
            const managerA = await createUser({ role: "MANAGER", managerId: hr.id, email: "list-mgrA@example.com" });
            const managerB = await createUser({ role: "MANAGER", managerId: hr.id, email: "list-mgrB@example.com" });
            const employeeOfA = await createUser({
                role: "EMPLOYEE",
                managerId: managerA.id,
                email: "list-empOfA@example.com",
            });
            const employeeOfB = await createUser({
                role: "EMPLOYEE",
                managerId: managerB.id,
                email: "list-empOfB@example.com",
            });
            const leaveType = await createLeaveType({ name: "Team Listing Leave", annualEntitlement: 10 });
            await createLeaveRequest({
                employeeId: employeeOfA.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-09",
                endDate: "2030-12-10",
            });
            await createLeaveRequest({
                employeeId: employeeOfB.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-09",
                endDate: "2030-12-10",
            });

            const managerAAgent = await loginAs(managerA);
            const teamAResponse = await managerAAgent.get("/api/leave-requests/team");
            expect(teamAResponse.body.data).toHaveLength(1);
            expect(teamAResponse.body.data[0].employee_id).toBe(employeeOfA.id);

            const hrAgent = await loginAs(hr);
            const teamHrResponse = await hrAgent.get("/api/leave-requests/team");
            expect(teamHrResponse.body.data).toHaveLength(2);
        });

        it("scopes HR's /team list to their own branch, not another HR admin's — this app supports more than one HR_ADMIN", async () => {
            const hrA = await createRootHr({ email: "list-hrA@example.com" });
            const hrB = await createRootHr({ email: "list-hrB@example.com" });
            const managerOfA = await createUser({ role: "MANAGER", managerId: hrA.id, email: "list-mgr-of-hrA@example.com" });
            const managerOfB = await createUser({ role: "MANAGER", managerId: hrB.id, email: "list-mgr-of-hrB@example.com" });
            const employeeOfA = await createUser({
                role: "EMPLOYEE",
                managerId: managerOfA.id,
                email: "list-emp-of-hrA@example.com",
            });
            const employeeOfB = await createUser({
                role: "EMPLOYEE",
                managerId: managerOfB.id,
                email: "list-emp-of-hrB@example.com",
            });
            const leaveType = await createLeaveType({ name: "Cross-HR Listing Leave", annualEntitlement: 10 });
            await createLeaveRequest({
                employeeId: employeeOfA.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-11",
                endDate: "2030-12-12",
            });
            await createLeaveRequest({
                employeeId: employeeOfB.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-11",
                endDate: "2030-12-12",
            });

            const hrAAgent = await loginAs(hrA);
            const response = await hrAAgent.get("/api/leave-requests/team");

            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].employee_id).toBe(employeeOfA.id);
        });

        it("returns an empty list, not a 403, for a plain employee with no reports and no active delegation", async () => {
            // Not role-gated at the route (see leaveRequestRoutes.js): an
            // employee can be nominated as someone's delegate and needs this
            // same endpoint to see the delegated team while active — see the
            // delegation describe block below. An ordinary employee with
            // neither reports nor a delegation just gets [] back.
            const employee = await createUser({ email: "list-employee-team@example.com" });
            const agent = await loginAs(employee);
            const response = await agent.get("/api/leave-requests/team");
            expect(response.statusCode).toBe(200);
            expect(response.body.data).toEqual([]);
        });

        it("merges a currently-delegated manager's team into the delegate's own team list", async () => {
            const manager = await createUser({ role: "MANAGER", email: "list-delegating-mgr@example.com" });
            const delegateEmployee = await createUser({ email: "list-delegate-emp@example.com" });
            const employeeOfManager = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "list-emp-of-delegating-mgr@example.com",
            });
            const leaveType = await createLeaveType({ name: "Delegated Team Listing Leave", annualEntitlement: 10 });
            await createLeaveRequest({
                employeeId: employeeOfManager.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-09",
                endDate: "2030-12-10",
            });

            // Dated around today (unlike this file's usual 2030 dates) since
            // "currently delegated" is evaluated against the real clock, not
            // the leave request's own dates.
            const today = new Date().toISOString().slice(0, 10);
            await createDelegation({ managerId: manager.id, delegateId: delegateEmployee.id, startDate: today, endDate: today });

            const delegateAgent = await loginAs(delegateEmployee);
            const response = await delegateAgent.get("/api/leave-requests/team");
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].employee_id).toBe(employeeOfManager.id);
            expect(response.body.data[0].manager_first_name).toBe(manager.first_name);
        });
    });

    describe("all requests (HR company-wide view)", () => {
        it("shows an HR admin every request in the company, including other HR admins' branches", async () => {
            const hrA = await createRootHr({ email: "all-hrA@example.com" });
            const hrB = await createRootHr({ email: "all-hrB@example.com" });
            const managerOfA = await createUser({ role: "MANAGER", managerId: hrA.id, email: "all-mgr-of-hrA@example.com" });
            const managerOfB = await createUser({ role: "MANAGER", managerId: hrB.id, email: "all-mgr-of-hrB@example.com" });
            const employeeOfA = await createUser({
                role: "EMPLOYEE",
                managerId: managerOfA.id,
                email: "all-emp-of-hrA@example.com",
            });
            const employeeOfB = await createUser({
                role: "EMPLOYEE",
                managerId: managerOfB.id,
                email: "all-emp-of-hrB@example.com",
            });
            const leaveType = await createLeaveType({ name: "All Requests Leave", annualEntitlement: 10 });
            await createLeaveRequest({
                employeeId: employeeOfA.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-15",
                endDate: "2030-12-16",
            });
            await createLeaveRequest({
                employeeId: employeeOfB.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-15",
                endDate: "2030-12-16",
            });

            const hrAAgent = await loginAs(hrA);
            const response = await hrAAgent.get("/api/leave-requests/all");

            expect(response.statusCode).toBe(200);
            const employeeIds = response.body.data.map((request) => request.employee_id);
            expect(employeeIds).toEqual(expect.arrayContaining([employeeOfA.id, employeeOfB.id]));
        });

        it("rejects a non-HR caller — a manager only ever gets their own branch via /team, never company-wide", async () => {
            const manager = await createUser({ role: "MANAGER", email: "all-nonhr-mgr@example.com" });
            const agent = await loginAs(manager);

            const response = await agent.get("/api/leave-requests/all");

            expect(response.statusCode).toBe(403);
        });
    });

    describe("audit trail", () => {
        it("records every state change with the actor and both statuses", async () => {
            const manager = await createUser({ role: "MANAGER", email: "audit-mgr@example.com" });
            const employee = await createUser({ role: "EMPLOYEE", managerId: manager.id, email: "audit-emp@example.com" });
            const leaveType = await createLeaveType({ name: "Audit Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-16",
                endDate: "2030-12-17",
            });
            const managerAgent = await loginAs(manager);
            await managerAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({ comment: "Go ahead" });

            const employeeAgent = await loginAs(employee);
            const response = await employeeAgent.get(`/api/leave-requests/${leaveRequest.id}/audit`);

            expect(response.statusCode).toBe(200);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0]).toMatchObject({
                action: "SUBMIT",
                actor_id: employee.id,
                new_status: "SUBMITTED",
            });
            expect(response.body.data[1]).toMatchObject({
                action: "APPROVE",
                actor_id: manager.id,
                old_status: "SUBMITTED",
                new_status: "APPROVED",
                comment: "Go ahead",
            });
        });

        it("records who acted and who they acted for when a delegate approves", async () => {
            const manager = await createUser({ role: "MANAGER", email: "audit-delegator@example.com" });
            const delegate = await createUser({ role: "MANAGER", email: "audit-delegate@example.com" });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "audit-delegated-emp@example.com",
            });
            const leaveType = await createLeaveType({ name: "Audit Delegate Leave", annualEntitlement: 10 });
            const year = new Date().getFullYear();
            await createDelegation({
                managerId: manager.id,
                delegateId: delegate.id,
                startDate: `${year}-01-01`,
                endDate: `${year}-12-31`,
            });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-23",
                endDate: "2030-12-24",
            });

            const delegateAgent = await loginAs(delegate);
            await delegateAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            const managerAgent = await loginAs(manager);
            const response = await managerAgent.get(`/api/leave-requests/${leaveRequest.id}/audit`);
            const approveEntry = response.body.data.find((entry) => entry.action === "APPROVE");

            expect(approveEntry.actor_id).toBe(delegate.id);
            expect(approveEntry.acted_for).toBe(manager.id);
        });

        it("resolves actor and acted-for names so the trail never shows a raw id", async () => {
            const manager = await createUser({
                role: "MANAGER",
                email: "audit-names-mgr@example.com",
                firstName: "Priya",
                lastName: "Manager",
            });
            const employee = await createUser({
                role: "EMPLOYEE",
                managerId: manager.id,
                email: "audit-names-emp@example.com",
                firstName: "Asha",
                lastName: "Employee",
            });
            const leaveType = await createLeaveType({ name: "Audit Names Leave", annualEntitlement: 10 });
            const leaveRequest = await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: "2030-12-18",
                endDate: "2030-12-19",
            });
            const managerAgent = await loginAs(manager);
            await managerAgent.post(`/api/leave-requests/${leaveRequest.id}/approve`).send({});

            const response = await managerAgent.get(`/api/leave-requests/${leaveRequest.id}/audit`);
            const submitEntry = response.body.data.find((entry) => entry.action === "SUBMIT");
            const approveEntry = response.body.data.find((entry) => entry.action === "APPROVE");

            expect(submitEntry).toMatchObject({ actor_first_name: "Asha", actor_last_name: "Employee" });
            expect(approveEntry).toMatchObject({ actor_first_name: "Priya", actor_last_name: "Manager" });
        });
    });
});
