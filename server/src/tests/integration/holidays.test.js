import request from "supertest";
import app from "../../app.js";
import { describe, it, expect } from "vitest";
import { createRootHr, createUser, createHoliday } from "./helpers/factories.js";
import { loginAs } from "./helpers/authHelpers.js";

describe("Holidays", () => {
    it("requires authentication", async () => {
        const response = await request(app).get("/api/holidays");
        expect(response.statusCode).toBe(401);
    });

    it("lets HR create, update and delete a holiday", async () => {
        const hr = await createRootHr({ email: "hr-holidays-crud@example.com" });
        const agent = await loginAs(hr);

        const created = await agent.post("/api/holidays").send({ name: "New Year", holidayDate: "2027-01-01" });
        expect(created.statusCode).toBe(201);

        const updated = await agent
            .patch(`/api/holidays/${created.body.data.id}`)
            .send({ name: "New Year's Day", holidayDate: "2027-01-01" });
        expect(updated.statusCode).toBe(200);
        expect(updated.body.data.name).toBe("New Year's Day");

        const deleted = await agent.delete(`/api/holidays/${created.body.data.id}`);
        expect(deleted.statusCode).toBe(200);

        const list = await agent.get("/api/holidays");
        expect(list.body.data.find((h) => h.id === created.body.data.id)).toBeUndefined();
    });

    it("rejects writes from a non-HR caller", async () => {
        const employee = await createUser({ role: "EMPLOYEE", email: "emp-holidays-write@example.com" });
        const agent = await loginAs(employee);

        const response = await agent.post("/api/holidays").send({ name: "Fake Holiday", holidayDate: "2027-05-01" });
        expect(response.statusCode).toBe(403);
    });

    it("rejects a duplicate holiday date", async () => {
        const hr = await createRootHr({ email: "hr-holidays-dup@example.com" });
        const agent = await loginAs(hr);

        await createHoliday({ name: "Independence Day", holidayDate: "2027-08-15" });
        const response = await agent.post("/api/holidays").send({ name: "Another Name", holidayDate: "2027-08-15" });

        expect(response.statusCode).toBe(409);
    });

    it("filters by year", async () => {
        const hr = await createRootHr({ email: "hr-holidays-filter@example.com" });
        const agent = await loginAs(hr);

        await createHoliday({ name: "2026 Holiday", holidayDate: "2026-12-25" });
        await createHoliday({ name: "2027 Holiday", holidayDate: "2027-12-25" });

        const response = await agent.get("/api/holidays?year=2026");
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe("2026 Holiday");
    });
});
