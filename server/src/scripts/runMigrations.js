// CLI for the migration ledger. Three subcommands, one entry point:
//
//   node src/scripts/runMigrations.js              apply everything pending
//   node src/scripts/runMigrations.js status       report, change nothing
//   node src/scripts/runMigrations.js baseline     dry run; --yes to write
//
// The bare form is unchanged from when this file replayed every migration on
// every run, so `npm run migrate`, the READMEs and anyone's muscle memory all
// still work — it just applies only what's new now.
//
// Every subcommand prints the target database before touching it. That's not
// decoration: the same command is run against dev, `_test` and production
// Render from the same shell, the connection comes from an env var, and
// "which database did that just hit?" must never be a question you answer
// afterwards.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../config/db.js";
import { applyPending, baseline, inspect } from "./migrations.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(__dirname, "..", "sql");

// Read from the same env the pool did, rather than asking the pool for its
// config — DATABASE_URL and the discrete DB_* vars are two different shapes
// (see config/db.js) and only one of them is ever set.
function describeTarget() {
    if (process.env.DATABASE_URL) {
        try {
            const url = new URL(process.env.DATABASE_URL);
            // Never print the password, which is in this URL.
            return `${url.pathname.replace(/^\//, "")} on ${url.hostname} (via DATABASE_URL)`;
        } catch {
            return "(unparseable DATABASE_URL)";
        }
    }
    return `${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}`;
}

async function status() {
    const { files, applied, pending, changed, orphaned } = await inspect({ pool, dir: sqlDir });

    console.log(`${applied.size} of ${files.length} migration(s) recorded as applied.`);

    if (pending.length) {
        console.log(`\n${pending.length} pending:`);
        for (const file of pending) console.log(`  · ${file.filename}`);
    } else {
        console.log("Nothing pending.");
    }

    // Both of these are reported by `status` and fatal in `migrate` — seeing
    // them here is how you find out *before* a deploy rather than during one.
    if (changed.length) {
        console.log(`\n⚠ ${changed.length} applied migration(s) have been edited since they ran:`);
        for (const file of changed) console.log(`  · ${file.filename}`);
    }
    if (orphaned.length) {
        console.log(`\n⚠ ${orphaned.length} recorded migration(s) no longer exist on disk:`);
        for (const filename of orphaned) console.log(`  · ${filename}`);
    }
}

async function main() {
    const [command, ...flags] = process.argv.slice(2);
    console.log(`Target: ${describeTarget()}\n`);

    if (!command || command === "up") {
        await applyPending({ pool, dir: sqlDir });
        return;
    }
    if (command === "status") {
        await status();
        return;
    }
    if (command === "baseline") {
        await baseline({
            pool,
            dir: sqlDir,
            apply: flags.includes("--yes"),
            // Both flags required together on purpose — see the note in
            // migrations.js. This records unexecuted files as applied, which
            // is only ever right when the schema is known to be current.
            pendingOnly: flags.includes("--pending-only"),
        });
        return;
    }

    throw new Error(`Unknown command "${command}". Expected one of: up (default), status, baseline.`);
}

main()
    .then(() => pool.end())
    .catch(async (error) => {
        console.error("Migration failed:", error.message);
        await pool.end().catch(() => {});
        process.exit(1);
    });
