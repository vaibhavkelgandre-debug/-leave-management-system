# Act II — Applying for and deciding leave

> Part of the [Demo Walkthrough](README.md). ~6 minutes. Windows D (employee) and C (manager).

**The story**: the employee from Act I asks for time off. Their manager decides. The balance moves — and can move back.

---

## Scene 1 — The balance panel (window D)

**Go to** `/dashboard/my-leave`.

> **Say**: "Five leave types, each with its own entitlement. Pick one and you get that type's history — every previous
> request and how it was decided — colour-coded per type, with an 'all' view across every type."

**Point at a balance number.**

> **Say**: "That number is never stored. It's a `SUM()` over an append-only ledger of entries, recomputed on every
> read. There's no counter anywhere that could drift out of step with the history that produced it — because the number
> *is* the history."

Note this now; it pays off in Scene 4.

## Scene 2 — Apply (window D)

**Click Request Leave** → `/dashboard/my-leave/apply-leave`.

> **Say**: "Its own page, not a modal. Applying for leave is a real task with real validation, and a modal makes the
> whole thing feel like a footnote."

Pick a range that **contains a weekend and a public holiday**. Watch the day count.

> **Say**: "It counted working days. Weekends and configured public holidays are excluded — and a range containing
> *only* non-working days is rejected outright, because there's nothing to take off."

Submit.

> **Say**: "That's now `PENDING`, and the days are held as *pending* in the ledger, not deducted. Their available
> balance already reflects it — so they can't spend the same days twice while a request is in flight."

**Try to submit an overlapping request** for the same dates.

> **Say**: "Overlaps are rejected. Two approved leaves for the same day is not a thing that can be represented, so it's
> not a thing you can create."

## Scene 3 — Approve (window C, manager)

**Go to** `/dashboard/approvals`.

> **Say**: "A manager sees exactly their own direct reports' requests — never the whole company. That's enforced in the
> query, not by filtering after the fetch."

Point at the pending badge in the nav.

> **Say**: "That count comes from a dedicated count endpoint rather than fetching the list and measuring it. Small
> thing, but 'fetch 500 rows to display the number 3' is how these systems get slow."

**Show the calendar and the list together.**

> **Say**: "Two separate fetches, deliberately. The list is paginated — page 1, 25 rows. The calendar takes a date
> window instead, because a calendar needs a whole month at once and page 1 of a busy team is not 'this month'. Paging
> the list never refetches the calendar."

**Hover a calendar event** — the app's own tooltip appears, matching every other tooltip in the UI.

**Approve the request.**

> **Say**: "The state machine is server-side. Approving something already approved is a `409`, not a silent success.
> And a manager can't approve their *own* request — that check exists because it's the obvious hole."

## Scene 4 — The payoff: withdraw it (window D)

**Back in window D**, note the balance. **Withdraw** the approved leave.

**Watch the number return to exactly where it started.**

> **Say**: "That's the ledger. Withdrawing writes a compensating entry rather than editing a total, so the balance
> can't drift no matter what sequence of approve, reject, withdraw, cancel or HR override you put it through. If it
> were a stored counter, every one of those paths would be a chance to get it wrong by one."

This is the single best moment in the demo for a technical audience. Don't rush it.

## Scene 5 — HR override, if you have time (window B)

**Go to** `/dashboard/approvals` as HR.

> **Say**: "HR can override a decision a manager already made — but it's a distinct action with its own audit trail,
> not HR quietly using the same approve button. Every decision on a request is recorded with who did it and when."

Open a request's audit trail to show it.

---

## What you just demonstrated

| Guard | Where |
|---|---|
| Working days only; all-holiday ranges rejected | `dates.js` + validator |
| No overlapping requests | leave request service |
| Pending days are held, not deducted | balance ledger |
| Balance is derived, never stored | `SUM()` over `leave_balance_ledger` |
| A manager sees only their reports | query-level scoping |
| No self-approval | decision service |
| Illegal transitions are `409` | server-side state machine |
| Every decision is audited | `audit_logs` |

Full technical detail: [`architecture/09-workflow-leave-application.md`](../architecture/09-workflow-leave-application.md)
and [`architecture/10-workflow-leave-decisions.md`](../architecture/10-workflow-leave-decisions.md).

**Next**: [Act III — Payroll and payslips](04-act3-payroll.md).
