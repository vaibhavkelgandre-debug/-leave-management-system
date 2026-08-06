import request from "supertest";
import app from "../../../app.js";
import { DEFAULT_PASSWORD } from "./factories.js";

export async function loginAs(user, password = user.password || DEFAULT_PASSWORD) {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: user.email, password }).expect(200);
    return agent;
}
