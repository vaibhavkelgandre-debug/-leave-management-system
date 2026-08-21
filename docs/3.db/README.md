# Database Schema

> The live schema: entity-relationship diagram, every table column by column, and the conventions they all
> follow.
>
> **Standing rule**: this is updated whenever a migration changes the schema. The migration ledger that tracks
> which files have been applied is documented in
> [`8.deployment_and_operations/03-database-and-migrations.md`](../8.deployment_and_operations/03-database-and-migrations.md).

---

| File | Covers |
|---|---|
| [01-sync-and-erd.md](01-sync-and-erd.md) | Keeping this in sync, and the ERD — the standing rule, plus the live ERD |
| [02-tables-accounts-and-leave-setup.md](02-tables-accounts-and-leave-setup.md) | Tables — accounts, auth & leave setup — `roles`, `users`, `invitations`, `oauth_accounts`, `password_resets`, `leave_types`, `leave_balances`, `holidays` |
| [03-tables-leave-and-audit.md](03-tables-leave-and-audit.md) | Tables — leave requests, ledger, delegation & audit — `leave_requests`, `leave_balance_ledger`, `delegations`, `audit_logs`, `leave_request_documents` |
| [04-tables-payroll-documents-notifications.md](04-tables-payroll-documents-notifications.md) | Tables — payroll, documents & notifications — `salary_slips`, `salary_slip_revisions`, `employee_documents`, `salary_structures`, `salary_structure_revisions`, `notifications` |
| [05-planned-and-conventions.md](05-planned-and-conventions.md) | Planned tables & design conventions — what is not built yet, and the rules every table follows |
