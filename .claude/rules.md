# Project Rules

> ⚠️ **These files are the project's binding rules, and this page is only an index.** Read the file covering the
> area you are about to touch — the rules are in them, not here. If you are about to change anything, at minimum
> read [10-workflow-and-documentation.md](rules/10-workflow-and-documentation.md) and
> [13-claude-rules.md](rules/13-claude-rules.md).
>
> Split into a folder because no document in this repo may exceed 400 lines, and this one had reached 643.

---

## The five that apply to everything

Stated here because they govern every change, whatever area it is in:

1. **Never commit or push without being asked.** Offer the exact commands instead.
2. **Authorization is enforced server-side.** A hidden button is not a permission check, and an out-of-scope read
   returns `404`, never `403`.
3. **Update the docs the change touches** — the API reference for an endpoint, the schema doc for a migration, the
   role matrix for an access change. Each is a standing rule in its own file.
4. **After fixing a bug, write down the root cause and the fix** in the rules file for that area. Most of the value
   in these files is exactly that.
5. **Match the surrounding code** — its comment density, naming and idiom — rather than importing a different style.

---

| File | Covers |
|---|---|
| [01-scope-and-review.md](rules/01-scope-and-review.md) | **Scope, NFRs, Module 3 spec & review criteria** — the brief itself: non-negotiable NFRs, the authoritative Module 3 workflow spec, and how this is reviewed |
| [02-stack-and-architecture.md](rules/02-stack-and-architecture.md) | **Stack, architecture, file naming & exports** — the layering (routes -> validators -> controllers -> services -> repositories) and naming conventions |
| [03-database-and-migrations.md](rules/03-database-and-migrations.md) | **Database rules & the migration ledger** — schema conventions, and everything about writing and applying migrations |
| [04-auth-and-secrets.md](rules/04-auth-and-secrets.md) | **Authentication & secrets** — JWT/cookie rules and what must never be committed |
| [05-outbound-email.md](rules/05-outbound-email.md) | **Outbound email** — the four-file split, feature flags, per-flow rules, and why SMTP cannot work from Render |
| [06-pagination.md](rules/06-pagination.md) | **Pagination & count endpoints** — the one pagination idiom, the window-or-page rule, and what stays unpaginated |
| [07-access-control.md](rules/07-access-control.md) | **Who sees what** — role scoping decisions made on direct request - company-wide vs subtree, and where each control appears |
| [08-verification-and-payroll-guards.md](rules/08-verification-and-payroll-guards.md) | **Document preview, verification & payroll guards** — the guards that make a missed document or a zero-pay payslip impossible |
| [09-api-format-and-testing.md](rules/09-api-format-and-testing.md) | **API response format & testing** — the response envelope, status codes, and how tests are run |
| [10-workflow-and-documentation.md](rules/10-workflow-and-documentation.md) | **Development workflow & documentation** — git conventions, and which docs must be updated when what changes |
| [11-ui-components.md](rules/11-ui-components.md) | **Reusable UI components** — the component catalogue - check here before writing new markup |
| [12-deployment.md](rules/12-deployment.md) | **Deployment (Render)** — what the deployed topology requires |
| [13-claude-rules.md](rules/13-claude-rules.md) | **Claude rules** — how the assistant should work in this repo |
