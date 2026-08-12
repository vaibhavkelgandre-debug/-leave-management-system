# Leave Management System — Backend

Node.js + Express + PostgreSQL (raw SQL via `pg`, no ORM). See [`.claude/rules.md`](../.claude/rules.md) for architecture/coding conventions and [`docs/2.api_documentation.md`](../docs/2.api_documentation.md) for the full API reference.

## Prerequisites

- Node.js `>=20 <23`
- A local PostgreSQL server (with permission to `CREATE EXTENSION`, `CREATE DATABASE`)

## 1. Install dependencies

```bash
cd server
npm install
```

## 2. Create the databases

You need **two** databases: one for normal dev use, one for running tests (its name must end in `_test` — the test suite refuses to run otherwise, as a safety guard against accidentally truncating real data).

```sql
CREATE DATABASE leave_management_system;
CREATE DATABASE leave_management_system_test;
```

## 3. Configure environment variables

```bash
cp .env.example .env
cp .env.example .env.test
```

Edit both files. At minimum, fill in:

| Variable | Notes |
|---|---|
| `DB_PASSWORD` | Your local Postgres password |
| `JWT_SECRET` | Any random string (use different values for `.env` vs `.env.test`) |
| `HR_REGISTRATION_CODE` | Shared secret required to self-register the first HR admin |

In `.env.test`, also set `NODE_ENV=test` and `DB_NAME=leave_management_system_test`.

`.env` and `.env.test` are gitignored — never commit them.

## 4. Run migrations

```bash
npm run migrate
```

This applies every file in `server/src/sql/` in order, against the database in **`.env`** — the script always loads plain `.env` (`dotenv.config()` with no path override), it does **not** read `.env.test` even if `NODE_ENV=test` is set. To apply migrations to the test database instead, override `DB_NAME` in the shell (dotenv only fills in variables that aren't already set, so an env var you set yourself takes priority over `.env`):

```bash
# bash
DB_NAME=leave_management_system_test npm run migrate

# PowerShell
$env:DB_NAME = "leave_management_system_test"; npm run migrate; Remove-Item Env:DB_NAME
```

> ⚠️ **Known limitation**: the migration runner has no tracking table — it re-executes *every* migration file every time. On a database that already has migrations applied, re-running `npm run migrate` will fail with `relation "..." already exists`. If you only need to apply a couple of *new* migrations to an already-migrated database, apply just those files directly (e.g. via `psql -f server/src/sql/012_new_migration.sql`) instead of re-running the full script.

## 5. Run the server

```bash
npm run dev     # nodemon, auto-reloads on file changes
npm start       # plain node, for production
```

Server listens on `PORT` from `.env` (default `5001`). Health check: `GET /health`.

## 6. Run tests

```bash
npm test          # watch mode
npm run test:run  # single run
```

Integration tests hit the real `_test` database defined in `.env.test` — they truncate its tables before every test, so never point `.env.test` at a database with real data.

## Project layout

```
src/
  app.js              Express app (middleware, route mounting)
  server.js           HTTP server entrypoint
  config/             DB pool, Google/GitHub OAuth clients
  sql/                Numbered migrations (001_..., applied in order)
  scripts/            runMigrations.js
  repositories/       Raw parameterized SQL queries, one file per table
  services/           Business logic, calls repositories
  controllers/        Thin HTTP layer, calls services
  routes/             Express routers, wires middleware -> validator -> controller
  validators/         Zod schemas + validate.js middleware factory
  middlewares/        Auth, role/scope checks, centralized error handler
  utils/               Error types, response envelope, JWT, password hashing
  tests/integration/  Vitest + Supertest, against a real Postgres test DB
```
