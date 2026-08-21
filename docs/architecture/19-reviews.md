# Security, performance, strengths & weaknesses

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 26 — Security Review

### Implemented protections (confirmed by direct code inspection)

- **CORS**: env-driven origin allowlist (`CLIENT_ORIGIN`, comma-split), never a wildcard, correctly paired with `credentials: true` (`server/src/app.js`).
- **SQL injection**: PASS across all 13 repository files inspected — every dynamic-WHERE builder (`findLeaveRequestsFiltered`, `findLeaveTakenReport`) interpolates only positional placeholder *numbers* (`$1`, `$2`, ...), never values; every value travels through the parameterized `params` array.
- **Cookies**: `httpOnly` always; `secure`+`SameSite=None` in production (required for the cross-subdomain Render deployment), `SameSite=Lax`+non-secure in dev (matches the same-origin local setup) — `server/src/utils/cookies.js`.
- **JWT**: secret from `process.env.JWT_SECRET`, 8h default expiry, and — the more important property — `requireAuth` never trusts the token's `role` claim, re-fetching it live from the DB every request.
- **XSS**: no `dangerouslySetInnerHTML` anywhere in `client/src`; no backend endpoint reflects raw user input into an HTML response (the one CSV-generating endpoint sets `Content-Type: text/csv`, not HTML).
- **File upload**: multer memory storage (never touches disk) + 5MB limit + magic-byte content sniffing (`fileType.js`) restricted to PDF/JPEG/PNG — never trusts the client-supplied extension or `Content-Type`. Uploaded documents are stored as private Cloudinary `authenticated` assets, retrievable only via a 5-minute signed URL minted fresh per call, gated behind this app's own authorization check, and served back with a server-controlled `Content-Type` + forced `Content-Disposition: attachment`.
- **Secrets**: no production-path secret logging found; `.env`/`.env.test`/`.env.*.local` are gitignored.
- **Filename header injection**: the document-download endpoint strips `"`/`\r`/`\n` from the user-supplied original filename before interpolating it into the `Content-Disposition` header.
- **Timing-safe comparison**: the HR-registration shared secret is compared via `crypto.timingSafeEqual`, not `===`, specifically to avoid leaking match-length information via response timing.

### Potential weaknesses

| Severity | Finding | Detail |
|---|---|---|
| **HIGH** | No IP-level rate limiting anywhere | Confirmed absent by grep and by `package.json` dependency list — login and the HR-registration-code endpoint have zero brute-force/credential-stuffing protection. The timing-safe comparison on the registration code is undermined by having no attempt-throttling in front of it at all. `password-reset/request` now has a **per-account** 15-minute cooldown enforced in SQL (`issuePasswordReset`), which caps mail-bombing and quota burn against any one address — but it is keyed on `user_id`, so an attacker cycling many known addresses is still unthrottled. That needs IP-level limiting, which remains unaddressed. |
| **MEDIUM** | No database transactions | Multi-step writes (e.g. `decideLeaveRequest`'s status update + ledger insert + audit insert) are three independent, non-atomic `pool.query` calls — a crash or connection drop between them leaves the ledger/audit trail out of sync with the request's actual status, with no rollback. |
| **LOW** | No explicit JWT `algorithms` allowlist on verify | `jwt.verify(token, secret)` without pinning `algorithms:["HS256"]` — not exploitable today with a fixed symmetric secret, but missing defense-in-depth. |
| **LOW** | Raw invite tokens logged to console outside production | Deliberate dev-mode stand-in for real email delivery, explicitly gated by `NODE_ENV !== "production"` — but any non-production environment's logs (including a shared `staging` env, if one existed) would contain live, usable tokens in plaintext. **Password-reset links are no longer in scope for this finding**: they're emailed now, and only fall back to a console log when the mail provider is unconfigured (never in a configured production environment). The reset path also deliberately keeps the link out of its failure logs, since it's a live credential. |
| **LOW** | Polyglot file risk (theoretical) | Magic-byte sniffing only inspects the first bytes; a file with a valid PDF header followed by other embedded content would pass. Neutralized in practice by private storage + forced download + server-controlled Content-Type, but worth naming as an inherent limit of signature-based detection rather than a bug. |
| **LOW** | No `methods`/`allowedHeaders` restriction on CORS | The origin allowlist is what actually matters given `credentials:true`; the missing method/header restriction is a minor hardening gap, not a live exposure. |

### Recommended improvements

1. Add `express-rate-limit` (or equivalent) to `/api/auth/login`, `/api/auth/password-reset/request`, and `/api/auth/register/hr` at minimum — this is the single highest-value security improvement available given everything else already implemented correctly.
2. Wrap `decideLeaveRequest`'s three writes (and `submitLeaveRequest`'s insert+ledger+audit sequence) in an explicit Postgres transaction (`BEGIN`/`COMMIT`/`ROLLBACK` via a checked-out client, not the shared pool) so a partial failure can't desynchronize the ledger from the request's actual status.
3. Pin `jwt.verify`'s `algorithms` option explicitly.
4. ~~If a staging/shared non-production environment is ever introduced, swap the console-logged invite/reset links for a real (even sandboxed) email provider before that environment holds real accounts.~~ **Done for both** (`config/mailer.js` + `services/mailService.js`, now SendGrid over HTTPS): password-reset *and* invite links are emailed. The invite link is still also returned to HR in the response, deliberately — it's the documented fallback when mail is switched off or fails, and the UI promotes it in that case. The console-log path now only happens when the provider is unconfigured, which must never be true in a deployed environment: that fallback logs the whole message body, links included.

---

## Part 27 — Performance Review

### N+1 query patterns

**One confirmed instance, low real-world impact**: `listTeamLeaveRequests` (`leaveRequestService.js`) does `Promise.all(delegatedManagerIds.map(managerId => findDirectReports(managerId)))` — one query per manager the actor is currently delegating for. In practice this list is almost always 0 or 1 items, so the cost is negligible, but it's structurally an N+1 shape; a single `WHERE manager_id = ANY($1::uuid[])` query would remove it entirely.

Every other list operation checked (`findAllUsers`, `findSubtreeUsers`, every `leave_requests` listing function, `BALANCE_SELECT`) is a single query with proper `JOIN`s — no loop-per-row pattern found anywhere else in `server/src/repositories/`.

### Duplicate/repeated queries within one handler

- `decideLeaveRequest` fetches `findLeaveRequestById(requestId)` **twice** — once before the mutation (needed, for authorization + state-machine checks against the *current* row) and once after (purely to return the fresh joined shape). The second fetch re-runs a 5-table `JOIN` just to pick up 4 changed columns (`status`, `decided_by`, `decided_at`, `decision_comment`) that `updateLeaveRequestStatus`'s own `RETURNING` clause already has.
- `userService.changeManager` and `changeStatus` follow the identical "fetch by id → mutate → fetch by id again" shape, at smaller cost (a single `users`⋈`roles` join instead of the 5-table one).

None of these are correctness bugs — they're all one extra round-trip per handler call, worth optimizing only if this system is ever under real load pressure.

### Pagination

**Since resolved.** The endpoints that grow with time are now paginated on the `limit`/`offset` + `{ rows, total }` contract: `GET /leave-requests/team`, `/all`, `/leave-requests` (HR's filtered browse) and `GET /salary-slips`. Counts that used to be derived by fetching a list are their own endpoints (`/leave-requests/pending-count`, `/users/me/team/count`, `/notifications/unread-count`), and `GET /users/options` is a five-column projection for dropdowns that were pulling ~40 columns per user to render a name.

The team/approvals endpoints take **either** a page **or** a `startDate`+`endDate` window capped at 62 days — the calendar needs a whole month at once, and page 1 of a busy team is not "this month". The window needs no `limit` because its span bounds it, which is why both dates are required together and the cap exists.

What remains unpaginated is bounded by headcount or by leave-type count rather than by time: `/leave-types`, `/holidays` (year-scoped), `/leave-balances/me`, `/employees/:id/documents`, `/delegations/*`, `/leave-requests/:id/audit`, every `/mine` endpoint, and `/report` + `/report/csv` (aggregated to one row per employee — and a CSV export *should* cover everything). Still unmeasured: no load testing has been done either way.

### Balance calculation — explicitly checked, not an N+1

The self-healing balance-seeding path (`listBalancesForUser`) is two queries total (one `INSERT ... SELECT` for any missing rows, one `SELECT ... GROUP BY` for the actual balances) — not one insert per leave type in a loop.

---

## Part 28 — Architecture Strengths and Weaknesses

### Strengths

- **Single authorization chokepoint per domain** (`resolveActingCapacity`, `requireUserScope`) rather than scattered per-handler checks — directly satisfies the brief's #1 review criterion and is provably tested (named authorization test cases exist for every documented edge case).
- **Balance-never-drifts is structural, not disciplinary** — there's no code path that *could* desync a balance from its history, because there's no stored total to desync; it's derived every time.
- **One explicit state-transition map** — the entire legal-move set for a leave request is visible in ~10 lines, not implied by conditionals spread across five endpoint handlers.
- **Consistent layering with zero shortcuts** — every resource follows routes→validator→controller→service→repository without exception, confirmed by reading every route file.
- **Deliberate, documented 403-vs-404 policy** (NFR-5) applied consistently, not ad hoc per endpoint.
- **Test coverage matches the brief's explicit checklist by name** — not just broad happy-path coverage, but the specific named authorization edge cases the brief calls out.
- **Self-documenting known gaps** — `docs/2.api_documentation.md`'s "Not yet built" section and the NFR doc's 🟡 markers mean nothing is silently missing; every gap is a decision, not an oversight.

### Weaknesses (ranked)

**HIGH**
- No rate limiting anywhere in the backend (Part 26).

**MEDIUM**
- No database transactions around multi-statement writes (Part 26/27) — a real, if narrow, data-consistency risk.
- No load testing. The time-growing endpoints are paginated and indexed for it (including `idx_leave_requests_employee_start_date`, which lets a page be walked in order rather than sorted whole), but the NFR-7 target of 200 employees × 3 years has never been measured.

**LOW**
- Minor duplicate-query patterns in `decideLeaveRequest`/`changeManager`/`changeStatus` (Part 27).
- No explicit JWT algorithm pinning.
- Console-logged tokens outside production (by design, but worth revisiting if a shared non-prod environment is ever added).
- `MONTHLY` accrual and holiday-affects-approved-leave are named-but-unimplemented decisions — not wrong, but worth an explicit one-line "decided not to build this, because X" note near the code, matching how well everything *else* in this codebase documents its own scope decisions.

---
