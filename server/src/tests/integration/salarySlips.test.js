// Module 5 v2 (FR-025): payroll calculated from a salary_structures row +
// LOP (loss of pay) derived from approved leave — no CSV upload. Covers
// calculate/confirm, subtree scoping for HR, the employee/HR-only
// visibility rule, and the PDF download.
import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import pool from "../../config/db.js";
import {
    createRootHr,
    createUser,
    createLeaveType,
    createLeaveRequest,
    verifyEmployeeProfile,
    createSalaryStructure,
} from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

function daysInMonth(payPeriod) {
    const [year, month] = payPeriod.split("-").map(Number);
    return new Date(year, month, 0).getDate();
}

// Every test below needs a pay period that has already started (see
// assertPeriodStarted in salarySlipService.js) — computed relative to "now"
// rather than a hardcoded literal, so this suite doesn't quietly start
// failing once real time catches up to whatever year was hardcoded. Each
// call site uses a distinct offset purely so slips from different tests
// never share a (employee_id, pay_period) key by coincidence.
function monthsAgo(offset) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// First Monday-Friday day of a "YYYY-MM" period, for LOP tests that need a
// guaranteed working day without hardcoding a specific date/weekday pair.
function firstWeekdayOf(payPeriod) {
    const [year, month] = payPeriod.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
    }
    return `${payPeriod}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("Salary slips (calculated payroll)", () => {
    it("requires authentication on every route", async () => {
        expect((await request(app).post("/api/salary-slips/calculate")).statusCode).toBe(401);
        expect((await request(app).post("/api/salary-slips/confirm")).statusCode).toBe(401);
        expect((await request(app).get("/api/salary-slips/mine")).statusCode).toBe(401);
        expect((await request(app).get("/api/salary-slips")).statusCode).toBe(401);
        expect((await request(app).get("/api/salary-slips/00000000-0000-0000-0000-000000000000")).statusCode).toBe(401);
    });

    it("rejects calculate and confirm from a non-HR caller", async () => {
        const employee = await createUser({ email: "slip-nonhr@example.com" });
        const agent = await loginAs(employee);

        const payPeriod = monthsAgo(1);
        expect((await agent.post("/api/salary-slips/calculate").send({ payPeriod })).statusCode).toBe(403);
        expect((await agent.post("/api/salary-slips/confirm").send({ payPeriod })).statusCode).toBe(403);
    });

    it("skips an unverified employee, and one with no salary structure, without failing the run", async () => {
        const hr = await createRootHr({ email: "slip-skip-hr@example.com" });
        const unverified = await createUser({ email: "slip-skip-unverified@example.com", managerId: hr.id });
        const noStructure = await createUser({ email: "slip-skip-nostructure@example.com", managerId: hr.id });
        await verifyEmployeeProfile(noStructure.id, hr.id);
        const agent = await loginAs(hr);

        const response = await agent.post("/api/salary-slips/calculate").send({ payPeriod: monthsAgo(2) });

        expect(response.statusCode).toBe(200);
        expect(response.body.data.summary).toEqual({ total: 2, ok: 0, skipped: 2 });
        const unverifiedRow = response.body.data.rows.find((row) => row.employeeId === unverified.id);
        const noStructureRow = response.body.data.rows.find((row) => row.employeeId === noStructure.id);
        expect(unverifiedRow.skipReason).toMatch(/not yet verified/i);
        expect(noStructureRow.skipReason).toMatch(/no salary structure/i);
    });

    it("calculates net pay from the structure, writing nothing until confirmed", async () => {
        const hr = await createRootHr({ email: "slip-calc-hr@example.com" });
        const employee = await createUser({ email: "slip-calc-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        const agent = await loginAs(hr);

        const before = await pool.query("SELECT COUNT(*)::int AS count FROM salary_slips");
        const response = await agent.post("/api/salary-slips/calculate").send({ payPeriod: monthsAgo(3) });
        const after = await pool.query("SELECT COUNT(*)::int AS count FROM salary_slips");

        expect(response.statusCode).toBe(200);
        const row = response.body.data.rows.find((r) => r.employeeId === employee.id);
        expect(row.status).toBe("ok");
        expect(row.computed.lopDays).toBe(0);
        expect(row.computed.netPay).toBe(30000 + 12000 + 5000 - 1800 - 0 - 0);
        expect(after.rows[0].count).toBe(before.rows[0].count);
    });

    it("deducts LOP for an approved day of a leave type flagged counts_as_lop", async () => {
        const hr = await createRootHr({ email: "slip-lop-hr@example.com" });
        const employee = await createUser({ email: "slip-lop-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        const payPeriod = monthsAgo(4);
        const lopType = await createLeaveType({ name: "Loss of Pay", countsAsLop: true });
        const request_ = await createLeaveRequest({
            employeeId: employee.id,
            leaveTypeId: lopType.id,
            startDate: firstWeekdayOf(payPeriod),
            endDate: firstWeekdayOf(payPeriod),
        });

        const hrAgent = await loginAs(hr);
        await hrAgent.post(`/api/leave-requests/${request_.id}/approve`).send({});

        const response = await hrAgent.post("/api/salary-slips/calculate").send({ payPeriod });
        const row = response.body.data.rows.find((r) => r.employeeId === employee.id);

        const perDayRate = (30000 + 12000 + 5000) / daysInMonth(payPeriod);
        const expectedLopDeduction = Math.round(perDayRate * 1 * 100) / 100;

        expect(row.computed.lopDays).toBe(1);
        expect(row.computed.lopDeduction).toBe(expectedLopDeduction);
        expect(row.computed.netPay).toBe(
            Math.round((30000 + 12000 + 5000 - 1800 - 0 - 0 - expectedLopDeduction) * 100) / 100
        );
    });

    it("rejects re-confirming an already-ACTIVE period, but confirms again once it's voided (archiving a revision)", async () => {
        const hr = await createRootHr({ email: "slip-confirm-hr@example.com" });
        const employee = await createUser({ email: "slip-confirm-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id, basicSalary: 30000 });
        const agent = await loginAs(hr);
        const payPeriod = monthsAgo(5);

        const firstConfirm = await agent.post("/api/salary-slips/confirm").send({ payPeriod });
        expect(firstConfirm.body.data.committed).toHaveLength(1);
        const slipId = firstConfirm.body.data.committed[0].id;

        // A second confirm without voiding first must not silently overwrite
        // the live slip — it's reported as skipped, and the figures on disk
        // are untouched, even though the structure changed in between.
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id, basicSalary: 35000 });
        const secondConfirm = await agent.post("/api/salary-slips/confirm").send({ payPeriod });
        expect(secondConfirm.body.data.committed).toHaveLength(0);
        expect(secondConfirm.body.data.skipped).toHaveLength(1);
        expect(secondConfirm.body.data.skipped[0].employeeId).toBe(employee.id);
        expect(secondConfirm.body.data.skipped[0].skipReason).toMatch(/void the existing slip first/i);

        const stillOriginal = await pool.query("SELECT basic_pay FROM salary_slips WHERE id = $1", [slipId]);
        expect(Number(stillOriginal.rows[0].basic_pay)).toBe(30000);

        await agent.post(`/api/salary-slips/${slipId}/void`).send({});

        const thirdConfirm = await agent.post("/api/salary-slips/confirm").send({ payPeriod });
        expect(thirdConfirm.body.data.committed).toHaveLength(1);
        expect(thirdConfirm.body.data.committed[0].id).toBe(slipId);
        expect(Number(thirdConfirm.body.data.committed[0].basic_pay)).toBe(35000);

        const revisions = await pool.query("SELECT * FROM salary_slip_revisions WHERE salary_slip_id = $1", [slipId]);
        expect(revisions.rows).toHaveLength(1);
        expect(Number(revisions.rows[0].basic_pay)).toBe(30000);

        const slips = await pool.query("SELECT COUNT(*)::int AS count FROM salary_slips WHERE employee_id = $1", [
            employee.id,
        ]);
        expect(slips.rows[0].count).toBe(1);
    });

    it("still previews full figures via calculate for a period that already has an ACTIVE slip — the guard only blocks confirm", async () => {
        const hr = await createRootHr({ email: "slip-preview-active-hr@example.com" });
        const employee = await createUser({ email: "slip-preview-active-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        const agent = await loginAs(hr);
        const payPeriod = monthsAgo(15);

        await agent.post("/api/salary-slips/confirm").send({ payPeriod });

        const preview = await agent.post("/api/salary-slips/calculate").send({ payPeriod });
        const row = preview.body.data.rows.find((r) => r.employeeId === employee.id);
        expect(row.status).toBe("ok");
        expect(row.computed).not.toBeNull();
    });

    it("rejects calculate and confirm for a pay period that hasn't started yet", async () => {
        const hr = await createRootHr({ email: "slip-future-hr@example.com" });
        const agent = await loginAs(hr);
        const now = new Date();
        const future = new Date(now.getFullYear(), now.getMonth() + 2, 1);
        const futurePeriod = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}`;

        const calcResponse = await agent.post("/api/salary-slips/calculate").send({ payPeriod: futurePeriod });
        expect(calcResponse.statusCode).toBe(400);

        const confirmResponse = await agent.post("/api/salary-slips/confirm").send({ payPeriod: futurePeriod });
        expect(confirmResponse.statusCode).toBe(400);
    });

    it("allows generating payroll mid-month, for the current period that has started but not finished", async () => {
        const hr = await createRootHr({ email: "slip-current-hr@example.com" });
        const employee = await createUser({ email: "slip-current-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        const agent = await loginAs(hr);
        const currentPeriod = monthsAgo(0);

        const response = await agent.post("/api/salary-slips/confirm").send({ payPeriod: currentPeriod });
        expect(response.statusCode).toBe(200);
        expect(response.body.data.committed).toHaveLength(1);
    });

    it("scopes payroll to the acting HR admin's own subtree", async () => {
        const hrA = await createRootHr({ email: "slip-scopea@example.com" });
        const hrB = await createRootHr({ email: "slip-scopeb@example.com" });
        const employeeOfB = await createUser({ email: "slip-scopeb-emp@example.com", managerId: hrB.id });
        await verifyEmployeeProfile(employeeOfB.id, hrB.id);
        await createSalaryStructure({ employeeId: employeeOfB.id, actorId: hrB.id });

        const agentB = await loginAs(hrB);
        await agentB.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(6) });

        const agentA = await loginAs(hrA);
        const listResponse = await agentA.get("/api/salary-slips");
        expect(listResponse.body.data).toHaveLength(0);
    });

    it("gives HR their own (empty) slip list on /mine, distinct from their team's slips on /", async () => {
        const hr = await createRootHr({ email: "slip-mine-hr@example.com" });
        const employee = await createUser({ email: "slip-mine-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });

        const hrAgent = await loginAs(hr);
        await hrAgent.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(7) });

        const mine = await hrAgent.get("/api/salary-slips/mine");
        expect(mine.body.data).toHaveLength(0);

        const team = await hrAgent.get("/api/salary-slips");
        expect(team.body.data).toHaveLength(1);
        expect(team.body.data[0].employee_id).toBe(employee.id);
    });

    it("narrows /mine to one pay period, and / to one role, without needing employeeId", async () => {
        const hr = await createRootHr({ email: "slip-filter-mine-role-hr@example.com" });
        const manager = await createUser({
            role: "MANAGER",
            email: "slip-filter-mine-role-mgr@example.com",
            managerId: hr.id,
        });
        const employee = await createUser({ email: "slip-filter-mine-role-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(manager.id, hr.id);
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: manager.id, actorId: hr.id });
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        const hrAgent = await loginAs(hr);
        const periodA = monthsAgo(9);
        const periodB = monthsAgo(10);

        await hrAgent.post("/api/salary-slips/confirm").send({ payPeriod: periodA });
        await hrAgent.post("/api/salary-slips/confirm").send({ payPeriod: periodB });

        const employeeAgent = await loginAs(employee);
        const mineFiltered = await employeeAgent.get(`/api/salary-slips/mine?payPeriod=${periodA}`);
        expect(mineFiltered.body.data).toHaveLength(1);
        expect(mineFiltered.body.data[0].pay_period).toBe(periodA);

        const roleFiltered = await hrAgent.get("/api/salary-slips?role=MANAGER");
        expect(roleFiltered.body.data).toHaveLength(2);
        expect(roleFiltered.body.data.every((slip) => slip.employee_id === manager.id)).toBe(true);
    });

    it("only calculates for employees matching an optional role/profileStatus filter", async () => {
        const hr = await createRootHr({ email: "slip-filter-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "slip-filter-mgr@example.com", managerId: hr.id });
        const employee = await createUser({ email: "slip-filter-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        // manager is left unverified/without a structure on purpose — the
        // role filter should exclude them before that would even matter.
        const agent = await loginAs(hr);
        const payPeriod = monthsAgo(8);

        const roleFiltered = await agent
            .post("/api/salary-slips/calculate")
            .send({ payPeriod, role: "EMPLOYEE" });
        expect(roleFiltered.body.data.rows.map((r) => r.employeeId)).toEqual([employee.id]);

        const statusFiltered = await agent
            .post("/api/salary-slips/calculate")
            .send({ payPeriod, profileStatus: "VERIFIED" });
        expect(statusFiltered.body.data.rows.map((r) => r.employeeId)).toEqual([employee.id]);
    });

    it("only confirms the same filtered slice a matching calculate call would preview", async () => {
        const hr = await createRootHr({ email: "slip-filter-confirm-hr@example.com" });
        const manager = await createUser({
            role: "MANAGER",
            email: "slip-filter-confirm-mgr@example.com",
            managerId: hr.id,
        });
        const employee = await createUser({ email: "slip-filter-confirm-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        await verifyEmployeeProfile(manager.id, hr.id);
        await createSalaryStructure({ employeeId: manager.id, actorId: hr.id });
        const agent = await loginAs(hr);

        const response = await agent
            .post("/api/salary-slips/confirm")
            .send({ payPeriod: monthsAgo(9), role: "EMPLOYEE" });

        expect(response.body.data.committed).toHaveLength(1);
        expect(response.body.data.committed[0].employee_id).toBe(employee.id);
    });

    it("lets HR void a slip generated for the wrong pay period, and rejects voiding it twice", async () => {
        const hr = await createRootHr({ email: "slip-void-hr@example.com" });
        const employee = await createUser({ email: "slip-void-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        const agent = await loginAs(hr);

        const confirmResponse = await agent.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(10) });
        const slipId = confirmResponse.body.data.committed[0].id;

        const voidResponse = await agent
            .post(`/api/salary-slips/${slipId}/void`)
            .send({ reason: "Generated for the wrong month" });
        expect(voidResponse.statusCode).toBe(200);
        expect(voidResponse.body.data.status).toBe("VOIDED");

        const fetchAfterVoid = await agent.get(`/api/salary-slips/${slipId}`);
        expect(fetchAfterVoid.body.data.status).toBe("VOIDED");
        expect(fetchAfterVoid.body.data.void_reason).toBe("Generated for the wrong month");

        const secondVoid = await agent.post(`/api/salary-slips/${slipId}/void`).send({});
        expect(secondVoid.statusCode).toBe(409);
    });

    it("rejects voiding from a non-HR caller and from an HR admin outside the slip's subtree", async () => {
        const hr = await createRootHr({ email: "slip-void-authz-hr@example.com" });
        const outsiderHr = await createRootHr({ email: "slip-void-authz-outsider-hr@example.com" });
        const employee = await createUser({ email: "slip-void-authz-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });

        const hrAgent = await loginAs(hr);
        const confirmResponse = await hrAgent.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(11) });
        const slipId = confirmResponse.body.data.committed[0].id;

        const employeeAgent = await loginAs(employee);
        expect((await employeeAgent.post(`/api/salary-slips/${slipId}/void`).send({})).statusCode).toBe(403);

        const outsiderAgent = await loginAs(outsiderHr);
        expect((await outsiderAgent.post(`/api/salary-slips/${slipId}/void`).send({})).statusCode).toBe(404);
    });

    it("re-confirming a voided period supersedes the void — the slip is ACTIVE again", async () => {
        const hr = await createRootHr({ email: "slip-void-reconfirm-hr@example.com" });
        const employee = await createUser({ email: "slip-void-reconfirm-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });
        const agent = await loginAs(hr);
        const payPeriod = monthsAgo(12);

        const firstConfirm = await agent.post("/api/salary-slips/confirm").send({ payPeriod });
        const slipId = firstConfirm.body.data.committed[0].id;
        await agent.post(`/api/salary-slips/${slipId}/void`).send({});

        const secondConfirm = await agent.post("/api/salary-slips/confirm").send({ payPeriod });
        expect(secondConfirm.body.data.committed[0].id).toBe(slipId);
        expect(secondConfirm.body.data.committed[0].status).toBe("ACTIVE");
    });

    it("shows a slip to its employee and to HR, never to their manager, and serves a PDF only to those two", async () => {
        const hr = await createRootHr({ email: "slip-visibility-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "slip-visibility-mgr@example.com", managerId: hr.id });
        const employee = await createUser({ email: "slip-visibility-emp@example.com", managerId: manager.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });

        const hrAgent = await loginAs(hr);
        const confirmResponse = await hrAgent.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(13) });
        const slipId = confirmResponse.body.data.committed[0].id;

        const employeeAgent = await loginAs(employee);
        expect((await employeeAgent.get("/api/salary-slips/mine")).body.data).toHaveLength(1);
        expect((await employeeAgent.get(`/api/salary-slips/${slipId}`)).statusCode).toBe(200);
        const employeePdf = await employeeAgent.get(`/api/salary-slips/${slipId}/pdf`);
        expect(employeePdf.statusCode).toBe(200);
        expect(employeePdf.headers["content-type"]).toBe("application/pdf");

        expect((await hrAgent.get(`/api/salary-slips/${slipId}`)).statusCode).toBe(200);

        const managerAgent = await loginAs(manager);
        expect((await managerAgent.get(`/api/salary-slips/${slipId}`)).statusCode).toBe(404);
        expect((await managerAgent.get(`/api/salary-slips/${slipId}/pdf`)).statusCode).toBe(404);
        expect((await managerAgent.get("/api/salary-slips/mine")).body.data).toHaveLength(0);
    });

    it("defaults to a forced download, but serves inline for the in-app viewer via ?disposition=inline", async () => {
        const hr = await createRootHr({ email: "slip-disposition-hr@example.com" });
        const employee = await createUser({ email: "slip-disposition-emp@example.com", managerId: hr.id });
        await verifyEmployeeProfile(employee.id, hr.id);
        await createSalaryStructure({ employeeId: employee.id, actorId: hr.id });

        const hrAgent = await loginAs(hr);
        const confirmResponse = await hrAgent.post("/api/salary-slips/confirm").send({ payPeriod: monthsAgo(14) });
        const slipId = confirmResponse.body.data.committed[0].id;

        const employeeAgent = await loginAs(employee);
        const downloadResponse = await employeeAgent.get(`/api/salary-slips/${slipId}/pdf`);
        expect(downloadResponse.headers["content-disposition"]).toMatch(/^attachment;/);

        const viewResponse = await employeeAgent.get(`/api/salary-slips/${slipId}/pdf?disposition=inline`);
        expect(viewResponse.headers["content-disposition"]).toMatch(/^inline;/);

        // Any other value is treated the same as not passing one at all —
        // never interpolated into the header, so this can't be used to
        // inject an arbitrary Content-Disposition.
        const bogusResponse = await employeeAgent.get(`/api/salary-slips/${slipId}/pdf?disposition=whatever`);
        expect(bogusResponse.headers["content-disposition"]).toMatch(/^attachment;/);
    });
});
