# Test Cases

> What's covered, module by module, and what deliberately isn't. An inventory rather than a plan: knowing the
> holes is more useful than an unqualified "it's tested".
>
> **312 server tests** across 33 files (integration-level, against a real Postgres schema) and **431 client
> tests** across 63 files.

---

| File | Covers |
|---|---|
| [01-module1-accounts.md](01-module1-accounts.md) | accounts, roles, reporting structure, invitations |
| [02-modules-2-to-4.md](02-modules-2-to-4.md) | leave setup and calendar, requests and approval, dashboards and reporting |
| [03-module5-cross-cutting-and-gaps.md](03-module5-cross-cutting-and-gaps.md) | payroll and profile, notifications, `SUPER_ADMIN`, shared UI, and the known gaps |
