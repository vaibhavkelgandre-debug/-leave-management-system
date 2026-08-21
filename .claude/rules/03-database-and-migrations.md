# Database rules & the migration ledger

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 🗄️ Database Rules

- Use PostgreSQL.
- Use raw SQL with **parameterized queries** (no string concatenation — prevents SQL injection).
- Use `UUID DEFAULT gen_random_uuid()` for primary keys.
- Use foreign keys where appropriate.
- Every table needs `created_at` and `updated_at`.
- Store SQL scripts in `src/sql`.
- Migrations are numbered sequentially and **never edited after being applied** — now enforced rather than merely asked for: the runner stores a SHA-256 of every applied file and refuses to run if one changed.
  Current latest is `037_index_leave_requests_for_browse_pagination.sql` → next migration must start at `038_...`.

> ℹ️ **Holidays store a date range, not a single date.** `holidays` has `start_date`/`end_date` (both `NOT NULL`, `end_date >= start_date`), not a single `holiday_date` — this supports multi-day holidays (e.g. a 5-day Diwali). The API accepts `endDate` as optional and defaults it to `startDate` for single-day holidays. There's no DB-level uniqueness on dates anymore (ranges make exact-duplicate uniqueness meaningless); overlap between holidays is instead checked at the service layer (`holidayService.js` → `findOverlappingHoliday`) and rejected with a `409`, same status code as the old DB-constraint-driven duplicate check.

> 🔖 **The runner keeps a ledger, so a run applies only what's new.** `schema_migrations` (filename, checksum, applied_at, duration_ms) is created by `runMigrations.js` itself — it can't be a migration file, since a migration that creates the ledger can't be recorded in the ledger it's creating. Three commands:
>
> | Command | Does |
> |---|---|
> | `npm run migrate` | applies every pending file, in order |
> | `npm run migrate:status` | reports applied/pending/edited/orphaned, changes nothing |
> | `npm run migrate:status -- --verbose` | as above, plus the ledger rows — `baselined` marks a row recorded rather than executed |
> | `npm run migrate:baseline` | records all files as applied **without executing them** — dry run unless given `-- --yes` |
> | `npm run migrate:baseline -- --yes --pending-only` | records only the *unrecorded* files — recovery for a ledger left partial by a failed run |
>
> - **Each file runs in its own transaction, with its ledger row inserted inside it** — so a file either fully applies and is recorded, or neither. A failure stops the run rather than skipping ahead, because migration 040 almost certainly assumes 039 landed. A file needing statements Postgres won't run in a transaction (`CREATE INDEX CONCURRENTLY`) opts out with a `-- migrate:no-transaction` marker.
> - **An edited already-applied file aborts the run before anything is applied.** Fatal on purpose: it means this database and every other one are now running different schemas, and continuing would paper over the divergence.
> - **Checksums hash LF-normalized content, never raw bytes, and that line is load-bearing.** `core.autocrlf=true` is set here, so every `.sql` file is LF in git and CRLF in a Windows working tree — hashing raw bytes would make the identical file hash differently on a laptop than on Render, and *every* run would fail with a meaningless mismatch. There's a test pinning this (`migrations.test.js`).
> - **A session-scoped advisory lock wraps the whole run**, taken on the same client that does the work — `pool.query` could hand each statement a different connection and the lock would then guard nothing. Two concurrent deploys serialize instead of both applying the same pending list.
> - **`baseline` is a one-time step for a database that predates the ledger**, and refuses when the ledger already has rows. That refusal matters: baselining a database that genuinely has migrations outstanding is the single way this system could lose a schema change, and it would do it silently. It is a **dry run by default** — which beats a confirmation prompt because it behaves identically over SSH, in CI, and in a non-interactive shell.
> - **`schema_migrations` must never enter `setup.js`'s `TRUNCATE` list.** Truncating the ledger between tests would make every run believe the database was unmigrated.
>
> 🚨 **Idempotent DDL is not the same as safe to replay against newer data — and this was learned the hard way, in production.** Running `migrate` against the Render database (full schema, no ledger yet) died at `033_alter_notifications_add_types.sql` with `check constraint "notifications_type_check" of relation "notifications" is violated by some row`. 033 narrows that constraint to 16 values; 036 widens it to 17 by adding `PROFILE_CREATED`; the live app had already written rows with that type. Re-imposing 033's narrower version against 036-era rows is a violation, and no amount of `IF EXISTS` guarding prevents it — the file *is* idempotent, and it still can't be replayed.
>
> Two consequences:
> - **For a database that has data but no ledger, `baseline` — not `migrate`.** The earlier advice here (run `migrate`, it "can't lose anything") was wrong: it can't lose data, but it can fail outright, and on a constraint-narrowing file it will. The three-clean-runs verification that produced that advice ran against `_test`, which had no `PROFILE_CREATED` rows, so it proved less than it appeared to.
> - **Nothing broke, because of the per-file transaction.** 033's `DROP CONSTRAINT` rolled back with its failed `ADD`, so the table kept the 036-era constraint. Without the transaction, that table would have been left with no type constraint at all.
>
> Recovery from a half-populated ledger is `migrate:baseline -- --yes --pending-only`, which records the unrecorded files without executing them. It needs both flags on purpose: it is precisely the operation the plain refusal exists to prevent, so it's only ever right when you know the schema is already current — which, in that production case, the failure itself proved (rows of a type only 036 allows).

> **Replay-safety is now a convention, not a requirement.** The ledger means a file runs once, so `IF NOT EXISTS` and friends are no longer what stands between you and a broken run — but keep writing them anyway: they make baselining forgiving and manual recovery possible when a ledger row and reality disagree. What's gone is the *ritual* — you no longer need to run the whole suite twice against `_test` to prove a new file is idempotent. The rules, for reference:
> - `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP ... IF EXISTS`.
> - Seed `INSERT`s carry `ON CONFLICT ... DO NOTHING`.
> - A constraint change is always `DROP CONSTRAINT IF EXISTS` **then** `ADD CONSTRAINT` — `ADD` alone fails on a duplicate name.
> - A `RENAME` can't be made idempotent with a clause, so guard it with a `DO ... information_schema ...` block (see 012).
>
> Historical note, because it explains why all 37 existing files are already idempotent: before the ledger the runner replayed everything on every run, and `002_create_roles.sql`'s bare `CREATE TABLE roles` aborted the whole run with `relation "roles" already exists` — leaving migration 037 unapplied and looking like a problem with 037.

> ⚠️ **Migrations are applied manually to every environment, deliberately — the ledger tells you what's pending, it does not run anything for you.** Adding a migration file still updates no database on its own. After writing one, run `npm run migrate` against the dev DB, the `_test` DB (or backend tests fail on the old schema), **and** the Render production DB. Auto-running on deploy was considered and rejected: a bad migration would then take down production unattended, and Render's free tier gives you no shell to recover from. A deployed frontend hitting an unmigrated production DB shows up as a generic load failure like "Unable to load holidays", easy to misdiagnose as an API/CORS bug — `npm run migrate:status` answers it in one line.

> ⚠️ **FullCalendar `display: "list-item"` does not put a dot on every day of a multi-day event.** A single event with `start`/`end` spanning several days renders as just **one** dot on the start day, so the remaining days look empty. `HolidayCalendar.jsx` therefore expands each holiday range into one single-day event per date (`eachDateKeyInRange` in `client/src/utils/dates.js`) — don't "simplify" it back to one event with an `end`.

---
