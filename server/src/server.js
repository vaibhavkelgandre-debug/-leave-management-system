import dotenv from "dotenv";
import app from "./app.js";
import pool from "./config/db.js";

// Loads server/.env into process.env — must happen before anything reads
// config like DB credentials or the HR registration code.
dotenv.config();

const PORT = process.env.PORT || 5001;

// Bind to 0.0.0.0 (not just localhost) so the server is reachable inside
// containers/VMs where the host network isn't loopback.
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});

// Ensures in-flight requests finish and the DB pool is closed cleanly before
// the process exits, instead of dropping connections when the host stops the container/process.
function shutdown() {
    server.close(() => {
        pool.end().then(() => process.exit(0));
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
