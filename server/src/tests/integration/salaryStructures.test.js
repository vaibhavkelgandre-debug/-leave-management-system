// Module 5 v2: the salary structure HR assigns once per employee.
import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../../app.js";
import { createRootHr, createUser } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

const STRUCTURE_BODY = {
    basicSalary: 40000,
    hra: 16000,
    pfEmployeeContribution: 2400,
    pfEmployerContribution: 2400,
    esic: 300,
    specialAllowance: 6000,
    incomeTax: 1500,
};

describe("Salary structures", () => {
    it("requires authentication", async () => {
        expect((await request(app).get("/api/employees/00000000-0000-0000-0000-000000000000/salary-structure")).statusCode).toBe(401);
    });

    it("rejects assignment from a non-HR caller", async () => {
        const employee = await createUser({ email: "structure-nonhr@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.patch(`/api/employees/${employee.id}/salary-structure`).send(STRUCTURE_BODY);
        expect(response.statusCode).toBe(403);
    });

    it("lets HR assign a structure within their subtree, visible to the employee and to HR", async () => {
        const hr = await createRootHr({ email: "structure-assign-hr@example.com" });
        const employee = await createUser({ email: "structure-assign-emp@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        const assignResponse = await hrAgent.patch(`/api/employees/${employee.id}/salary-structure`).send(STRUCTURE_BODY);
        expect(assignResponse.statusCode).toBe(200);
        expect(Number(assignResponse.body.data.basic_salary)).toBe(40000);

        const employeeAgent = await loginAs(employee);
        const employeeView = await employeeAgent.get(`/api/employees/${employee.id}/salary-structure`);
        expect(employeeView.statusCode).toBe(200);
        expect(Number(employeeView.body.data.hra)).toBe(16000);

        const hrView = await hrAgent.get(`/api/employees/${employee.id}/salary-structure`);
        expect(hrView.statusCode).toBe(200);
    });

    it("archives the previous values as a revision when HR updates an existing structure", async () => {
        const hr = await createRootHr({ email: "structure-revise-hr@example.com" });
        const employee = await createUser({ email: "structure-revise-emp@example.com", managerId: hr.id });
        const hrAgent = await loginAs(hr);

        await hrAgent.patch(`/api/employees/${employee.id}/salary-structure`).send(STRUCTURE_BODY);
        const revised = await hrAgent
            .patch(`/api/employees/${employee.id}/salary-structure`)
            .send({ ...STRUCTURE_BODY, basicSalary: 45000 });

        expect(revised.statusCode).toBe(200);
        expect(Number(revised.body.data.basic_salary)).toBe(45000);
    });

    it("keeps an employee outside HR's subtree out of reach", async () => {
        const hrA = await createRootHr({ email: "structure-scopea@example.com" });
        const hrB = await createRootHr({ email: "structure-scopeb@example.com" });
        const employeeOfB = await createUser({ email: "structure-scopeb-emp@example.com", managerId: hrB.id });

        const agentA = await loginAs(hrA);
        const response = await agentA.patch(`/api/employees/${employeeOfB.id}/salary-structure`).send(STRUCTURE_BODY);
        expect(response.statusCode).toBe(404);
    });
});
