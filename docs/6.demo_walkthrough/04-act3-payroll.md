# Act III — Payroll and payslips

> Part of the [Demo Walkthrough](README.md). ~5 minutes. Window B (HR), plus the mailbox tab.

**The story**: HR runs payroll for last month. The preview tells them the truth about every employee *before* anything
is committed, and the payslips arrive as PDFs.

---

## Scene 1 — The salary structure (window B)

**Go to** `/dashboard/team/:id` for the employee from Act I, and show their salary structure.

> **Say**: "Payroll needs two things per person: a verified profile and a salary structure. Either missing and they're
> reported as skipped, never silently omitted."

## Scene 2 — Calculate (the preview)

**Go to** `/dashboard/payroll-run`. Pick **last month**.

> **Say**: "It won't let me pick this month. A period that isn't over yet would mean paying for days not yet worked,
> and every proration figure would change before the month ended."

**Click Calculate.**

> **Say**: "Nothing has been written. This is a preview — and it recomputes from scratch when I confirm, rather than
> trusting these numbers, because otherwise a stale browser tab would decide what people get paid."

**Walk the result table.** This is the heart of the act — every row has exactly one status, and the interesting ones are
the skips:

| Row you should have prepared | What to say |
|---|---|
| **Ready**, with figures | "This one will get a slip." |
| **Profile not yet verified** | "Act I's gate, showing up here. Verification isn't a badge, it's a precondition for being paid." |
| **Already received** | "This is the one I'd point at. She already has a live payslip for this month." |
| **No salary structure assigned** | "Nothing to compute from." |
| **Net pay zero** *(if you have one)* | "Skipped — but look, the figures are still shown. A payslip saying you earned nothing reads as a statement about your pay rather than a gap in configuration. So HR sees *why* it came to zero and can fix it, instead of just being told it was skipped." |

Dwell on **Already received**:

> **Say**: "This used to be discovered only at confirm time. HR would read 'Ready' here, click approve, and that person
> would be silently skipped. Now the preview resolves it up front in one query for the whole batch, and it's counted
> separately from the other skips — 'nothing to do here, by design' and 'this needs your attention' are different
> messages, so they're badged differently."

Point at the summary counts.

> **Say**: "Ready plus skipped plus already-received always equals the total. The summary can't hide anyone."

## Scene 3 — Confirm

**Click Confirm.**

> **Say**: "That committed the slips. Everything that couldn't be committed comes back in the response with its reason
> — nothing vanishes between the preview and the result."

**Try to run the same period again.** It refuses.

> **Say**: "Re-running requires voiding the existing slip first. The underlying write would happily overwrite it, which
> would erase somebody's payslip without anyone ever making that an explicit, reasoned decision."

## Scene 4 — Void and re-run

**Go to** `/dashboard/salary-slips`, find a slip, **Void** it with a reason.

**Re-run payroll for that period.** That employee is now included again.

> **Say**: "Voiding is how a period is deliberately reopened. The voided figures are archived rather than deleted, so
> the correction has a history."

## Scene 5 — The payslip arrives

**Switch to the mailbox tab.** The payslip email is there, with a PDF attachment that previews inline.

> **Say**: "Sent after the response, one employee at a time. A two-hundred-employee run means two hundred PDF renders
> and two hundred provider calls — waiting for that would hold HR's request open for minutes and time out with payroll
> already committed. So the response returns immediately and the sending happens behind it, with one summary log line
> at the end."

**If it's in spam**, name it and move on — see [01-setup-and-safety.md](01-setup-and-safety.md).

> **Say**: "One employee's bad address drops one email and the loop carries on. And it's all switchable at runtime — a
> flag turns payslip email off without a code change, and the in-app notification plus the download endpoint still
> work."

**Also show** `/dashboard/salary-slips` from the employee's own window if you have time: they see their own slips only,
regardless of role.

---

## What you just demonstrated

| Guard | Where |
|---|---|
| The period must be over | `assertPeriodCompleted` |
| Confirm recomputes; preview figures are never trusted | `confirmPayroll` |
| Unverified profile → skipped | Act I's gate, enforced here |
| No structure → skipped | `findStructureByEmployeeId` |
| Net pay ≤ 0 → skipped, with figures shown | `computeSlip` |
| One live slip per employee per period | `already_generated` + void-to-reopen |
| Counts always reconcile | `ok + skipped + alreadyGenerated === total` |
| Email never blocks or breaks payroll | fire-and-forget, sequential, logged |

Full technical detail: [`architecture/11-workflow-payroll-and-payslips.md`](../architecture/11-workflow-payroll-and-payslips.md).

**Next**: [Act IV — Roles, scope and delegation](05-act4-roles-and-scope.md).
