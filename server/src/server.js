import dotenv from "dotenv";
import app from "./app.js";
import pool from "./config/db.js";
import { sweepDelegationTransitions } from "./services/notificationSweepService.js";

// Loads server/.env into process.env — must happen before anything reads
// config like DB credentials or the HR registration code.
dotenv.config();

const PORT = process.env.PORT || 5001;

// Bind to 0.0.0.0 (not just localhost) so the server is reachable inside
// containers/VMs where the host network isn't loopback.
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});

// The only time-based (not request-driven) notification trigger in this
// app — see notificationSweepService.js. Hourly rather than daily so a
// same-day transition is never missed for long after a server restart;
// harmless to re-run within the same day since the sweep dedupes internally.
const DELEGATION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

function runDelegationSweep() {
    sweepDelegationTransitions().catch((error) => {
        console.error("Delegation notification sweep failed:", error.message);
    });
}

runDelegationSweep();
const delegationSweepInterval = setInterval(runDelegationSweep, DELEGATION_SWEEP_INTERVAL_MS);

// Ensures in-flight requests finish and the DB pool is closed cleanly before
// the process exits, instead of dropping connections when the host stops the container/process.
function shutdown() {
    clearInterval(delegationSweepInterval);
    server.close(() => {
        pool.end().then(() => process.exit(0));
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
