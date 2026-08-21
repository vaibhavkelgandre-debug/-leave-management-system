# Non-functional gaps & suggested testing order

> Part of [Test Cases](README.md). If this disagrees with the code, the code wins.

---

## Non-Functional & Infrastructure Gaps

These don't belong to a single module — they're about the *kind* of testing this app has zero coverage of, regardless of feature.

- 🔴 **No end-to-end (E2E) browser test suite at all.** Every existing test is either a backend integration test (Supertest, no real browser) or a component test with mocked services (no real backend/DB). Nothing drives the actual full stack — real browser, real API, real database — through a complete journey (e.g., HR invites → employee accepts → submits leave with a document → manager approves → balance updates → HR runs payroll → employee views their payslip). This is the single biggest structural gap, and directly relevant to what "end-to-end module testing" means for this app today.
- 🔴 **No load/performance testing** against the explicit NFR-7 target (200 employees, 3 years of history) — confirmed "not measured" in `4.non_functional_requirements.md` itself. Several list endpoints are also unpaginated.
- 🔴 **No adversarial security test pass** — SQL injection attempts (architecturally prevented via parameterized queries, but never tested against), XSS payloads in free-text fields (reason, comments, custom document names) rendered back into the UI, and CSRF exposure given the cross-site `SameSite=None; Secure` cookie setup used for the Render deployment.
- 🟡 No CI pipeline evidence (no GitHub Actions or similar) enforcing that the test suite actually runs on every push/PR — tests exist and pass locally, but nothing stops a broken build from being pushed.
**Server — `migrations.test.js`** (the migration ledger)
- Applies pending files in filename order, records each, and applies nothing on a second run
- Applies only the new file when one is added after an earlier run
- A failed migration rolls back, records nothing, and stops later files from running
- An edited already-applied file aborts the run before anything is applied
- Checksums ignore line endings, so the same file matches on Windows and Linux
- `baseline` is a dry run by default, records without executing when applied, and refuses once the ledger has rows
- `baseline --pending-only` records just the unrecorded files without executing them, is still a dry run without `--yes`, and reports when there's nothing left to record
- `inspect` separates pending / edited / orphaned without changing anything
- The real `src/sql` directory has unique, zero-padded, three-digit prefixes

---

## Suggested Testing Order

Given the volume above, a practical module-by-module order — most reviewed/highest-risk first, matching what `.claude/rules.md` itself says reviewers will probe hardest:

1. **Module 3 (Leave Requests & Approval)** — already the best-covered; close the two 🔴 gaps (long-sequence balance drift, concurrent overlap race) since this is explicitly the top review criterion.
2. **Module 5 (Payroll)** — highest financial/data-integrity stakes; start with the PDF-content-matches-data gap and the SUPER_ADMIN-scoping gaps on the three untested services.
3. **Module 1 (Accounts/Roles)** — close the SUPER_ADMIN concurrency and JWT-tampering gaps; build the seed script, since it unblocks manual testing of everything else.
4. **Module 2 (Leave Types/Calendar)** — the year-boundary debit test and leave-type-deactivation behavior.
5. **Module 4 (Dashboards)** — lower risk since it composes already-tested endpoints; mainly the SUPER_ADMIN-view gap.
6. **Cross-cutting (Notifications, UI)** — lowest risk, mostly 🟡; the "failed notify doesn't break the action" test is cheap and worth doing early despite being cross-cutting.
7. **Non-functional (E2E, load, security)** — biggest lift, do last as a dedicated effort rather than folding into feature work — an E2E suite in particular is a new tool/setup decision (e.g., Playwright), not just "more tests."
