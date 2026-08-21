# Workflow — payroll run & payslips

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Shape of the module

Payroll is **two-phase on purpose**: HR previews a whole period, reads what would happen to every employee, and then
commits it. Nothing is written by the preview.

```text
POST /api/salary-slips/calculate   { payPeriod, role?, profileStatus? }   → preview, writes nothing
POST /api/salary-slips/confirm     { payPeriod, role?, profileStatus? }   → commits slips, emails PDFs
```

Both are `requireRole("HR_ADMIN", "SUPER_ADMIN")` at the route *and* re-check the role inside
`salarySlipService`, because a service is reachable from more than one route over time.

A run is always scoped to `getHrScopedUsers(actor)` — an HR admin's own subtree, never the whole company. `role` and
`profileStatus` narrow it further *before* anything is computed, so "payroll for verified employees only" never has to
be assembled by hand.

⚠️ **`confirm` recomputes from scratch and never trusts the preview's numbers.** The client sends the same
`payPeriod` and filters, not the figures — otherwise a tampered or merely stale preview would decide what people get
paid.

## The period must be over

`assertPeriodCompleted(payPeriod)` rejects the current or a future month. Paying out a month still in progress would
mean paying for days not yet worked, and every LOP/proration figure would change before the month ended.

---

## Per-employee outcomes

`calculateForSubtree` returns one row per employee in scope, each with exactly one status. This is the heart of the
module:

| Status | Meaning | `computed` |
|---|---|---|
| `ok` | a slip will be created | the figures |
| `skipped` | included in the run, but nothing to issue | `null` |
| `already_generated` | holds a live slip for this period already | `null` |

`ok + skipped + alreadyGenerated === total`, always — the summary can't hide anyone.

### The four reasons a row is skipped

Checked in this order, and the order matters:

1. **`Profile not yet verified`** — payroll depends on identity having been checked. See
   [08-workflow-documents-and-verification.md](08-workflow-documents-and-verification.md).
2. **`Not yet joined for this period`** — the period ends before `joining_date`. There is nothing to compute, as
   opposed to something that computes to zero.
3. **`already_generated`** — checked *before* the salary-structure lookup and the computation. Someone who already has
   a live slip needs neither, and re-deriving figures that can't be committed would only raise the question of why
   they differ from the slip they'll actually keep. That's also why `computed` is `null`.
4. **`No salary structure assigned`** — nothing to compute from.

Plus a fifth, decided inside `computeSlip`:

5. **Net pay ≤ 0 → `skipped`.** A payslip claiming someone earned nothing is worse than no payslip: it looks like a
   statement of fact about their pay rather than a gap in configuration. The computed figures are still attached to
   the row so HR can see *why* it came to zero and fix it, rather than only being told it was skipped.

⚠️ **`already_generated` is counted separately from `skipped`, not folded into it.** "Nothing to do here, by design"
and "this one needs your attention" are different messages, and the client badges them differently. This also fixed a
real bug: the check used to happen only at confirm time, so HR read **Ready** in the preview for someone who was then
silently skipped on approve.

---

## Committing

```text
POST /api/salary-slips/confirm
 ↓
role check, assertPeriodCompleted
 ↓
calculateForSubtree(...)  -- recomputed, same filters
 ↓
okRows = status "ok";  skipped = status !== "ok"      ← not `=== "skipped"`, so already_generated
                                                        and nothing-payable rows can't vanish
 ↓
race backstop: re-query live slips for okRows; anything now ACTIVE moves to skipped
 ↓
replaceSlipsForPeriod({ payPeriod, actorId, rows })
 ↓
notifySalarySlipsGenerated(committed, ...)     -- committed rows only; a skipped row got no slip
 ↓
void emailCommittedPayslips(committed, payPeriod).catch(log)   -- fire-and-forget
 ↓
respond { committed, skipped }
```

**Re-running a period requires voiding first.** `replaceSlipsForPeriod`'s own `ON CONFLICT` would happily overwrite a
live slip, which would erase someone's payslip without HR ever making that an explicit, reasoned decision. A `VOIDED`
slip is different: it's how a period is deliberately reopened, so that employee stays in `okRows` and the commit both
archives the voided figures and reactivates the row.

The backstop after `calculateForSubtree` looks redundant — the preview already tags those rows — and it is, in normal
use. It stays for the narrow race it always implicitly covered: two HR admins confirming the same period concurrently
both compute before either commits, and this is the later of the two checks.

---

## Emailing the payslips

```text
emailCommittedPayslips(committedRows, payPeriod)
 ↓
re-fetch the committed slips (joined shape) in ONE query
 ↓
for each slip, sequentially:
      renderPayslipPdfBuffer(slip)  →  sendSalarySlipEmail({ ..., pdf })
 ↓
console.log(`[payslip-email] period=… sent=… failed=…`)
```

Four decisions worth not undoing:

- **Fire-and-forget, and for a different reason than the password-reset send.** That one is about a timing oracle;
  this one is about the response. A run can commit a couple of hundred slips, each needing a PDF render plus a
  provider round trip — awaiting them would hold HR's request open for minutes and hit the proxy timeout with payroll
  already committed.
- **Nothing throws.** By the time this runs, payroll is committed and the response has gone. There is nothing left to
  fail into, so every error is logged instead.
- **Sequential, not parallel.** Providers throttle per connection and free tiers cap daily volume, so 200 concurrent
  sends is the shape most likely to get the entire run rejected. Each employee is independent: one bad address drops
  one email and the loop continues.
- **It re-fetches rather than reusing `committed`.** `RETURNING` gives `salary_slips` columns only, while the PDF and
  the email both need the joined employee name/email/designation/PAN. One query for the batch, not one per employee.

`renderPayslipPdfBuffer` exists alongside `renderPayslipPdf` rather than replacing it: an attachment needs the whole
file in memory, while the HTTP download wants a stream it can pipe. A run buffers one payslip at a time, never all of
them.

Delivery is switchable at runtime by `MAIL_FEATURE_SALARY_SLIP` — with it off, the in-app notification and
`GET /salary-slips/:id/pdf` still work. See
[12-workflow-notifications-and-email.md](12-workflow-notifications-and-email.md).

---

## Reading and voiding slips

| Endpoint | Who | Notes |
|---|---|---|
| `GET /salary-slips/mine` | any authenticated | **own slips only, regardless of role** — unpaginated, it's ~36 rows |
| `GET /salary-slips` | HR-tier | the scoped team list; **paginated** `limit`/`offset` → `{ slips, total }` |
| `GET /salary-slips/:id` | any authenticated | row-level check inside the service, like `leave-requests/:id` |
| `GET /salary-slips/:id/pdf` | any authenticated | streamed, not buffered |
| `POST /salary-slips/:id/void` | HR-tier | `reason` required |

⚠️ **`/mine` and the HR list used to be one function branching on `actor.role`**, which meant an HR admin's "your
slips" returned the same rows as "your team's slips" — the page read as duplicated. They're deliberately separate now;
don't re-merge them.

Voiding records a reason and fires `notifySalarySlipVoided`. It's the only way to reopen a period, which is what makes
"already received" a safe default rather than a dead end.

## Failure modes worth knowing

| Symptom | Cause |
|---|---|
| Every row `Profile not yet verified` | verification hasn't happened for that subtree |
| A row reads "already received" | a live slip exists — void it to re-run that employee |
| Row skipped with figures shown | net pay computed to ≤ 0 — read the figures, fix the structure |
| `calculate` rejected outright | the period isn't over yet (`assertPeriodCompleted`) |
| Slips committed, no emails | check `[payslip-email] … failed=` and the mail feature flag |
| HR sees fewer employees than expected | `getHrScopedUsers` — a run is subtree-scoped, never company-wide |
