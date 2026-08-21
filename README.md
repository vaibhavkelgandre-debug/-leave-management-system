# Leave Management System

An HR platform for managing employee accounts, roles, leave types/balances, and the public holiday calendar.

- **Backend setup & API** → [`server/README.md`](server/README.md)
- **Frontend setup** → [`client/README.md`](client/README.md)
- **Functional requirements & progress** → [`docs/1.functional_requirements.md`](docs/1.functional_requirements.md)
- **API reference** → [`docs/2.api_documentation.md`](docs/2.api_documentation.md)
- **Database schema** → [`docs/3.db.md`](docs/3.db.md)
- **Non-functional requirements** → [`docs/4.non_functional_requirements.md`](docs/4.non_functional_requirements.md)
- **Role capability matrix (who can do what)** → [`docs/7.role_permissions_matrix.md`](docs/7.role_permissions_matrix.md)
- **Architecture & end-to-end workflows** → [`docs/architecture/`](docs/architecture/README.md)

## Quick start

Run these in two terminals:

```bash
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```

See the linked READMEs above for environment variables, database setup, and migrations — the backend needs a PostgreSQL database before it will start successfully.
