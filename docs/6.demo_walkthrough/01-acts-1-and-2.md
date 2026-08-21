# Acts I–II — onboarding, then applying for and deciding leave

> Part of the [Demo Walkthrough](README.md). ~12 minutes for both acts.

---

## Act I — Onboarding a new employee

**The story**: a person joins. Their account exists immediately, but nobody trusts it until a human has checked their
documents against what they typed.

---

### Scene 1 — Invite them (window B, HR)

**Go to** `/dashboard/employees/new` — *Add Employee*. From `/dashboard/team` (My Team) for HR, or
`/dashboard/employees` (All Employees) for the super admin.

Fill in name, email, role `EMPLOYEE`, and pick a manager.

> **Say**: "The manager dropdown only offers people who could legitimately be this person's manager. An employee can
> report to a manager or an HR admin; a manager only to an HR admin. That's enforced on the server too — the dropdown
> is a convenience, not the rule."

**Click Invite.** You get a green panel: *"Invited. We emailed the link to …"* plus the link itself as a fallback.

> **Say**: "Two things happened. The account exists now, in an `INVITED` state — they can't log in, they have no
> password. And an email went out with a single-use link that expires in 12 hours."

**If the panel is amber** — *"Invited, but the email wasn't sent"* — the account was still created and the link still
works. Read it as designed behaviour, because it is:

> **Say**: "Mail is a side effect, not part of the transaction. The account, their leave balances and the invitation
> row all committed before the email was attempted, so a mail outage can never cost you the employee you just created.
> The UI promotes the link instead."

**Copy the link.**

### Scene 2 — They accept (window D, logged out)

**Paste the link** — `/invite/:token`. They set their own password.

> **Say**: "HR never sees or sets this password. The token is stored only as a SHA-256 hash, and it's single-use — the
> row is marked accepted the moment it's used."

They land on the dashboard. Point at the notification bell.

> **Say**: "They already have a notification telling them what to do next: fill in your profile and upload your
> documents. That's generated the moment their account becomes active, rather than leaving a new joiner staring at an
> empty dashboard."

### Scene 3 — Profile and documents (window D)

**Go to** `/dashboard/profile`. Fill in the required fields. Upload the four required documents: **PAN card, Aadhaar
card, bank passbook, offer letter**.

> **Say**: "Four documents are required. They can also upload extras — real onboarding always has a fifth document
> nobody anticipated — but only these four gate anything."

**Click Submit for verification.** Then, to show a guard, try submitting with a field blank first:

> **Say**: "It won't submit half-finished, and it names exactly what's missing rather than saying 'invalid'."

### Scene 4 — HR reviews each document (window B)

**Go to** `/dashboard/profile-verification`, then open the new employee — `/dashboard/profile-verification/:id`.

**Open a document.** It previews inline; it doesn't download.

> **Say**: "That preview is less trivial than it looks. The files live in Cloudinary as raw assets, and Cloudinary
> serves those with a header that forces a download — so a direct link could never preview. The server fetches the
> bytes and re-serves them with our own headers. Someone whose job is looking at documents shouldn't have to download
> each one first."

**Now the moment worth building the act around.** Review the documents, and **reject one** with a reason — say the name
on the PAN card doesn't match the profile.

**Then click Verify Profile.** It refuses, and names the document.

> **Say**: "HR can't verify past a document a human rejected. And it can't verify while any of the four is simply
> unreviewed either — a missed document is impossible, not just discouraged."

**Click Send Back**, with the reason.

> **Say**: "The reason is required and it's stored on the employee's record, not just logged. Being told 'your profile
> was returned' without being told what was wrong just produces a resubmission of the same thing."

### Scene 5 — Fix and verify (windows D then B)

**Window D**: the employee sees the notification with the reason. Re-upload the corrected document.

> **Say**: "And they can't just resubmit without fixing it — submitting again while a document is still rejected is
> blocked at submit time, where it's actionable, rather than at HR's Verify button where it isn't."

**Window B**: review the replaced document, mark it verified, **Verify Profile**. It goes through.

> **Say**: "Now they're verified — which matters because verification is a precondition for payroll. That's Act III."

---

### What you just demonstrated

| Guard | Where |
|---|---|
| A reporting line must be legal | invite form + server |
| A profile can't be submitted incomplete | `REQUIRED_PROFILE_FIELDS` |
| All four documents must exist to submit | `REQUIRED_DOCUMENT_TYPES` |
| Every document must be individually verified | `assertRequiredDocumentsVerified` |
| A rejected document blocks verification | `assertNoRejectedDocuments` |
| A send-back must carry a reason | `sendProfileBackSchema` |
| Mail failure never fails the request | invitation service |

Full technical detail: [`architecture/08-workflow-documents-and-verification.md`](../architecture/04-workflow-onboarding-and-verification.md).

**Next**: [Act II — Applying for and deciding leave](01-acts-1-and-2.md).

---

## Act II — Applying for and deciding leave

**The story**: the employee from Act I asks for time off. Their manager decides. The balance moves — and can move back.

---

### Scene 1 — The balance panel (window D)

**Go to** `/dashboard/my-leave`.

> **Say**: "Five leave types, each with its own entitlement. Pick one and you get that type's history — every previous
> request and how it was decided — colour-coded per type, with an 'all' view across every type."

**Point at a balance number.**

> **Say**: "That number is never stored. It's a `SUM()` over an append-only ledger of entries, recomputed on every
> read. There's no counter anywhere that could drift out of step with the history that produced it — because the number
> *is* the history."

Note this now; it pays off in Scene 4.

### Scene 2 — Apply (window D)

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

### Scene 3 — Approve (window C, manager)

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

### Scene 4 — The payoff: withdraw it (window D)

**Back in window D**, note the balance. **Withdraw** the approved leave.

**Watch the number return to exactly where it started.**

> **Say**: "That's the ledger. Withdrawing writes a compensating entry rather than editing a total, so the balance
> can't drift no matter what sequence of approve, reject, withdraw, cancel or HR override you put it through. If it
> were a stored counter, every one of those paths would be a chance to get it wrong by one."

This is the single best moment in the demo for a technical audience. Don't rush it.

### Scene 5 — HR override, if you have time (window B)

**Go to** `/dashboard/approvals` as HR.

> **Say**: "HR can override a decision a manager already made — but it's a distinct action with its own audit trail,
> not HR quietly using the same approve button. Every decision on a request is recorded with who did it and when."

Open a request's audit trail to show it.

---

### What you just demonstrated

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

Full technical detail: [`architecture/09-workflow-leave-application.md`](../architecture/05-workflow-leave-and-reporting.md)
and [`architecture/10-workflow-leave-decisions.md`](../architecture/05-workflow-leave-and-reporting.md).

**Next**: [Act III — Payroll and payslips](02-acts-3-and-4.md).
