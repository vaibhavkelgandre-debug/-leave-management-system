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
