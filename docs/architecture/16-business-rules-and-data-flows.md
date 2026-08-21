# Business rules & important data flows

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 20 — Business Rules Extracted From the Code

**Implemented, confirmed by code + tests:**

- An employee's status/role change (deactivation, promotion) takes effect on their *very next request* — no waiting for token expiry — because `requireAuth` re-fetches the live user every time rather than trusting the JWT payload.
- OAuth (Google) can only ever log into an existing, `ACTIVE` account — it is never a signup path, regardless of how "real" the verified identity is.
- A balance is never a stored, mutated number — it is always `entitlement − SUM(ledger.taken_delta) − SUM(ledger.pending_delta)`, computed fresh on every read.
- An employee can never approve, reject, or override their own request, under any role they might also hold (e.g. a manager's own leave request must be approved by *their* manager or HR, never themselves) — checked before any role branch is even reached.
- Only the employee themselves may withdraw or cancel their own request — there is no manager/HR "force cancel" anywhere in the codebase, a documented and deliberate scope decision matching the brief literally.
- A request spanning a year boundary is debited against its **start date's** year, not the end date's, and not split/pro-rated across both years.
- A leave-taken report / filtered browse counts a request that only *partially* overlaps the queried period **in full**, never pro-rated to the overlapping days only.
- HR's "act on any request" is scoped to *that specific HR admin's own reporting subtree*, never company-wide — this app supports more than one HR admin, each the root of a separate branch. Company-wide *visibility* (not action) exists separately via `GET /all`.
- Editing a person's manager or active/inactive status is restricted to the specific HR admin who created them (`invited_by`), not any HR admin generally — even though any HR admin can *view* every user via `GET /users`.
- A holiday, once created, does **not** retroactively recalculate any already-decided leave request's `working_days` — that value is snapshotted at submission time and never recomputed.
- A delegate's authority is checked live against today's date on every single action — never cached, never assumed from a prior check.

**Mentioned in the brief but NOT implemented in code** (confirmed absent):

- **Monthly leave accrual** — `leave_types.accrual_type` can be set to `MONTHLY`, but no scheduled job or incremental-grant logic exists anywhere; every balance, regardless of accrual type, receives the full annual entitlement immediately upon seeding. Self-documented in `docs/2.api_documentation.md`'s "Not yet built" section.
- **Recalculating already-approved leave when a new holiday is added inside its date range** — the brief explicitly poses this as an open question ("what should happen?"); the current code's answer is "nothing happens" (no code path touches existing requests when a holiday is created/edited), which is a real, undocumented-as-a-decision gap rather than a reasoned "do nothing, and here's why."
- **Pagination on any list endpoint** — acknowledged as a known gap in `docs/4.non_functional_requirements.md` (NFR-7), not a silent omission, but genuinely not implemented anywhere.
- **A maintained date library** (date-fns/dayjs/luxon/moment) — the brief's technical-constraints table names this as a requirement; the codebase hand-rolls date math instead (`server/src/utils/dates.js`, mirrored in `client/src/utils/dates.js`).
- **Rate limiting** on any endpoint, including login/password-reset/HR-registration-code — confirmed absent by direct grep, no package installed.

---

## Part 21 — Important Data Flows

### Employee (invite) creation

```text
Form Data (InviteEmployeeForm) → Zod validation (inviteEmployeeSchema) →
    API Payload (JSON) → userController.inviteEmployee → invitationService.inviteEmployee
    → users INSERT (status=INVITED) + leave_balances seed + invitations INSERT (hashed token)
    → Created Employee (INVITED) + invite link returned to the UI
```

### Leave application

```text
Leave Form (RequestLeaveForm) → client-side pre-checks → live preview (server-calculated) →
    Leave Request submission (multipart if a document is attached) → server-side validation
    chain (type → document → file-type → working-days → overlap → balance) → Cloudinary
    upload (only after every check passes) → leave_requests INSERT → optional
    leave_request_documents INSERT → leave_balance_ledger INSERT (pending += workingDays) →
    audit_logs INSERT (SUBMIT) → Pending Request returned to the UI
```

### Leave approval

```text
Approval Action (RequestActions/RequestDetailModal) → resolveActingCapacity
    (Authorization — owner/manager/delegate/HR branch) → assertLegalTransition
    (State-machine check) → leave_requests UPDATE (status=APPROVED) →
    leave_balance_ledger INSERT (pending -= workingDays, taken += workingDays) →
    audit_logs INSERT (APPROVE, actor + acted_for) → Updated Request + refreshed balance
    returned to the UI
```

---
