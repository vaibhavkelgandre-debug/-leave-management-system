// The migration ledger: what has been applied to *this* database, so a run
// applies only what's new instead of replaying all 37 files and hoping every
// one of them is idempotent.
//
// Everything here takes its pool, its SQL directory and its table name as
// arguments rather than reaching for the shared ones. That isn't ceremony —
// it's the only way the tests can exercise this against throwaway .sql files
// and a throwaway ledger table without touching the real schema they run
// alongside. `runMigrations.js` supplies the real defaults.
//
// Deliberately not a `services/` module despite the name shape: nothing in
// the request path may ever import this. It runs from a CLI, against a
// database that might be mid-migration, and it acquires a session-scoped
// advisory lock — none of which belongs behind an HTTP handler.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_TABLE = "schema_migrations";

// One fixed key for the whole runner. Two concurrent deploys must serialize
// rather than interleave: without this, both would read the same pending list
// and both would try to apply it, and the loser gets a duplicate-key error
// halfway through a migration rather than simply waiting its turn.
const ADVISORY_LOCK_KEY = 907531014;

// A file may opt out of being wrapped in a transaction. Nothing in src/sql/
// needs this today, but `CREATE INDEX CONCURRENTLY` cannot run inside one, and
// that's exactly the kind of migration a performance fix reaches for — better
// to have the escape hatch than to have someone discover the constraint at
// 2am and wrap the whole runner in a workaround.
const NO_TRANSACTION_MARKER = "-- migrate:no-transaction";

// Hash the LF-normalized content, never the raw bytes. `core.autocrlf=true` is
// set in this repo, so every .sql file is LF in git and CRLF in a Windows
// working tree — hashing raw bytes would make the identical migration hash
// differently on a developer's machine than on Render, and *every* run would
// then fail with a checksum mismatch that means nothing. This is the one
// non-obvious line in this file.
export function checksumOf(sql) {
    return crypto.createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
}

// Input: a directory. Output: every .sql file in filename order, with its
// content, checksum and transaction preference. Sorted lexicographically,
// which is why the files are zero-padded (`002_…` not `2_…`) — 10 would sort
// before 2 otherwise.
export function readMigrationFiles(dir) {
    return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".sql"))
        .sort()
        .map((filename) => {
            const sql = fs.readFileSync(path.join(dir, filename), "utf8");
            return {
                filename,
                sql,
                checksum: checksumOf(sql),
                useTransaction: !sql.includes(NO_TRANSACTION_MARKER),
            };
        });
}

// Created by the runner rather than by a migration file, because a migration
// that creates the migration ledger can't be recorded in the ledger it's
// creating. `IF NOT EXISTS` so this is safe on every run.
export async function ensureLedger(client, table = DEFAULT_TABLE) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS ${table} (
            filename    text PRIMARY KEY,
            checksum    text NOT NULL,
            applied_at  timestamptz NOT NULL DEFAULT now(),
            duration_ms integer NOT NULL
        )
    `);
}

async function appliedChecksums(client, table) {
    const result = await client.query(`SELECT filename, checksum FROM ${table}`);
    return new Map(result.rows.map((row) => [row.filename, row.checksum]));
}

// Compares what's on disk against what's recorded, without changing anything.
// Three categories, and they answer three different questions:
//   pending  — what a run would apply
//   changed  — an applied file whose content no longer matches what was
//              applied, meaning environments have silently diverged
//   orphaned — recorded but no longer on disk (a rename or deletion)
export async function inspect({ pool, dir, table = DEFAULT_TABLE }) {
    const client = await pool.connect();
    try {
        await ensureLedger(client, table);
        const applied = await appliedChecksums(client, table);
        const files = readMigrationFiles(dir);

        const pending = files.filter((file) => !applied.has(file.filename));
        const changed = files.filter(
            (file) => applied.has(file.filename) && applied.get(file.filename) !== file.checksum
        );
        const onDisk = new Set(files.map((file) => file.filename));
        const orphaned = [...applied.keys()].filter((filename) => !onDisk.has(filename)).sort();

        return { files, applied, pending, changed, orphaned };
    } finally {
        client.release();
    }
}

// Applies every pending file, in order, each in its own transaction together
// with its ledger row — so a file either fully applies and is recorded, or
// neither. A failure stops the run rather than skipping ahead: migration 040
// almost certainly assumes 039 landed.
//
// A changed checksum aborts before anything is applied. That's deliberately
// fatal rather than a warning: it means a file that already ran was edited, so
// this database and every other one are now running different schemas, and
// continuing would paper over that.
export async function applyPending({ pool, dir, table = DEFAULT_TABLE, log = console.log }) {
    const client = await pool.connect();

    try {
        // Session-scoped, so it must be taken on the same client that does the
        // work — pool.query() could hand each statement a different connection
        // and the lock would guard nothing.
        await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
        await ensureLedger(client, table);

        const applied = await appliedChecksums(client, table);
        const files = readMigrationFiles(dir);

        const changed = files.filter(
            (file) => applied.has(file.filename) && applied.get(file.filename) !== file.checksum
        );
        if (changed.length) {
            throw new Error(
                `Refusing to run: ${changed.length} already-applied migration(s) have been edited ` +
                    `(${changed.map((file) => file.filename).join(", ")}). An applied migration must never ` +
                    `change — add a new file instead. If the edit was intentional and every environment is ` +
                    `already correct, update the recorded checksum by hand.`
            );
        }

        const pending = files.filter((file) => !applied.has(file.filename));
        if (!pending.length) {
            log(`Nothing to apply — all ${files.length} migration(s) already recorded.`);
            return [];
        }

        const results = [];
        for (const file of pending) {
            const startedAt = Date.now();
            log(`Applying ${file.filename}...`);

            if (file.useTransaction) await client.query("BEGIN");
            try {
                await client.query(file.sql);
                const durationMs = Date.now() - startedAt;
                await client.query(
                    `INSERT INTO ${table} (filename, checksum, duration_ms) VALUES ($1, $2, $3)`,
                    [file.filename, file.checksum, durationMs]
                );
                if (file.useTransaction) await client.query("COMMIT");
                results.push({ filename: file.filename, durationMs });
                log(`  ✔ ${file.filename} (${durationMs}ms)`);
            } catch (error) {
                if (file.useTransaction) await client.query("ROLLBACK").catch(() => {});
                throw new Error(`${file.filename} failed: ${error.message}`);
            }
        }

        log(`Applied ${results.length} migration(s); ${files.length - results.length} already recorded.`);
        return results;
    } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
        client.release();
    }
}

// Records every file on disk as applied **without executing any of it** — the
// one-off step for a database that already has the whole schema but no ledger,
// which is every environment that existed before this file did.
//
// Refuses when the ledger already has rows, because the only correct time to
// baseline is once. A second baseline would silently mark genuinely-unapplied
// migrations as done, which is the one way this system can lose schema
// changes — and it would do it quietly.
//
// `apply` defaults to false so the CLI can show exactly what it would record
// and change nothing. A dry run by default beats a confirmation prompt: it
// works identically over SSH, in CI, and in a non-interactive shell.
export async function baseline({ pool, dir, table = DEFAULT_TABLE, apply = false, log = console.log }) {
    const client = await pool.connect();

    try {
        await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
        await ensureLedger(client, table);

        const existing = await appliedChecksums(client, table);
        if (existing.size) {
            throw new Error(
                `Refusing to baseline: ${table} already records ${existing.size} migration(s). ` +
                    `Baselining is a one-time step for a database that predates the ledger. If this database ` +
                    `genuinely needs migrations applied, run the migrate command instead.`
            );
        }

        const files = readMigrationFiles(dir);
        if (!apply) {
            log(`Dry run — would record ${files.length} migration(s) as already applied, without executing them:`);
            for (const file of files) log(`  · ${file.filename}`);
            log("Re-run with --yes to write these rows.");
            return [];
        }

        for (const file of files) {
            await client.query(
                `INSERT INTO ${table} (filename, checksum, duration_ms) VALUES ($1, $2, 0)`,
                [file.filename, file.checksum]
            );
        }

        log(`Baselined: recorded ${files.length} migration(s) as applied. Nothing was executed.`);
        return files.map((file) => file.filename);
    } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
        client.release();
    }
}
