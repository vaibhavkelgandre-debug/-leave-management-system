# Database Schema

> The live schema: ER diagram, every table column by column, and the conventions they follow.
>
> **Standing rule**: updated whenever a migration changes the schema. The ledger tracking which migrations have
> been applied is in
> [`8.deployment_and_operations/02-database-and-migrations.md`](../8.deployment_and_operations/02-database-and-migrations.md).

---

| File | Covers |
|---|---|
| [01-erd-and-conventions.md](01-erd-and-conventions.md) | the sync rule, the live ER diagram, planned tables, and the conventions every table follows |
| [02-tables-accounts-and-leave-setup.md](02-tables-accounts-and-leave-setup.md) | `roles`, `users`, `invitations`, `oauth_accounts`, `password_resets`, `leave_types`, `leave_balances`, `holidays` |
| [03-tables-leave-payroll-and-notifications.md](03-tables-leave-payroll-and-notifications.md) | `leave_requests`, the balance ledger, `delegations`, `audit_logs`, payroll, documents, `notifications` |
