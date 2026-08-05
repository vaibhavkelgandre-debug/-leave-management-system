import express from "express";
import cors from "cors";

import userRoutes from "./routes/userRoutes.js";

const app = express();
app.use(
    cors({
        origin: "http://localhost:5173",
    })
);



app.use(express.json());

app.use("/api/users", userRoutes);

export default app;