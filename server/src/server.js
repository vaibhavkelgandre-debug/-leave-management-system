import dotenv from "dotenv";
import app from "./app.js";
import pool from "./config/db.js";
import { isMailConfigured } from "./config/mailer.js";
import { describeMailFeatures } from "./config/mailFeatures.js";
import { sweepDelegationTransitions } from "./services/notificationSweepService.js";

// Loads server/.env into process.env — must happen before anything reads
// config like DB credentials or the HR registration code.
dotenv.config();

const PORT = process.env.PORT || 5001;

// Surface a missing mail/link setup at boot rather than the first time
// someone tries to reset their password — that path deliberately swallows
// send failures (see passwordResetService.js), so a misconfiguration would
// otherwise be indistinguishable from a working flow. Log-only and never
// fatal: the rest of the app is entirely usable without email, and refusing
// to start would be a worse outcome than a degraded reset flow. Note this
// file is never loaded by the tests, which import app.js directly.
if (!isMailConfigured()) {
    console.warn("Mail provider is not configured — no email will be sent (links are logged instead)");
}
// Which flows are switched on, resolved from the environment (see
// config/mailFeatures.js). Printed rather than left implicit because a
// disabled flow looks exactly like a broken one from the outside: this is
// where "the invite email never arrived" gets answered in one line.
for (const feature of describeMailFeatures()) {
    console.log(`[mail] ${feature.enabled ? "on " : "off"} ${feature.envVar} — ${feature.description}`);
}
// Required by both the reset and invite links; without it they'd be built
// against "undefined" and sent to real people as dead URLs.
if (!process.env.CLIENT_BASE_URL) {
    console.error("CLIENT_BASE_URL is not set — password reset and invite links cannot be built");
}

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
