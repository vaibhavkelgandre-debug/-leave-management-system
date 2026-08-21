# Project Rules

> ⚠️ **These files are the project's binding rules, and this page is only an index.** Read the file
> covering whatever you are about to touch — the rules are in them, not here. At minimum read
> [04-workflow-deployment-and-claude.md](rules/04-workflow-deployment-and-claude.md), which applies to every
> change.
>
> A folder because no document here may exceed 400 lines; five files rather than thirteen because a dozen
> 40-line files is harder to navigate than the monolith was.

---

## The five that apply to everything

1. **Never commit or push without being asked.** Offer the exact commands instead.
2. **Authorization is enforced server-side.** A hidden button is not a permission check, and an out-of-scope
   read returns `404`, never `403`.
3. **Update the docs the change touches** — the API reference for an endpoint, the schema doc for a migration,
   the role matrix for an access change. Each is a standing rule in its own file.
4. **After fixing a bug, write down the root cause and the fix** in the rules file for that area. Most of the
   value in these files is exactly that.
5. **Match the surrounding code** — its comment density, naming and idiom — rather than importing another style.

---

| File | Covers |
|---|---|
| [rules/01-scope-and-architecture.md](rules/01-scope-and-architecture.md) | **Scope, review criteria, stack & architecture** — the brief, the NFRs, the Module 3 spec, the layering and naming conventions |
| [rules/02-backend-conventions.md](rules/02-backend-conventions.md) | **Database, auth, secrets, API format & testing** — schema and migration rules, JWT/cookie handling, the response envelope, how tests run |
| [rules/03-features-and-access.md](rules/03-features-and-access.md) | **Email, pagination, access control & guards** — the mail split and flags, the one pagination idiom, who sees what, the verification and payroll guards |
| [rules/04-workflow-deployment-and-claude.md](rules/04-workflow-deployment-and-claude.md) | **Workflow, documentation, deployment & Claude rules** — git conventions, which docs to update when, the 400-line limit, how the assistant should work here |
| [rules/05-ui-components.md](rules/05-ui-components.md) | **Reusable UI components** — the catalogue; check here before writing new markup |
