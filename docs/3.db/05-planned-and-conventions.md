# Planned tables & design conventions

> Part of [Database Schema](README.md). If this disagrees with the code, the code wins.

---

## 🔮 Planned tables (not yet implemented)

These come from the original schema design (`leave_management_system.db.sql`) and the remaining not-yet-built part of the roadmap. They're recorded here as a **starting sketch**, not a finalized design.

None currently outstanding — `leave_request_documents` (FR-012) was the last item here; the storage decision was settled as Cloudinary (see its section above under "Tables"), and it's now ✅ live as of migration `017`.

**Dropped from the original sketch** (superseded by what was actually built, or invalid):
- `invitation_tokens` / `password_reset_tokens` → replaced by `invitations` / `password_resets` above (same idea, different shape — token *hash* instead of raw token, `invited_by` added).
- `users_users` table and the `audit_logs.old_status → audit_logs.id` foreign key → these were artifacts of the diagramming tool that generated the original file (a junction table keyed on `password_hash`, and a status column pointing at a row id), not real relationships. Omitted here as errors, not a design decision to revisit.

> `users.employee_code` (dropped from the original sketch note above in earlier versions of this doc) was in fact added back in `022_alter_users_profile_v2.sql`, once a real onboarding spreadsheet requiring one was provided — it's HR-assigned and purely informational (never a lookup/match key).

---

## 🧠 Design conventions used throughout

- Every table's primary key is `UUID DEFAULT gen_random_uuid()` (`pgcrypto`, enabled in `001_enable_pgcrypto.sql`).
- Every table has `created_at`; most also have `updated_at` (see [`.claude/rules.md`](../.claude/rules.md) → Database Rules).
- "Soft" uniqueness (e.g. "only one *pending* invite per user") is modeled with a **partial unique index** (`WHERE accepted_at IS NULL`) rather than an application-only check — the database enforces it even under concurrent requests.
- Case-insensitive uniqueness (email, leave type name) uses a unique index on `lower(column)`, since Postgres `UNIQUE` is case-sensitive by default.
- Business-rule enums (`status`, `provider`, `accrual_type`) use a `VARCHAR` + `CHECK IN (...)` rather than a Postgres `ENUM` type, so adding a new value is a plain migration instead of an `ALTER TYPE`.
