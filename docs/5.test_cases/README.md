# Test Cases

> What is covered, module by module, and what deliberately is not. Written as an inventory rather than a plan:
> knowing the holes is more useful than an unqualified "it's tested".
>
> Current totals: **312 server tests** across 33 files (integration-level, against a real Postgres schema) and
> **431 client tests** across 63 files.

---

| File | Covers |
|---|---|
| [01-module1-accounts.md](01-module1-accounts.md) | Module 1 — accounts, roles & reporting |
| [02-module2-leave-setup.md](02-module2-leave-setup.md) | Module 2 — leave types, entitlements & calendar |
| [03-module3-requests.md](03-module3-requests.md) | Module 3 — leave requests & approval |
| [04-module4-dashboards.md](04-module4-dashboards.md) | Module 4 — dashboards & reporting |
| [05-module5-payroll-and-profile.md](05-module5-payroll-and-profile.md) | Module 5 — payroll & employee profile |
| [06-cross-cutting.md](06-cross-cutting.md) | Cross-cutting — notifications, SUPER_ADMIN, shared UI |
| [07-gaps-and-order.md](07-gaps-and-order.md) | Non-functional gaps & suggested testing order |
