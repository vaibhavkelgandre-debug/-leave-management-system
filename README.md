# Leave Management System

An HR platform for employee accounts and roles, leave types/balances and the holiday calendar, document upload and
profile verification, payroll and payslips, and in-app notifications.

## Quick start

Two terminals:

```bash
cd server && npm install && npm run dev
```

```bash
cd client && npm install && npm run dev
```

The backend needs a PostgreSQL database before it will start. See [`server/README.md`](server/README.md) for
environment variables, database setup and migrations.

---

## Documentation map

Start with whichever question you're actually asking.

| I want to… | Read |
|---|---|
| **run this locally** | [`server/README.md`](server/README.md) · [`client/README.md`](client/README.md) |
| **understand the codebase** | [`docs/architecture/`](docs/architecture/README.md) — 20 files by concern, including end-to-end traces for every module |
| **demo it end to end** | [`docs/6.demo_walkthrough/`](docs/6.demo_walkthrough/README.md) — a script in presentation order |
| **call the API** | [`docs/2.api_documentation/`](docs/2.api_documentation/README.md) |
| **know what a role may do** | [`docs/7.role_permissions_matrix.md`](docs/7.role_permissions_matrix.md) |
| **understand the schema** | [`docs/3.db/`](docs/3.db/README.md) |
| **deploy it, or fix a deployment** | [`docs/8.deployment_and_operations/`](docs/8.deployment_and_operations/README.md) |
| **know what's built and what isn't** | [`docs/1.functional_requirements/`](docs/1.functional_requirements/README.md) · [`docs/4.non_functional_requirements.md`](docs/4.non_functional_requirements.md) |
| **know what's tested** | [`docs/5.test_cases/`](docs/5.test_cases/README.md) |
| **change something** | [`.claude/rules.md`](.claude/rules.md) — the project's binding rules |

> 📏 **No document here exceeds 400 lines.** Anything longer is a folder with an index and one file per concern. The
> rule, and how to split safely, is in
> [`.claude/rules/10-workflow-and-documentation.md`](.claude/rules/10-workflow-and-documentation.md).

## Shape of the thing

```text
client/   React 19 + Vite + Tailwind, React Router, FullCalendar
server/   Express 5 + PostgreSQL, raw parameterized SQL (no ORM)
          routes → validators → controllers → services → repositories
docs/     see the map above
```

| | |
|---|---|
| Roles | `EMPLOYEE`, `MANAGER`, `HR_ADMIN`, singleton `SUPER_ADMIN` |
| Migrations | 37, tracked in a `schema_migrations` ledger, applied manually per environment |
| Tests | 312 server (integration, real Postgres) · 431 client |
| Mail | SendGrid over HTTPS — three flows, each behind a feature flag |
| Storage | Cloudinary, for employee documents |
