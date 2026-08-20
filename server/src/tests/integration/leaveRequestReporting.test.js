// FR-024: HR's filterable browse view (GET /api/leave-requests) and the
// leave-taken-per-employee report (GET /api/leave-requests/report, and its
// CSV twin). Every filter/report period is resolved by the database, not by
// fetching everything and filtering in JS — these tests assert on the
// *results* a real filter/aggregation query would produce, which is the
// only way to actually prove that from the outside.
import { describe, it, expect } from "vitest";
import {
    createRootHr,
    createSuperAdmin,
    createUser,
    createLeaveType,
    createLeaveRequest,
} from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("GET /api/leave-requests (HR filterable browse)", () => {
    it("rejects a non-HR caller", async () => {
        const employee = await createUser({ email: "browse-employee@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.get("/api/leave-requests");
        expect(response.statusCode).toBe(403);
    });

    it("filters by employeeId", async () => {
        const hr = await createRootHr({ email: "browse-hr-emp@example.com" });
        const employeeA = await createUser({ email: "browse-a@example.com", managerId: hr.id });
        const employeeB = await createUser({ email: "browse-b@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Browse Filter Leave A" });
        await createLeaveRequest({ employeeId: employeeA.id, leaveTypeId: leaveType.id, startDate: "2031-02-03", endDate: "2031-02-04" });
        await createLeaveRequest({ employeeId: employeeB.id, leaveTypeId: leaveType.id, startDate: "2031-02-05", endDate: "2031-02-06" });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.get("/api/leave-requests").query({ employeeId: employeeA.id });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.requests).toHaveLength(1);
        expect(response.body.data.requests[0].employee_id).toBe(employeeA.id);
    });

    it("filters by leaveTypeId", async () => {
        const hr = await createRootHr({ email: "browse-hr-type@example.com" });
        const employee = await createUser({ email: "browse-type-emp@example.com", managerId: hr.id });
        const typeA = await createLeaveType({ name: "Browse Filter Type A" });
        const typeB = await createLeaveType({ name: "Browse Filter Type B" });
        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: typeA.id, startDate: "2031-03-03", endDate: "2031-03-04" });
        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: typeB.id, startDate: "2031-03-05", endDate: "2031-03-06" });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.get("/api/leave-requests").query({ leaveTypeId: typeA.id });

        expect(response.body.data.requests).toHaveLength(1);
        expect(response.body.data.requests[0].leave_type_id).toBe(typeA.id);
    });

    it("filters by status, including WITHDRAWN — unlike /all, nothing is excluded by default", async () => {
        const hr = await createRootHr({ email: "browse-hr-status@example.com" });
        const employee = await createUser({ email: "browse-status-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Browse Filter Status Leave" });
        const withdrawn = await createLeaveRequest({
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            startDate: "2031-04-01",
            endDate: "2031-04-02",
        });
        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2031-04-10", endDate: "2031-04-11" });

        const employeeAgent = await loginAs(employee);
        await employeeAgent.post(`/api/leave-requests/${withdrawn.id}/withdraw`).send({});

        const hrAgent = await loginAs(hr);

        const unfilteredResponse = await hrAgent.get("/api/leave-requests");
        expect(unfilteredResponse.body.data.requests).toHaveLength(2);

        const withdrawnResponse = await hrAgent.get("/api/leave-requests").query({ status: "WITHDRAWN" });
        expect(withdrawnResponse.body.data.requests).toHaveLength(1);
        expect(withdrawnResponse.body.data.requests[0].id).toBe(withdrawn.id);
    });

    it("filters by a date range using overlap, not exact containment", async () => {
        const hr = await createRootHr({ email: "browse-hr-range@example.com" });
        const employee = await createUser({ email: "browse-range-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Browse Filter Range Leave" });
        // Starts before the filter window and ends inside it — should still
        // count as overlapping, not be excluded for starting early.
        const spanning = await createLeaveRequest({
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            startDate: "2031-05-28",
            endDate: "2031-06-02",
        });
        // Entirely outside the filter window.
        await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2031-07-01", endDate: "2031-07-02" });

        const hrAgent = await loginAs(hr);
        const response = await hrAgent.get("/api/leave-requests").query({ startDate: "2031-06-01", endDate: "2031-06-30" });

        expect(response.body.data.requests).toHaveLength(1);
        expect(response.body.data.requests[0].id).toBe(spanning.id);
    });

    it("rejects an endDate before startDate", async () => {
        const hr = await createRootHr({ email: "browse-hr-badrange@example.com" });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.get("/api/leave-requests").query({ startDate: "2031-06-10", endDate: "2031-06-01" });
        expect(response.statusCode).toBe(422);
    });

    it("scopes to the caller's own reporting subtree — one HR admin cannot browse another HR admin's branch", async () => {
        const hrA = await createRootHr({ email: "browse-hr-scope-a@example.com" });
        const hrB = await createRootHr({ email: "browse-hr-scope-b@example.com" });
        const employeeOfB = await createUser({ email: "browse-scope-b-emp@example.com", managerId: hrB.id });
        const leaveType = await createLeaveType({ name: "Browse Scope Leave" });
        await createLeaveRequest({ employeeId: employeeOfB.id, leaveTypeId: leaveType.id, startDate: "2031-02-10", endDate: "2031-02-11" });

        const hrAAgent = await loginAs(hrA);

        const unfiltered = await hrAAgent.get("/api/leave-requests");
        expect(unfiltered.body.data.requests).toHaveLength(0);

        const filteredByOthersEmployee = await hrAAgent.get("/api/leave-requests").query({ employeeId: employeeOfB.id });
        expect(filteredByOthersEmployee.body.data.requests).toHaveLength(0);
    });

    // SUPER_ADMIN is the exception to that scoping (direct request): its
    // HR *write* scope is direct-report HR admins only, but for reporting it
    // covers every employee — the role that can already read every request
    // company-wide would otherwise get a browse view of almost nobody.
    it("covers every branch for SUPER_ADMIN, including employees it has no HR-write scope over", async () => {
        const superAdmin = await createSuperAdmin({ email: "browse-super@example.com" });
        const hr = await createRootHr({ email: "browse-super-hr@example.com", managerId: null });
        const deepEmployee = await createUser({ email: "browse-super-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Browse Super Leave" });
        await createLeaveRequest({
            employeeId: deepEmployee.id,
            leaveTypeId: leaveType.id,
            startDate: "2031-03-10",
            endDate: "2031-03-11",
        });

        const superAgent = await loginAs(superAdmin);
        const response = await superAgent.get("/api/leave-requests");

        expect(response.statusCode).toBe(200);
        expect(response.body.data.requests.map((row) => row.employee_id)).toContain(deepEmployee.id);

        const filtered = await superAgent.get("/api/leave-requests").query({ employeeId: deepEmployee.id });
        expect(filtered.body.data.requests).toHaveLength(1);
    });

    // The browse view is paginated (the unfiltered default is every request in
    // the caller's scope — thousands of rows at NFR-7's target), with the same
    // `{ rows, total }` contract as the notifications list.
    it("returns one page plus the total for the same filters, and honours offset", async () => {
        const hr = await createRootHr({ email: "browse-page-hr@example.com" });
        const employee = await createUser({ email: "browse-page-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Browse Page Leave" });
        // Five requests on distinct, descending-sortable dates.
        // Mon 3rd to Fri 7th of January 2033 — weekdays, since a
        // weekend-only request is rejected for having no working days.
        for (let day = 3; day <= 7; day += 1) {
            await createLeaveRequest({
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                startDate: `2033-01-0${day}`,
                endDate: `2033-01-0${day}`,
            });
        }
        const hrAgent = await loginAs(hr);

        const firstPage = await hrAgent.get("/api/leave-requests").query({ limit: 2, offset: 0 });
        expect(firstPage.statusCode).toBe(200);
        expect(firstPage.body.data.requests).toHaveLength(2);
        // `total` counts every matching row, not the page.
        expect(firstPage.body.data.total).toBe(5);
        // Newest first, so the page starts at the 5th of January.
        expect(firstPage.body.data.requests[0].start_date).toContain("2033-01-07");

        const secondPage = await hrAgent.get("/api/leave-requests").query({ limit: 2, offset: 2 });
        expect(secondPage.body.data.requests).toHaveLength(2);
        expect(secondPage.body.data.total).toBe(5);
        // No overlap with page 1.
        const firstIds = firstPage.body.data.requests.map((row) => row.id);
        expect(secondPage.body.data.requests.some((row) => firstIds.includes(row.id))).toBe(false);

        const lastPage = await hrAgent.get("/api/leave-requests").query({ limit: 2, offset: 4 });
        expect(lastPage.body.data.requests).toHaveLength(1);
    });

    it("counts the filtered set, not the whole scope", async () => {
        const hr = await createRootHr({ email: "browse-count-hr@example.com" });
        const employeeA = await createUser({ email: "browse-count-a@example.com", managerId: hr.id });
        const employeeB = await createUser({ email: "browse-count-b@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Browse Count Leave" });
        await createLeaveRequest({
            employeeId: employeeA.id,
            leaveTypeId: leaveType.id,
            startDate: "2033-02-01",
            endDate: "2033-02-02",
        });
        await createLeaveRequest({
            employeeId: employeeB.id,
            leaveTypeId: leaveType.id,
            startDate: "2033-02-03",
            endDate: "2033-02-04",
        });
        const hrAgent = await loginAs(hr);

        const all = await hrAgent.get("/api/leave-requests");
        expect(all.body.data.total).toBe(2);

        const filtered = await hrAgent.get("/api/leave-requests").query({ employeeId: employeeA.id });
        expect(filtered.body.data.total).toBe(1);
        expect(filtered.body.data.requests).toHaveLength(1);
    });

    it("rejects a limit above the cap so nobody can ask for the whole table", async () => {
        const hr = await createRootHr({ email: "browse-cap-hr@example.com" });
        const hrAgent = await loginAs(hr);

        expect((await hrAgent.get("/api/leave-requests").query({ limit: 5000 })).statusCode).toBe(422);
        expect((await hrAgent.get("/api/leave-requests").query({ offset: -1 })).statusCode).toBe(422);
    });
});

describe("GET /api/leave-requests/report (leave taken per employee)", () => {
    it("rejects a non-HR caller", async () => {
        const employee = await createUser({ email: "report-employee@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.get("/api/leave-requests/report").query({ startDate: "2031-01-01", endDate: "2031-12-31" });
        expect(response.statusCode).toBe(403);
    });

    it("requires both startDate and endDate", async () => {
        const hr = await createRootHr({ email: "report-hr-norange@example.com" });
        const hrAgent = await loginAs(hr);

        const response = await hrAgent.get("/api/leave-requests/report");
        expect(response.statusCode).toBe(422);
    });

    it("sums an employee's approved days across multiple requests, and counts them", async () => {
        const hr = await createRootHr({ email: "report-hr-sum@example.com" });
        const employee = await createUser({ email: "report-sum-emp@example.com", managerId: hr.id, firstName: "Asha" });
        const leaveType = await createLeaveType({ name: "Report Sum Leave" });
        const hrAgent = await loginAs(hr);

        const first = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2031-08-04", endDate: "2031-08-05" });
        const second = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2031-08-11", endDate: "2031-08-11" });
        await hrAgent.post(`/api/leave-requests/${first.id}/approve`).send({});
        await hrAgent.post(`/api/leave-requests/${second.id}/approve`).send({});

        const response = await hrAgent.get("/api/leave-requests/report").query({ startDate: "2031-08-01", endDate: "2031-08-31" });

        expect(response.statusCode).toBe(200);
        const row = response.body.data.find((r) => r.employee_id === employee.id);
        expect(row).toMatchObject({ employee_first_name: "Asha", request_count: 2 });
        expect(Number(row.total_days_taken)).toBe(3);
    });

    it("excludes non-approved requests (pending, rejected, withdrawn) from the total", async () => {
        const hr = await createRootHr({ email: "report-hr-exclude@example.com" });
        const employee = await createUser({ email: "report-exclude-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Report Exclude Leave" });
        const hrAgent = await loginAs(hr);
        const employeeAgent = await loginAs(employee);

        const pending = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2031-09-01", endDate: "2031-09-02" });
        const rejected = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2031-09-05", endDate: "2031-09-06" });
        const withdrawn = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2031-09-10", endDate: "2031-09-11" });
        await hrAgent.post(`/api/leave-requests/${rejected.id}/reject`).send({});
        await employeeAgent.post(`/api/leave-requests/${withdrawn.id}/withdraw`).send({});
        void pending; // left SUBMITTED deliberately

        const response = await hrAgent.get("/api/leave-requests/report").query({ startDate: "2031-09-01", endDate: "2031-09-30" });

        expect(response.body.data.find((r) => r.employee_id === employee.id)).toBeUndefined();
    });

    it("counts a request's full working days even when only part of its range falls inside the period", async () => {
        const hr = await createRootHr({ email: "report-hr-partial@example.com" });
        const employee = await createUser({ email: "report-partial-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Report Partial Leave" });
        const hrAgent = await loginAs(hr);

        // 5 calendar days (Mon-Fri), only 2 of which fall in the October
        // period being reported on — counted in full regardless (see
        // findLeaveTakenReport's documented simplification).
        const spanning = await createLeaveRequest({
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            startDate: "2031-09-29",
            endDate: "2031-10-03",
        });
        await hrAgent.post(`/api/leave-requests/${spanning.id}/approve`).send({});

        const response = await hrAgent.get("/api/leave-requests/report").query({ startDate: "2031-10-01", endDate: "2031-10-31" });

        const row = response.body.data.find((r) => r.employee_id === employee.id);
        expect(row.request_count).toBe(1);
        expect(Number(row.total_days_taken)).toBe(Number(spanning.working_days));
    });

    it("scopes to the caller's own reporting subtree — one HR admin's report excludes another HR admin's branch", async () => {
        const hrA = await createRootHr({ email: "report-hr-scope-a@example.com" });
        const hrB = await createRootHr({ email: "report-hr-scope-b@example.com" });
        const employeeOfB = await createUser({ email: "report-scope-b-emp@example.com", managerId: hrB.id });
        const leaveType = await createLeaveType({ name: "Report Scope Leave" });
        const hrBAgent = await loginAs(hrB);

        const request = await createLeaveRequest({ employeeId: employeeOfB.id, leaveTypeId: leaveType.id, startDate: "2031-12-01", endDate: "2031-12-02" });
        await hrBAgent.post(`/api/leave-requests/${request.id}/approve`).send({});

        const hrAAgent = await loginAs(hrA);
        const response = await hrAAgent.get("/api/leave-requests/report").query({ startDate: "2031-12-01", endDate: "2031-12-31" });

        expect(response.body.data.find((r) => r.employee_id === employeeOfB.id)).toBeUndefined();
    });

    it("reports on every employee for SUPER_ADMIN, whatever branch they're in", async () => {
        const superAdmin = await createSuperAdmin({ email: "report-super@example.com" });
        const hr = await createRootHr({ email: "report-super-hr@example.com", managerId: null });
        const deepEmployee = await createUser({ email: "report-super-emp@example.com", managerId: hr.id });
        const leaveType = await createLeaveType({ name: "Report Super Leave" });
        const hrAgent = await loginAs(hr);
        const request = await createLeaveRequest({
            employeeId: deepEmployee.id,
            leaveTypeId: leaveType.id,
            startDate: "2031-11-03",
            endDate: "2031-11-04",
        });
        await hrAgent.post(`/api/leave-requests/${request.id}/approve`).send({});

        const superAgent = await loginAs(superAdmin);
        const response = await superAgent.get("/api/leave-requests/report").query({
            startDate: "2031-11-01",
            endDate: "2031-11-30",
        });

        expect(response.statusCode).toBe(200);
        const row = response.body.data.find((r) => r.employee_id === deepEmployee.id);
        expect(row).toBeDefined();
        expect(Number(row.total_days_taken)).toBeGreaterThan(0);
    });
});

describe("GET /api/leave-requests/report/csv", () => {
    it("rejects a non-HR caller", async () => {
        const employee = await createUser({ email: "csv-employee@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.get("/api/leave-requests/report/csv").query({ startDate: "2031-01-01", endDate: "2031-12-31" });
        expect(response.statusCode).toBe(403);
    });

    it("streams a CSV with the expected headers, filename, and rows", async () => {
        const hr = await createRootHr({ email: "csv-hr@example.com" });
        const employee = await createUser({ email: "csv-emp@example.com", managerId: hr.id, firstName: "Priya", lastName: "Sharma" });
        const leaveType = await createLeaveType({ name: "CSV Report Leave" });
        const hrAgent = await loginAs(hr);

        const request = await createLeaveRequest({ employeeId: employee.id, leaveTypeId: leaveType.id, startDate: "2031-11-03", endDate: "2031-11-04" });
        await hrAgent.post(`/api/leave-requests/${request.id}/approve`).send({});

        const response = await hrAgent.get("/api/leave-requests/report/csv").query({ startDate: "2031-11-01", endDate: "2031-11-30" });

        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toContain("text/csv");
        expect(response.headers["content-disposition"]).toContain('filename="leave-report-2031-11-01-to-2031-11-30.csv"');
        expect(response.text).toContain("First Name,Last Name,Role,Requests,Total Days Taken");
        expect(response.text).toContain("Priya,Sharma,EMPLOYEE,1,2");
    });
});
