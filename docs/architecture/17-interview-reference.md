# Interview questions & rapid reference

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 22 — Interview Questions and Answers (from this codebase specifically)

### Architecture

**Q1: What architecture does this application use?**
*Short*: A layered REST API backend (routes → validator → controller → service → repository → Postgres) with a fully separate React SPA frontend talking only over that documented HTTP API.
*Deeper*: Every resource follows the identical five-layer sequence with zero layer-skipping — confirmed by reading every route file in `server/src/routes/`. There's no ORM; `repositories/*.js` hand-write every parameterized query. The frontend has no server-rendering and no shared code with the backend — genuinely two deployable units, matching the brief's "frontend and backend must be genuinely separate" constraint literally.

**Q2: Why this architecture, specifically no ORM?**
*Short*: Raw SQL keeps every query's cost and shape fully visible and gives full control over the recursive-CTE reporting-tree queries and the dynamic-but-parameterized filter builder, which an ORM's query builder would make awkward.
*Deeper*: `findSubtreeUsers`/`isUserInSubtree` (recursive CTE, depth-capped at 20) and `findLeaveRequestsFiltered`/`findLeaveTakenReport` (dynamic `WHERE` built from parameterized conditions, never string-concatenated) are exactly the kind of query an ORM tends to either not support natively or require raw-SQL escape hatches for anyway — this codebase just committed to raw SQL everywhere from the start for consistency.

**Q3: How does the frontend communicate with the backend?**
*Short*: Axios, `withCredentials: true`, a shared `apiClient.js` wrapping every call; auth is a cookie, not a bearer token.
*Deeper*: `client/src/services/apiClient.js` is the single axios instance every `services/*.js` file imports; a response interceptor watches for 401s (except on calls that opt out via `skipAuthRedirect`, used by every pre-login call) and flips global auth state to logged-out via a registered handler, without needing every component to individually catch 401s.

**Q4: How does a request flow through the backend?**
See Part 6's request-lifecycle example — walk through `POST /leave-requests/:id/approve` end to end (route → requireAuth → validators → controller → `decideLeaveRequest` → `resolveActingCapacity` → state machine → three writes → response).

### Authentication

**Q5: How does login work?**
Two independent paths, both producing the same `httpOnly` JWT cookie: password (bcrypt compare) and Google (verify a client-obtained ID token). See Part 8.

**Q6: How are passwords handled?**
bcrypt, 10 salt rounds, hashed in `utils/password.js`. Never logged; `password_hash` is nullable specifically to represent an `INVITED` user who hasn't set one yet.

**Q7: How is authentication maintained across requests?**
Stateless — a signed JWT (`{sub, role}`, 8h default expiry) inside an `httpOnly` cookie. No server-side session store. `requireAuth` re-verifies the JWT signature *and* re-fetches the live user from the DB every request — the `role` inside the token is never actually trusted for authorization decisions, only the freshly-queried one is.

**Q8: How is authorization implemented?**
Two chokepoints: `requireUserScope` middleware for the `users`/`leave-balances` domain, and `resolveActingCapacity` (one function) for every leave-request mutation — see Part 9's full decision tree. Neither domain scatters authorization checks across handlers.

### Employee

**Q9: How is a new employee added?** → Part 11, verbatim.

**Q10: How is a duplicate employee prevented?**
`users.email` has a case-insensitive unique index (`uq_users_email_lower`); a duplicate invite attempt hits a Postgres `23505` unique-violation, mapped by `errorHandler` to a 409.

**Q11: How is employee data validated?**
`userValidator.inviteEmployeeSchema` (Zod) at the HTTP boundary, then `reportingService.assertManagerAllowed` in the service layer for the business rule that the chosen manager's role fits the hierarchy (`EMPLOYEE→[MANAGER,HR_ADMIN]`, etc.).

### Leave

**Q12: How does an employee apply for leave?** → Part 12, verbatim.

**Q13: How is leave balance checked?**
Live, on every read: `entitlement − SUM(ledger.taken_delta) − SUM(ledger.pending_delta)` — never a stored number. Checked again server-side at submission time (never trusting a client-side balance display) before the request is even inserted.

**Q14: How does manager approval work?** → Part 13, verbatim.

**Q15: What happens when leave is rejected?**
Same `decideLeaveRequest` path as approval, `action="REJECT"`; the pending hold is released (`pendingDelta: -workingDays`) but nothing is ever added to `taken_delta`, since the leave was never actually granted.

**Q16: How do you prevent invalid leave requests?**
Six-step server-side validation order inside `submitLeaveRequest`, run in a specific sequence so cheap checks fail fast before the expensive Cloudinary upload ever happens — see Part 12.

### Database

**Q17: What tables are used?** → Part 7's ER diagram; full column detail in `docs/3.db.md`.

**Q18: What relationships exist?**
Most notably: a self-referencing `users.manager_id` for the reporting tree, and an append-only `leave_balance_ledger` (not a mutable balance total) driving every balance figure.

**Q19: Why PostgreSQL specifically?**
Not found as an explicit justification in the codebase — the brief recommended it, and features actually used (recursive CTEs, partial unique indexes, `gen_random_uuid()` via `pgcrypto`) are all Postgres-native.

**Q20: How are transactions handled?**
**Not found in the current codebase** — no `BEGIN`/`COMMIT`/`pool.query("BEGIN")` or a transaction-wrapping helper exists anywhere in `server/src/repositories/` or `services/`. Multi-statement operations (e.g. `decideLeaveRequest`'s update + ledger insert + audit insert) are three separate, non-transactional `pool.query` calls. This is a genuine gap worth naming directly if asked — a crash between the status update and the ledger insert would leave the two out of sync, with no rollback safety net today.

### Testing

**Q21: What test cases have you implemented?** → Part 17.

**Q22: What edge cases did you test?**
Named explicitly by the brief and confirmed present: manager acting outside their team (404), employee approving their own request (403), delegate acting after their window ends (404) vs. during it (200), balance after approve/cancel/override, overlap detection, illegal state transitions.

**Q23: What cases are still missing?** → Part 18.

### Error Handling

**Q24: How are errors handled?** → Part 14.

**Q25: How does frontend handle backend errors?**
Every mutating call site follows the same `try/catch/finally` shape; `toHttpError`/`toErrorMessage` normalize any axios error into a display-ready message; a global 401 interceptor handles session expiry uniformly without every component needing its own 401 handling.

---

## Part 23 — Rapid Interview Reference

**"How is a new employee added?"** — HR invites via a form → `POST /users/invite` (HR_ADMIN-gated) → creates a real `users` row in `INVITED` status with no password, seeds balances, generates a token, persists only its hash, returns a link the UI shows directly (no email integration in scope). The employee opens the link → verifies it's still valid → sets a password → account flips to `ACTIVE` and the response itself logs them in via the auth cookie, no separate login step.

**"How does login work?"** — Two paths (password/Google) both converge on the same `httpOnly` JWT cookie. OAuth never creates an account — an unmatched email is a 403, not an auto-registration.

**"How does leave application work?"** — Client-previews the working-day count using the *same* server calculation it'll be charged; final submit runs a strict server-side validation order (type → document → file-type sniff → working-days → overlap → balance) before ever touching Cloudinary or Postgres.

**"How does leave approval work?"** — One function, `decideLeaveRequest`, for every decision action. One authorization function, `resolveActingCapacity`, decides who may act. One state-transition map decides what's legal. One small lookup table decides the ledger math.

**"How is authorization implemented?"** — Row-level, not just role-level: `resolveActingCapacity` for leave requests, `requireUserScope` for users/balances — both single, reusable, tested functions, not per-handler conditionals.

**"How does frontend communicate with backend?"** — Axios + cookies (`withCredentials`), one `apiClient.js`, a consistent `{success,message,data}` envelope on every response.

**"How is data stored?"** — Raw parameterized PostgreSQL, no ORM, one migration file per schema change, applied manually per environment through a checksummed `schema_migrations` ledger, one transaction per file — deliberately not auto-run on deploy.

**"How do you validate user input?"** — Zod schemas at the HTTP boundary (`validators/*.js`) for shape, then business-rule checks inside services (e.g. `assertManagerAllowed`) — never trusting the client for either.

**"How do you handle errors?"** — Named `AppError` factories (`badRequest`/`unauthorized`/`forbidden`/`notFound`/`conflict`) thrown from anywhere, caught once by a centralized `errorHandler`, always returned as the same JSON envelope shape.

**"How do you prevent unauthorized access?"** — Every mutating leave-request endpoint runs `resolveActingCapacity` regardless of what the UI would have shown; an employee can never approve their own request no matter what role they also hold; an HR admin is scoped to their own reporting subtree, not the whole company, for every *action* (though company-wide *viewing* is a separate, deliberate exception).

**"How does leave balance remain accurate?"** — It's never a stored number: `entitlement − SUM(ledger.taken_delta) − SUM(ledger.pending_delta)`, recomputed on every single read from an append-only ledger that every decision action writes exactly one row to.

**"What happens if two users perform conflicting operations?"** — Not explicitly handled with application-level locking; relies on Postgres's own row-level locking during the `UPDATE ... WHERE id = $1` to serialize concurrent writes to the same request row, and the state machine to reject whichever request loses the race (its `assertLegalTransition` check will see the already-updated status and 409). **No dedicated test exercises this concurrency scenario directly** (see Part 18).

---
