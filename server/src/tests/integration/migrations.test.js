// Tests for the migration ledger (src/scripts/migrations.js).
//
// These run against the same `_test` database as every other integration test,
// which is why nothing here uses the real ledger table or the real src/sql
// directory: each test gets a throwaway table name and a temp directory of
// disposable .sql files. Point these at the defaults and a failing test would
// corrupt the schema the other 295 tests depend on.
//
// Every table these migrations create is prefixed `zz_mig_` and dropped in
// afterAll — and deliberately not added to setup.js's TRUNCATE list, which
// must never learn about `schema_migrations` either: truncating the ledger
// between tests would make every run think the database was unmigrated.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import pool from "../../config/db.js";
import { applyPending, baseline, checksumOf, inspect, readMigrationFiles } from "../../scripts/migrations.js";

let dir;
let table;
const createdTables = new Set();

// A unique table per test, so a leftover row from one can't influence another.
function uniqueSuffix() {
    return Math.random().toString(36).slice(2, 10);
}

function writeMigration(filename, sql) {
    fs.writeFileSync(path.join(dir, filename), sql, "utf8");
}

// Each migration creates a real table, so "did it actually run?" is answerable
// by looking at the schema rather than by trusting the ledger we're testing.
function migrationCreating(name) {
    createdTables.add(name);
    return `CREATE TABLE IF NOT EXISTS ${name} (id integer PRIMARY KEY);`;
}

async function tableExists(name) {
    const result = await pool.query("SELECT to_regclass($1) AS oid", [name]);
    return result.rows[0].oid !== null;
}

async function ledgerRows() {
    const result = await pool.query(`SELECT filename, checksum, duration_ms FROM ${table} ORDER BY filename`);
    return result.rows;
}

const silent = () => {};

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "lms-migrations-"));
    table = `zz_mig_ledger_${uniqueSuffix()}`;
});

afterEach(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await pool.query(`DROP TABLE IF EXISTS ${table}`);
});

afterAll(async () => {
    for (const name of createdTables) {
        await pool.query(`DROP TABLE IF EXISTS ${name}`);
    }
});

describe("checksumOf", () => {
    it("ignores line endings, so the same file hashes alike on Windows and Linux", () => {
        // The repo sets core.autocrlf=true: every .sql file is LF in git and
        // CRLF in a Windows working tree. Hash the raw bytes and every run
        // fails with a meaningless mismatch.
        const lf = "CREATE TABLE a (id int);\nCREATE TABLE b (id int);\n";
        expect(checksumOf(lf.replace(/\n/g, "\r\n"))).toBe(checksumOf(lf));
    });

    it("still changes when the content actually changes", () => {
        expect(checksumOf("SELECT 1;")).not.toBe(checksumOf("SELECT 2;"));
    });
});

describe("readMigrationFiles", () => {
    it("returns .sql files in zero-padded filename order and ignores everything else", () => {
        writeMigration("010_ten.sql", "SELECT 1;");
        writeMigration("002_two.sql", "SELECT 1;");
        writeMigration("notes.md", "not a migration");

        expect(readMigrationFiles(dir).map((file) => file.filename)).toEqual(["002_two.sql", "010_ten.sql"]);
    });

    it("honours the no-transaction marker", () => {
        writeMigration("001_plain.sql", "SELECT 1;");
        writeMigration("002_concurrent.sql", "-- migrate:no-transaction\nSELECT 1;");

        const files = readMigrationFiles(dir);
        expect(files[0].useTransaction).toBe(true);
        expect(files[1].useTransaction).toBe(false);
    });
});

describe("applyPending", () => {
    it("applies pending files in order and records each one", async () => {
        const first = `zz_mig_a_${uniqueSuffix()}`;
        const second = `zz_mig_b_${uniqueSuffix()}`;
        writeMigration("001_a.sql", migrationCreating(first));
        writeMigration("002_b.sql", migrationCreating(second));

        const applied = await applyPending({ pool, dir, table, log: silent });

        expect(applied.map((entry) => entry.filename)).toEqual(["001_a.sql", "002_b.sql"]);
        expect(await tableExists(first)).toBe(true);
        expect(await tableExists(second)).toBe(true);
        expect((await ledgerRows()).map((row) => row.filename)).toEqual(["001_a.sql", "002_b.sql"]);
    });

    it("applies nothing on a second run", async () => {
        writeMigration("001_a.sql", migrationCreating(`zz_mig_repeat_${uniqueSuffix()}`));
        await applyPending({ pool, dir, table, log: silent });

        expect(await applyPending({ pool, dir, table, log: silent })).toEqual([]);
        expect(await ledgerRows()).toHaveLength(1);
    });

    it("applies only the new file when one is added later", async () => {
        writeMigration("001_a.sql", migrationCreating(`zz_mig_first_${uniqueSuffix()}`));
        await applyPending({ pool, dir, table, log: silent });

        const late = `zz_mig_late_${uniqueSuffix()}`;
        writeMigration("002_b.sql", migrationCreating(late));
        const applied = await applyPending({ pool, dir, table, log: silent });

        expect(applied.map((entry) => entry.filename)).toEqual(["002_b.sql"]);
        expect(await tableExists(late)).toBe(true);
    });

    it("rolls a failed migration back, records nothing, and does not run later files", async () => {
        const before = `zz_mig_before_${uniqueSuffix()}`;
        const after = `zz_mig_after_${uniqueSuffix()}`;
        const halfway = `zz_mig_halfway_${uniqueSuffix()}`;
        createdTables.add(halfway);

        writeMigration("001_ok.sql", migrationCreating(before));
        // Valid statement first, then a broken one: the first must not survive.
        writeMigration("002_broken.sql", `CREATE TABLE ${halfway} (id integer); SELECT * FROM nope_does_not_exist;`);
        writeMigration("003_never.sql", migrationCreating(after));

        await expect(applyPending({ pool, dir, table, log: silent })).rejects.toThrow(/002_broken\.sql failed/);

        expect(await tableExists(before)).toBe(true);
        expect(await tableExists(halfway)).toBe(false);
        expect(await tableExists(after)).toBe(false);
        expect((await ledgerRows()).map((row) => row.filename)).toEqual(["001_ok.sql"]);
    });

    it("refuses to run when an already-applied migration has been edited", async () => {
        writeMigration("001_a.sql", migrationCreating(`zz_mig_edited_${uniqueSuffix()}`));
        await applyPending({ pool, dir, table, log: silent });

        writeMigration("001_a.sql", "SELECT 1; -- edited after the fact");
        const untouched = `zz_mig_blocked_${uniqueSuffix()}`;
        writeMigration("002_b.sql", migrationCreating(untouched));

        await expect(applyPending({ pool, dir, table, log: silent })).rejects.toThrow(/have been edited/);
        // Aborts before applying anything, including the innocent new file.
        expect(await tableExists(untouched)).toBe(false);
    });

    it("does not care about line endings when comparing checksums", async () => {
        const sql = migrationCreating(`zz_mig_crlf_${uniqueSuffix()}`);
        writeMigration("001_a.sql", sql);
        await applyPending({ pool, dir, table, log: silent });

        // Simulates the same file checked out on the other platform.
        writeMigration("001_a.sql", sql.replace(/\n/g, "\r\n"));
        await expect(applyPending({ pool, dir, table, log: silent })).resolves.toEqual([]);
    });
});

describe("baseline", () => {
    it("writes nothing without apply, so the default is a dry run", async () => {
        const untouched = `zz_mig_dry_${uniqueSuffix()}`;
        writeMigration("001_a.sql", migrationCreating(untouched));

        expect(await baseline({ pool, dir, table, log: silent })).toEqual([]);
        expect(await ledgerRows()).toEqual([]);
        expect(await tableExists(untouched)).toBe(false);
    });

    it("records every file as applied without executing any of it", async () => {
        const notCreated = `zz_mig_notrun_${uniqueSuffix()}`;
        writeMigration("001_a.sql", migrationCreating(notCreated));
        writeMigration("002_b.sql", migrationCreating(`zz_mig_notrun2_${uniqueSuffix()}`));

        await baseline({ pool, dir, table, apply: true, log: silent });

        expect((await ledgerRows()).map((row) => row.filename)).toEqual(["001_a.sql", "002_b.sql"]);
        // The whole point: the schema is assumed to exist already.
        expect(await tableExists(notCreated)).toBe(false);
    });

    it("leaves a subsequent migrate run with nothing to do", async () => {
        writeMigration("001_a.sql", migrationCreating(`zz_mig_baselined_${uniqueSuffix()}`));
        await baseline({ pool, dir, table, apply: true, log: silent });

        expect(await applyPending({ pool, dir, table, log: silent })).toEqual([]);
    });

    it("refuses when the ledger already has rows", async () => {
        writeMigration("001_a.sql", migrationCreating(`zz_mig_twice_${uniqueSuffix()}`));
        await applyPending({ pool, dir, table, log: silent });

        // The one way this system could lose a schema change: baselining a
        // database that genuinely has migrations outstanding.
        writeMigration("002_b.sql", migrationCreating(`zz_mig_wouldbelost_${uniqueSuffix()}`));
        await expect(baseline({ pool, dir, table, apply: true, log: silent })).rejects.toThrow(/already records/);
    });
});

describe("inspect", () => {
    it("separates pending, changed and orphaned without applying anything", async () => {
        writeMigration("001_a.sql", migrationCreating(`zz_mig_inspect_${uniqueSuffix()}`));
        await applyPending({ pool, dir, table, log: silent });

        writeMigration("001_a.sql", "SELECT 1; -- edited");
        writeMigration("002_b.sql", "SELECT 1;");
        await pool.query(`INSERT INTO ${table} (filename, checksum, duration_ms) VALUES ('000_gone.sql', 'x', 0)`);

        const { pending, changed, orphaned } = await inspect({ pool, dir, table });

        expect(pending.map((file) => file.filename)).toEqual(["002_b.sql"]);
        expect(changed.map((file) => file.filename)).toEqual(["001_a.sql"]);
        expect(orphaned).toEqual(["000_gone.sql"]);
    });

    it("reports every file as pending against an empty ledger", async () => {
        writeMigration("001_a.sql", "SELECT 1;");
        writeMigration("002_b.sql", "SELECT 1;");

        const { pending, applied } = await inspect({ pool, dir, table });

        expect(applied.size).toBe(0);
        expect(pending).toHaveLength(2);
    });
});

describe("the real migration directory", () => {
    it("is all replay-safe-named, zero-padded and unique", () => {
        const realDir = path.join(process.cwd(), "src", "sql");
        const files = readMigrationFiles(realDir).map((file) => file.filename);

        expect(files.length).toBeGreaterThan(0);
        // A duplicate or unpadded prefix would silently reorder the run.
        const prefixes = files.map((filename) => filename.slice(0, 3));
        expect(new Set(prefixes).size).toBe(prefixes.length);
        for (const prefix of prefixes) expect(prefix).toMatch(/^\d{3}$/);
    });
});
