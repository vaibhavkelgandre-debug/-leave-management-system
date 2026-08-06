import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import leaveTypeRoutes from "./routes/leaveTypeRoutes.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";
import { sendSuccess } from "./utils/apiResponse.js";

const app = express();

// Needed so secure cookies (auth session) work correctly when the app sits behind
// a reverse proxy/load balancer (e.g. in production deployments).
app.set("trust proxy", 1);

// Only the configured frontend origin(s) may call this API with credentials —
// prevents arbitrary websites from making authenticated cross-origin requests.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim());

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

// Lightweight endpoint for uptime/monitoring checks (load balancers, deploy scripts)
// that doesn't require authentication or hit the database.
app.get("/health", (req, res) => {
    sendSuccess(res, 200, "ok", { uptime: process.uptime() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leave-types", leaveTypeRoutes);

// Catch-all for unmatched routes, then centralized error handling — keeps
// error response shaping (the { success, message, errors } envelope) in one place.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
