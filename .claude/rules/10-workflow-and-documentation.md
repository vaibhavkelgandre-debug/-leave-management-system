# Development workflow & documentation

> Part of the [project rules](../rules.md). These are binding, not advisory.

---

## 🔄 Development Workflow

For each feature, work through these steps **in order**:

1. Requirement
2. Business Rules
3. Edge Cases
4. Database Design
5. API Design
6. Validation
7. Implementation
8. Testing
9. Documentation

### 🌿 Git

- Small commits.
- One feature per commit.
- Use meaningful commit messages.

---

## 📚 Documentation

Each feature's documentation should cover:

- Functional Requirements
- Business Rules
- Database Design
- API Design
- Validation Rules
- Edge Cases
- Test Cases

> 🚨 **Role capability doc:** [`docs/7.role_permissions_matrix.md`](../../docs/7.role_permissions_matrix.md) is the single source of truth for **who can do what** — a per-role, per-endpoint matrix plus the row-level scope each capability is limited to, the field-level exceptions, the UI surfaces each role reaches, and the file where each rule is enforced. **Whenever a role's access changes, update this doc in the same change** — that includes:
>
> - adding, removing or widening a `requireRole(...)` / `requireUserScope(...)` gate on a route;
> - changing a row-level authorization check inside a service (anything touching `isInActorsHrScope`, `isUserInSubtree`, `findDirectReports`, `isManagerOrDelegateOf`, `invited_by` ownership, or a `forbidden(...)`/`notFound(...)` denial);
> - adding a new endpoint that any role can reach — it needs a matrix row even when the answer is "everyone";
> - changing what a role sees rather than what it may do (masked fields, a company-wide vs scoped list, a new filter);
> - adding or re-gating a client route (`RequireRole`), a nav item, or a role-conditional control (`RoleGate` / `hasAnyRole`).
>
> Use the checklist in §12 of that doc as the definition of done. This is the same standing rule as the API and DB docs below — a permission change that isn't in the matrix is an unfinished change, since the matrix is what anyone (including the client) reads to answer "is HR allowed to do this?" without re-reading five services.

> 🚨 **No document may exceed 400 lines.** Past that, split it into a folder named after the document with an index
> `README.md` and one file per concern, each also under 400. A 1,600-line reference is unreviewable in a diff, unreadable
> in one sitting, and impossible to link precisely — and it rots invisibly, because nobody rereads it to notice.
>
> Every doc in `docs/` and these rules themselves are already split this way. Applies to new documents too: if a page
> is heading past 400 lines, split it *then*, not later. Two mechanical rules make the split safe:
>
> - **Copy content verbatim**, so the split is reviewable as a pure move. Rewrite in a separate commit if you want to.
> - **Verify nothing was dropped** — check every heading survives and that no non-blank line of the original is absent
>   from the result. Both splits done so far reported zero lost lines, which is the only reason they were trustworthy.
>
> Fix inbound links in the same change. A relative link from a file that moved one level deeper resolves silently
> wrong, so recompute paths rather than string-patching them, and re-scan for broken targets afterwards.

> 🚨 **Database schema doc:** [`docs/3.db.md`](../../docs/3.db/README.md) documents every table (ER diagram + column-level breakdown) and a "Planned tables" section for what's designed but not built yet. **Whenever a migration is added or changed under `server/src/sql/`, update `docs/3.db.md` in the same change** — this is the same standing rule as keeping `docs/2.api_documentation.md` in sync with endpoint changes.

---
