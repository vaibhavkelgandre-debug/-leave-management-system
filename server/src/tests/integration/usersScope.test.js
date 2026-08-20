import { describe, it, expect } from "vitest";
import { createRootHr, createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("GET /api/users (role-scoped visibility)", () => {
    it("scopes results by role and never leaks password_hash", async () => {
        const hr = await createRootHr({ email: "hr-scope@example.com" });
        const m1 = await createUser({ email: "m1@example.com", role: "MANAGER", managerId: hr.id });
        const m2 = await createUser({ email: "m2@example.com", role: "MANAGER", managerId: hr.id });
        const e1 = await createUser({ email: "e1@example.com", managerId: m1.id });
        await createUser({ email: "e2@example.com", managerId: m1.id });
        const e3 = await createUser({ email: "e3@example.com", managerId: m2.id });

        const hrAgent = await loginAs(hr);
        const hrResponse = await hrAgent.get("/api/users");
        expect(hrResponse.statusCode).toBe(200);
        expect(hrResponse.body.success).toBe(true);
        expect(hrResponse.body.data.length).toBe(6);
        expect(JSON.stringify(hrResponse.body)).not.toContain("password_hash");

        const m1Agent = await loginAs(m1);
        const m1Response = await m1Agent.get("/api/users");
        const m1Emails = m1Response.body.data.map((u) => u.email);
        expect(m1Emails).toContain(e1.email);
        expect(m1Emails).not.toContain(e3.email);

        const e1Agent = await loginAs(e1);
        const e1Response = await e1Agent.get("/api/users");
        expect(e1Response.body.data.length).toBe(1);
        expect(e1Response.body.data[0].email).toBe(e1.email);
    });
});

describe("Sensitive profile field masking", () => {
    it("shows PAN/Aadhar/passport/bank details in full to HR and self, but masks them for a manager", async () => {
        const hr = await createRootHr({ email: "mask-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "mask-mgr@example.com", managerId: hr.id });
        const employee = await createUser({ email: "mask-emp@example.com", managerId: manager.id });

        const employeeAgent = await loginAs(employee);
        await employeeAgent.patch("/api/users/me/profile").send({
            phone: "9876543210",
            currentAddress: "1 Example Street",
            panNumber: "ABCDE1234F",
            aadharNumber: "123456789012",
            passportNumber: "P1234567",
            bankAccountNumber: "000111222333",
        });

        const selfResponse = await employeeAgent.get(`/api/users/${employee.id}`);
        expect(selfResponse.body.data.pan_number).toBe("ABCDE1234F");
        expect(selfResponse.body.data.aadhar_number).toBe("123456789012");
        expect(selfResponse.body.data.passport_number).toBe("P1234567");

        const hrAgent = await loginAs(hr);
        const hrResponse = await hrAgent.get(`/api/users/${employee.id}`);
        expect(hrResponse.body.data.pan_number).toBe("ABCDE1234F");
        expect(hrResponse.body.data.passport_number).toBe("P1234567");
        expect(hrResponse.body.data.bank_account_number).toBe("000111222333");

        const managerAgent = await loginAs(manager);
        const managerResponse = await managerAgent.get(`/api/users/${employee.id}`);
        expect(managerResponse.body.data.pan_number).toBeNull();
        expect(managerResponse.body.data.aadhar_number).toBeNull();
        expect(managerResponse.body.data.passport_number).toBeNull();
        expect(managerResponse.body.data.bank_account_number).toBeNull();
        // Non-sensitive new profile fields are NOT masked for a manager.
        expect(managerResponse.body.data.phone).toBe("9876543210");
        expect(managerResponse.body.data.current_address).toBe("1 Example Street");
    });
});

// The picker-sized projection behind every dropdown in the app: same scoping
// rules as GET /users, five columns instead of ~40. It exists because four
// surfaces were fetching every profile field of every user (~240KB at 200
// people) purely to render a name in a <select>.
describe("GET /api/users/options (picker projection)", () => {
    it("returns only id, name, role and status — no profile or sensitive fields", async () => {
        const hr = await createRootHr({ email: "options-hr@example.com" });
        const employee = await createUser({ email: "options-emp@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);
        // Give the employee something in every sensitive column, so their
        // absence from the response is proof rather than coincidence.
        await (await loginAs(employee)).patch("/api/users/me/profile").send({
            panNumber: "ABCDE1234F",
            aadharNumber: "123456789012",
            bankAccountNumber: "000111222333",
            phone: "9876543210",
        });

        const response = await hrAgent.get("/api/users/options");

        expect(response.statusCode).toBe(200);
        const row = response.body.data.find((user) => user.id === employee.id);
        expect(Object.keys(row).sort()).toEqual(["first_name", "id", "last_name", "role", "status"]);
        expect(row.role).toBe("EMPLOYEE");
        // Explicitly: the columns masking exists for aren't merely masked here,
        // they're never selected.
        expect(row.pan_number).toBeUndefined();
        expect(row.aadhar_number).toBeUndefined();
        expect(row.bank_account_number).toBeUndefined();
        expect(row.password_hash).toBeUndefined();
    });

    it("scopes exactly like GET /users: company-wide for HR, subtree for a manager, self for an employee", async () => {
        const hr = await createRootHr({ email: "options-scope-hr@example.com" });
        const manager = await createUser({ role: "MANAGER", email: "options-scope-mgr@example.com", managerId: hr.id });
        const report = await createUser({ email: "options-scope-report@example.com", managerId: manager.id });
        const otherHr = await createRootHr({ email: "options-scope-otherhr@example.com" });
        const outsider = await createUser({ email: "options-scope-outsider@example.com", managerId: otherHr.id });

        const hrIds = (await (await loginAs(hr)).get("/api/users/options")).body.data.map((user) => user.id);
        expect(hrIds).toEqual(expect.arrayContaining([manager.id, report.id, outsider.id]));

        const managerRows = (await (await loginAs(manager)).get("/api/users/options")).body.data;
        const managerIds = managerRows.map((user) => user.id);
        expect(managerIds).toEqual(expect.arrayContaining([manager.id, report.id]));
        expect(managerIds).not.toContain(outsider.id);

        const employeeRows = (await (await loginAs(report)).get("/api/users/options")).body.data;
        expect(employeeRows.map((user) => user.id)).toEqual([report.id]);
    });

    it("requires authentication", async () => {
        const response = await (await import("supertest")).default(
            (await import("../../app.js")).default
        ).get("/api/users/options");
        expect(response.statusCode).toBe(401);
    });
});
