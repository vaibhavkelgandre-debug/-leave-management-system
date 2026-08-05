import request from "supertest";
import app from "../../app.js";
import {describe,it,expect} from "vitest";

describe("GET /api/users", () => {

    it("should return users data", async () => {

        const response = await request(app)
            .get("/api/users");

        expect(response.statusCode).toBe(200);

        expect(Array.isArray(response.body)).toBe(true);

    });

});